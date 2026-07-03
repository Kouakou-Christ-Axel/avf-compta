use crate::error::{AppError, AppResult};
use crate::models::Recu;
use crate::repositories::{paiements, recus};
use rusqlite::Connection;

/// Génère un reçu pour un paiement existant, avec un numéro séquentiel
/// (`RECU-0001`, `RECU-0002`, …).
pub fn generer(conn: &Connection, paiement_id: i64) -> AppResult<Recu> {
    // Vérifie que le paiement existe (sinon NotFound).
    let paiement = paiements::get(conn, paiement_id)?;

    // Un paiement annulé ne peut pas donner lieu à un nouveau reçu valide :
    // l'argent correspondant n'a pas été perçu.
    if paiement.annule {
        return Err(AppError::Validation(
            "impossible de générer un reçu : le paiement associé est annulé".into(),
        ));
    }

    let numero = format!("RECU-{:04}", recus::count(conn)? + 1);
    let id = recus::insert(conn, paiement_id, &numero)?;
    recus::get(conn, id)
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

    #[test]
    fn generer_rejette_si_paiement_annule() {
        let mut conn = open_in_memory().unwrap();
        let paiement_id = seed_paiement(&mut conn);

        // Génère un premier reçu, puis l'annule (ce qui annule le paiement).
        let recu1 = generer(&conn, paiement_id).unwrap();
        recus::annuler(&conn, recu1.id).unwrap();

        // Toute nouvelle génération pour ce même paiement doit être rejetée.
        let err = generer(&conn, paiement_id).unwrap_err();
        match err {
            AppError::Validation(msg) => assert!(msg.contains("annulé")),
            other => panic!("expected Validation error, got {other:?}"),
        }
    }
}
