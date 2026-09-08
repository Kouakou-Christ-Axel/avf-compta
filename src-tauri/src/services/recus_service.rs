use crate::error::{AppError, AppResult};
use crate::models::{Recu, StatutNote};
use crate::repositories::{notes, paiements, recus};
use rusqlite::Connection;

/// Génère le reçu d'un paiement, avec un numéro séquentiel (`RECU-0001`,
/// `RECU-0002`, …).
///
/// **Idempotent** : si un reçu a déjà été émis pour ce paiement, il est renvoyé
/// tel quel. Auparavant chaque prévisualisation en créait un nouveau, ce qui
/// dupliquait les reçus et faisait sauter la numérotation.
pub fn generer(conn: &Connection, paiement_id: i64) -> AppResult<Recu> {
    // Vérifie que le paiement existe (sinon NotFound).
    let paiement = paiements::get(conn, paiement_id)?;

    if let Some(existant) = recus::find_by_paiement(conn, paiement_id)? {
        return Ok(existant);
    }

    // Un paiement annulé ne peut pas donner lieu à un nouveau reçu valide :
    // l'argent correspondant n'a pas été perçu.
    if paiement.annule {
        return Err(AppError::Validation(
            "impossible de générer un reçu : le paiement associé est annulé".into(),
        ));
    }

    if notes::statut(conn, paiement.note_id)? == StatutNote::ANNULEE {
        return Err(AppError::Validation(
            "impossible de générer un reçu : la facture est annulée".into(),
        ));
    }

    // Le total et le reste à payer sont figés maintenant : un reçu réimprimé
    // plus tard doit montrer la situation du jour de l'encaissement.
    let note_total = notes::total(conn, paiement.note_id)?;
    let note_solde = note_total - paiements::total_paye(conn, paiement.note_id)?;

    let numero = recus::prochain_numero(conn)?;
    let id = recus::insert(conn, paiement_id, &numero, note_total, note_solde)?;
    recus::get(conn, id)
}

