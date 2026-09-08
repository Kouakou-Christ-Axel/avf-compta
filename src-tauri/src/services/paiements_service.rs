use crate::error::{AppError, AppResult};
use crate::models::{NewPaiement, SoldeNote, StatutNote};
use crate::money::Money;
use crate::repositories::{notes, paiements};
use rusqlite::Connection;

/// Calcule le solde d'une note : total facturé (remise déduite), encaissé et
/// reste dû.
pub fn solde(conn: &Connection, note_id: i64) -> AppResult<SoldeNote> {
    // Garantit que la note existe (sinon NotFound).
    notes::get(conn, note_id)?;
    let total = notes::total(conn, note_id)?;
    let paye = paiements::total_paye(conn, note_id)?;
    let solde = total - paye;
    Ok(SoldeNote {
        note_id,
        total,
        paye,
        solde,
        // Pas de garde `total > 0` : une facture à net nul (remise de 100 %, ou
        // remise en montant supérieure au brut) est soldée dès son émission.
        // Aucun paiement ne peut la solder après coup — `enregistrer` refuse
        // tout montant nul ou négatif — donc l'exiger la laissait « emise » à
        // vie alors que rien n'est dû.
        payee: solde <= 0,
    })
}

/// Réaligne le statut d'une note sur son solde réel (`payee` si tout est
/// encaissé, `emise` sinon). Une note annulée n'est pas touchée.
///
/// Point d'entrée unique : toute écriture de statut liée à un paiement passe
/// par ici, pour qu'aucun appelant ne puisse forcer un statut incohérent.
pub fn recalculer_statut(conn: &Connection, note_id: i64) -> AppResult<()> {
    if notes::statut(conn, note_id)? == StatutNote::ANNULEE {
        return Ok(());
    }
    let statut = if solde(conn, note_id)?.payee {
        StatutNote::Payee.as_str()
    } else {
        StatutNote::Emise.as_str()
    };
    notes::set_statut(conn, note_id, statut)
}

/// Enregistre un paiement contre une note, en refusant tout sur-paiement, puis
/// met à jour le statut de la note (payée si le solde atteint zéro).
///
/// L'insertion et la mise à jour du statut sont dans une **transaction** :
/// séparées, un incident entre les deux laissait un paiement encaissé sur une
/// facture restée « emise ».
pub fn enregistrer(conn: &mut Connection, p: &NewPaiement) -> AppResult<i64> {
    if p.montant <= 0 {
        return Err(AppError::Validation(
            "le montant du paiement doit être positif".into(),
        ));
    }
    // Une facture annulée n'attend plus rien : sans ce garde-fou, encaisser
    // dessus la faisait silencieusement repasser en « emise ».
    if notes::statut(conn, p.note_id)? == StatutNote::ANNULEE {
        return Err(AppError::Validation(
            "cette facture est annulée : aucun paiement ne peut y être enregistré".into(),
        ));
    }
    let s = solde(conn, p.note_id)?;
    if p.montant > s.solde {
        return Err(AppError::Validation(format!(
            "sur-paiement refusé : il reste {} à payer, le paiement est de {}",
            Money::from_xof(s.solde),
            Money::from_xof(p.montant)
        )));
    }

    let tx = conn.transaction()?;
    let id = paiements::insert(
        &tx,
        p.note_id,
        p.montant,
        &p.date_paiement,
        p.methode.as_deref(),
    )?;
    recalculer_statut(&tx, p.note_id)?;
    tx.commit()?;

    Ok(id)
}

