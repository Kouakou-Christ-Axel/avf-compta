use crate::error::{AppError, AppResult};
use crate::models::{NewDepense, StatutNote};
use crate::repositories::{depenses, notes};
use rusqlite::Connection;

/// Enregistre une dépense, rattachée ou non à une facture.
///
/// Une facture annulée n'accepte plus rien : elle est exclue des totaux, et une
/// dépense ajoutée dessus fausserait la marge sans jamais apparaître au
/// tableau de bord.
pub fn create(conn: &Connection, d: &NewDepense) -> AppResult<i64> {
    if d.libelle.trim().is_empty() {
        return Err(AppError::Validation("le libellé est requis".into()));
    }
    if d.montant <= 0 {
        return Err(AppError::Validation(
            "le montant de la dépense doit être positif".into(),
        ));
    }
    if let Some(note_id) = d.note_id {
        if notes::statut(conn, note_id)? == StatutNote::ANNULEE {
            return Err(AppError::Validation(
                "cette facture est annulée : aucune dépense ne peut y être ajoutée".into(),
            ));
        }
    }
    depenses::insert(conn, d)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::models::note::NewNoteLigne;
    use crate::models::{NewClient, NewNote, NewPrestation};
    use crate::repositories::{clients, depenses, prestations};
    use crate::services::notes_service;

    fn note(conn: &mut Connection) -> i64 {
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
                prix: 100_000,
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
                    quantite: 1,
                }],
                remise_type: None,
                remise_valeur: 0,
            },
        )
        .unwrap()
    }

    fn depense(note_id: Option<i64>, libelle: &str, montant: i64) -> NewDepense {
        NewDepense {
            note_id,
            libelle: libelle.into(),
            montant,
            date_depense: "2026-06-18".into(),
        }
    }

    #[test]
    fn libelle_vide_ou_montant_nul_sont_refuses() {
        let mut conn = open_in_memory().unwrap();
        let n = note(&mut conn);
        assert!(matches!(
            create(&conn, &depense(Some(n), " ", 1_000)),
            Err(AppError::Validation(_))
        ));
        assert!(matches!(
            create(&conn, &depense(Some(n), "X", 0)),
            Err(AppError::Validation(_))
        ));
        assert!(depenses::list_by_note(&conn, n).unwrap().is_empty());
    }

    /// Une facture annulée est exclue des totaux : une dépense ajoutée dessus
    /// fausserait la marge sans jamais remonter au tableau de bord.
    #[test]
    fn depense_sur_facture_annulee_est_refusee() {
        let mut conn = open_in_memory().unwrap();
        let n = note(&mut conn);
        notes_service::annuler(&conn, n).unwrap();

        assert!(matches!(
            create(&conn, &depense(Some(n), "Transport", 15_000)),
            Err(AppError::Validation(_))
        ));
    }

    #[test]
    fn depense_valide_est_enregistree() {
        let mut conn = open_in_memory().unwrap();
        let n = note(&mut conn);
        create(&conn, &depense(Some(n), "Transport", 15_000)).unwrap();
        // Une charge générale du cabinet n'est rattachée à aucune facture.
        create(&conn, &depense(None, "Loyer", 120_000)).unwrap();

        assert_eq!(depenses::total_by_note(&conn, n).unwrap(), 15_000);
        assert_eq!(depenses::list_all(&conn).unwrap().len(), 2);
    }
}