/// Annule un reçu : le reçu est marqué annulé, le paiement lié est annulé et le
/// statut de la note est **recalculé** à partir du solde restant.
///
/// L'ensemble est exécuté dans une transaction : auparavant les trois écritures
/// étaient indépendantes et une facture réellement soldée pouvait retomber en
/// « emise » (statut écrit en dur).
pub fn annuler(conn: &mut Connection, recu_id: i64) -> AppResult<()> {
    let tx = conn.transaction()?;
    let paiement_id = recus::marquer_annule(&tx, recu_id)?;
    let note_id = paiements::annuler(&tx, paiement_id)?;
    super::paiements_service::recalculer_statut(&tx, note_id)?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::error::AppError;
    use crate::models::note::NewNoteLigne;
    use crate::models::{NewClient, NewNote, NewPaiement, NewPrestation};
    use crate::repositories::{clients, prestations};
    use crate::services::{notes_service, paiements_service};

    fn seed_paiement(conn: &mut Connection) -> i64 {
        let client = clients::create(
            conn,
            &NewClient {
                nom: "Acme".into(),
                email: None,
                telephone: None,
                adresse: None,
            },
        )
        .unwrap();
        let presta = prestations::create(
            conn,
            &NewPrestation {
                libelle: "Conseil".into(),
                prix: 10_000,
            },
        )
        .unwrap();
        let note = notes_service::create_note(
            conn,
            &NewNote {
                client_id: client,
                date_emission: "2026-06-18".into(),
                echeance: None,
                lignes: vec![NewNoteLigne {
                    prestation_id: presta,
                    quantite: 1,
                }],
                remise_type: None,
                remise_valeur: 0,
            },
        )
        .unwrap();
        paiements_service::enregistrer(
            conn,
            &NewPaiement {
                note_id: note,
                montant: 10_000,
                date_paiement: "2026-06-18".into(),
                methode: None,
            },
        )
        .unwrap()
    }

    #[test]
    fn generates_sequential_numbers() {
        let mut conn = open_in_memory().unwrap();
        let p1 = seed_paiement(&mut conn);
        let p2 = seed_paiement(&mut conn);
        let r1 = generer(&conn, p1).unwrap();
        let r2 = generer(&conn, p2).unwrap();
        assert_eq!(r1.numero, "RECU-0001");
        assert_eq!(r2.numero, "RECU-0002");
    }

    #[test]
    fn fails_for_unknown_payment() {
        let conn = open_in_memory().unwrap();
        assert!(matches!(generer(&conn, 999), Err(AppError::NotFound(_))));
    }

    /// Après annulation, régénérer ne recrée pas un second reçu : c'est le
    /// même document (marqué annulé) qui est renvoyé.
    #[test]
    fn generer_apres_annulation_renvoie_le_meme_recu() {
        let mut conn = open_in_memory().unwrap();
        let paiement_id = seed_paiement(&mut conn);

        let recu1 = generer(&conn, paiement_id).unwrap();
        annuler(&mut conn, recu1.id).unwrap();

        let recu2 = generer(&conn, paiement_id).unwrap();
        assert_eq!(recu2.id, recu1.id);
        assert_eq!(recu2.numero, recu1.numero);
        assert!(recu2.annule);
        assert_eq!(recus::list(&conn).unwrap().len(), 1);
    }

    /// Un paiement annulé sans reçu (annulation directe) ne peut pas en
    /// obtenir un : l'argent n'a pas été perçu.
    #[test]
    fn generer_rejette_si_paiement_annule_sans_recu() {
        let mut conn = open_in_memory().unwrap();
        let paiement_id = seed_paiement(&mut conn);
        crate::services::paiements_service::annuler(&mut conn, paiement_id).unwrap();

        match generer(&conn, paiement_id).unwrap_err() {
            AppError::Validation(msg) => assert!(msg.contains("annulé")),
            other => panic!("expected Validation error, got {other:?}"),
        }
    }

    /// Deux prévisualisations d'affilée ne créent qu'un seul reçu : c'est le
    /// bug de doublon remonté en production.
    #[test]
    fn generer_deux_fois_ne_cree_quun_seul_recu() {
        let mut conn = open_in_memory().unwrap();
        let paiement_id = seed_paiement(&mut conn);

        let a = generer(&conn, paiement_id).unwrap();
        let b = generer(&conn, paiement_id).unwrap();

        assert_eq!(a.id, b.id);
        assert_eq!(a.numero, b.numero);
        assert_eq!(recus::list(&conn).unwrap().len(), 1);
    }

    /// Le reçu fige le reste à payer : un second paiement plus tard ne doit
    /// pas modifier le document déjà remis au client.
    #[test]
    fn recu_fige_le_solde_a_lemission() {
        let mut conn = open_in_memory().unwrap();
        let client = clients::create(
            &conn,
            &NewClient {
                nom: "Acme".into(),
                email: None,
                telephone: None,
                adresse: None,
            },
        )
        .unwrap();
        let presta = prestations::create(
            &conn,
            &NewPrestation {
                libelle: "Conseil".into(),
                prix: 10_000,
            },
        )
        .unwrap();
        let note = notes_service::create_note(
            &mut conn,
            &NewNote {
                client_id: client,
                date_emission: "2026-06-18".into(),
                echeance: None,
                lignes: vec![NewNoteLigne {
                    prestation_id: presta,
                    quantite: 1,
                }],
                remise_type: None,
                remise_valeur: 0,
            },
        )
        .unwrap();

        let p1 = paiements_service::enregistrer(
            &mut conn,
            &NewPaiement {
                note_id: note,
                montant: 4_000,
                date_paiement: "2026-06-18".into(),
                methode: None,
            },
        )
        .unwrap();
        let recu = generer(&conn, p1).unwrap();
        assert_eq!(recu.note_solde, 6_000);

        // Un second encaissement ne doit pas rétroagir sur le premier reçu.
        paiements_service::enregistrer(
            &mut conn,
            &NewPaiement {
                note_id: note,
                montant: 6_000,
                date_paiement: "2026-06-19".into(),
                methode: None,
            },
        )
        .unwrap();
        assert_eq!(recus::detail(&conn, recu.id).unwrap().note_solde, 6_000);
    }
}