/// Annule un paiement saisi par erreur et réaligne le statut de la note.
///
/// Si un reçu avait été émis pour ce paiement, il est annulé du même coup :
/// un reçu valide ne doit jamais attester d'un encaissement repris.
pub fn annuler(conn: &mut Connection, paiement_id: i64) -> AppResult<()> {
    let paiement = paiements::get(conn, paiement_id)?;
    if paiement.annule {
        return Ok(());
    }
    let tx = conn.transaction()?;
    if let Some(recu) = crate::repositories::recus::find_by_paiement(&tx, paiement_id)? {
        tx.execute("UPDATE recus SET annule = 1 WHERE id = ?1", [recu.id])?;
    }
    let note_id = paiements::annuler(&tx, paiement_id)?;
    recalculer_statut(&tx, note_id)?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::models::note::NewNoteLigne;
    use crate::models::{NewClient, NewNote, NewPrestation};
    use crate::repositories::{clients, prestations};
    use crate::services::notes_service;

    /// Crée une note de 30 000 FCFA (3 × 10 000) et renvoie son id.
    fn note_de_300(conn: &mut Connection) -> i64 {
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
        notes_service::create_note(
            conn,
            &NewNote {
                client_id: client,
                date_emission: "2026-06-18".into(),
                echeance: None,
                lignes: vec![NewNoteLigne {
                    prestation_id: presta,
                    quantite: 3,
                }],
                remise_type: None,
                remise_valeur: 0,
            },
        )
        .unwrap()
    }

    fn paiement(note_id: i64, montant: i64) -> NewPaiement {
        NewPaiement {
            note_id,
            montant,
            date_paiement: "2026-06-18".into(),
            methode: Some("virement".into()),
        }
    }

    #[test]
    fn partial_payment_updates_solde() {
        let mut conn = open_in_memory().unwrap();
        let note = note_de_300(&mut conn);
        enregistrer(&mut conn, &paiement(note, 10_000)).unwrap();
        let s = solde(&conn, note).unwrap();
        assert_eq!(s.paye, 10_000);
        assert_eq!(s.solde, 20_000);
        assert!(!s.payee);
        assert_eq!(notes::get(&conn, note).unwrap().statut, StatutNote::EMISE);
    }

    #[test]
    fn full_payment_marks_note_paid() {
        let mut conn = open_in_memory().unwrap();
        let note = note_de_300(&mut conn);
        enregistrer(&mut conn, &paiement(note, 20_000)).unwrap();
        enregistrer(&mut conn, &paiement(note, 10_000)).unwrap();
        let s = solde(&conn, note).unwrap();
        assert_eq!(s.solde, 0);
        assert!(s.payee);
        assert_eq!(notes::get(&conn, note).unwrap().statut, StatutNote::PAYEE);
    }

    #[test]
    fn overpayment_is_rejected() {
        let mut conn = open_in_memory().unwrap();
        let note = note_de_300(&mut conn);
        assert!(matches!(
            enregistrer(&mut conn, &paiement(note, 30_001)),
            Err(AppError::Validation(_))
        ));
        // Aucun paiement enregistré.
        assert_eq!(solde(&conn, note).unwrap().paye, 0);
    }

    #[test]
    fn non_positive_amount_is_rejected() {
        let mut conn = open_in_memory().unwrap();
        let note = note_de_300(&mut conn);
        assert!(matches!(
            enregistrer(&mut conn, &paiement(note, 0)),
            Err(AppError::Validation(_))
        ));
    }

    /// Une facture annulée n'accepte plus d'encaissement : sans ce garde-fou
    /// elle repassait silencieusement en « emise ».
    #[test]
    fn paiement_sur_facture_annulee_est_refuse() {
        let mut conn = open_in_memory().unwrap();
        let note = note_de_300(&mut conn);
        notes_service::annuler(&conn, note).unwrap();

        let res = enregistrer(
            &mut conn,
            &NewPaiement {
                note_id: note,
                montant: 10_000,
                date_paiement: "2026-06-18".into(),
                methode: None,
            },
        );
        assert!(matches!(res, Err(AppError::Validation(_))));
        assert_eq!(notes::statut(&conn, note).unwrap(), StatutNote::ANNULEE);
    }

    /// Annuler une facture déjà encaissée ferait disparaître l'argent des
    /// totaux : c'est refusé tant que les paiements ne sont pas annulés.
    #[test]
    fn annulation_facture_refusee_si_paiement_actif() {
        let mut conn = open_in_memory().unwrap();
        let note = note_de_300(&mut conn);
        let p = enregistrer(
            &mut conn,
            &NewPaiement {
                note_id: note,
                montant: 10_000,
                date_paiement: "2026-06-18".into(),
                methode: None,
            },
        )
        .unwrap();

        assert!(matches!(
            notes_service::annuler(&conn, note),
            Err(AppError::Validation(_))
        ));

        // Une fois le paiement annulé, l'annulation passe.
        annuler(&mut conn, p).unwrap();
        notes_service::annuler(&conn, note).unwrap();
        assert_eq!(notes::statut(&conn, note).unwrap(), StatutNote::ANNULEE);
    }

    /// Annuler un paiement le retire des totaux et réaligne le statut.
    #[test]
    fn annuler_paiement_reouvre_la_facture() {
        let mut conn = open_in_memory().unwrap();
        let note = note_de_300(&mut conn);
        let p = enregistrer(
            &mut conn,
            &NewPaiement {
                note_id: note,
                montant: 30_000,
                date_paiement: "2026-06-18".into(),
                methode: None,
            },
        )
        .unwrap();
        assert_eq!(notes::statut(&conn, note).unwrap(), StatutNote::PAYEE);

        annuler(&mut conn, p).unwrap();
        assert_eq!(notes::statut(&conn, note).unwrap(), StatutNote::EMISE);
        assert_eq!(solde(&conn, note).unwrap().paye, 0);
        // Idempotent : ré-annuler ne change rien.
        annuler(&mut conn, p).unwrap();
        assert_eq!(solde(&conn, note).unwrap().paye, 0);
    }

    /// Annuler le reçu d'un paiement parmi deux ne doit pas rouvrir une
    /// facture qui reste soldée par l'autre — le statut est recalculé, plus
    /// écrit en dur.
    #[test]
    fn annulation_recu_recalcule_le_statut() {
        use crate::services::recus_service;

        let mut conn = open_in_memory().unwrap();
        let note = note_de_300(&mut conn);
        let p1 = enregistrer(
            &mut conn,
            &NewPaiement {
                note_id: note,
                montant: 10_000,
                date_paiement: "2026-06-18".into(),
                methode: None,
            },
        )
        .unwrap();
        enregistrer(
            &mut conn,
            &NewPaiement {
                note_id: note,
                montant: 20_000,
                date_paiement: "2026-06-19".into(),
                methode: None,
            },
        )
        .unwrap();
        assert_eq!(notes::statut(&conn, note).unwrap(), StatutNote::PAYEE);

        let recu = recus_service::generer(&conn, p1).unwrap();
        recus_service::annuler(&mut conn, recu.id).unwrap();

        // Il reste 10 000 dus : la facture est bien rouverte.
        assert_eq!(notes::statut(&conn, note).unwrap(), StatutNote::EMISE);
        assert_eq!(solde(&conn, note).unwrap().solde, 10_000);
    }

    /// Annuler un paiement annule aussi son reçu : un reçu valide ne doit
    /// jamais attester d'un encaissement repris.
    #[test]
    fn annuler_paiement_annule_son_recu() {
        use crate::repositories::recus;
        use crate::services::recus_service;

        let mut conn = open_in_memory().unwrap();
        let note = note_de_300(&mut conn);
        let p = enregistrer(
            &mut conn,
            &NewPaiement {
                note_id: note,
                montant: 30_000,
                date_paiement: "2026-06-18".into(),
                methode: None,
            },
        )
        .unwrap();
        let recu = recus_service::generer(&conn, p).unwrap();

        annuler(&mut conn, p).unwrap();
        assert!(recus::get(&conn, recu.id).unwrap().annule);
    }
}
