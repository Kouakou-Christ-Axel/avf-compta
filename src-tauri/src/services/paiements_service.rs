use crate::error::{AppError, AppResult};
use crate::models::{NewPaiement, SoldeNote};
use crate::repositories::{notes, paiements};
use rusqlite::Connection;

pub const STATUT_PAYEE: &str = "payee";
pub const STATUT_EMISE: &str = "emise";

/// Calcule le solde d'une note : total facturé, encaissé et reste dû.
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
        payee: solde <= 0 && total > 0,
    })
}

/// Enregistre un paiement contre une note, en refusant tout sur-paiement, puis
/// met à jour le statut de la note (payée si le solde atteint zéro).
pub fn enregistrer(conn: &Connection, p: &NewPaiement) -> AppResult<i64> {
    if p.montant <= 0 {
        return Err(AppError::Validation(
            "le montant du paiement doit être positif".into(),
        ));
    }
    let s = solde(conn, p.note_id)?;
    if p.montant > s.solde {
        return Err(AppError::Validation(format!(
            "sur-paiement refusé: solde dû {} FCFA, paiement {} FCFA",
            s.solde, p.montant
        )));
    }

    let id = paiements::insert(
        conn,
        p.note_id,
        p.montant,
        &p.date_paiement,
        p.methode.as_deref(),
    )?;

    let after = solde(conn, p.note_id)?;
    let statut = if after.payee {
        STATUT_PAYEE
    } else {
        STATUT_EMISE
    };
    notes::set_statut(conn, p.note_id, statut)?;

    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::models::note::NewNoteLigne;
    use crate::models::{NewClient, NewNote, NewPrestation};
    use crate::repositories::{clients, prestations};
    use crate::services::notes_service;

    /// Crée une note de 30 000 centimes (3 × 10 000) et renvoie son id.
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
                lignes: vec![NewNoteLigne {
                    prestation_id: presta,
                    quantite: 3,
                }],
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
        enregistrer(&conn, &paiement(note, 10_000)).unwrap();
        let s = solde(&conn, note).unwrap();
        assert_eq!(s.paye, 10_000);
        assert_eq!(s.solde, 20_000);
        assert!(!s.payee);
        assert_eq!(notes::get(&conn, note).unwrap().statut, STATUT_EMISE);
    }

    #[test]
    fn full_payment_marks_note_paid() {
        let mut conn = open_in_memory().unwrap();
        let note = note_de_300(&mut conn);
        enregistrer(&conn, &paiement(note, 20_000)).unwrap();
        enregistrer(&conn, &paiement(note, 10_000)).unwrap();
        let s = solde(&conn, note).unwrap();
        assert_eq!(s.solde, 0);
        assert!(s.payee);
        assert_eq!(notes::get(&conn, note).unwrap().statut, STATUT_PAYEE);
    }

    #[test]
    fn overpayment_is_rejected() {
        let mut conn = open_in_memory().unwrap();
        let note = note_de_300(&mut conn);
        assert!(matches!(
            enregistrer(&conn, &paiement(note, 30_001)),
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
            enregistrer(&conn, &paiement(note, 0)),
            Err(AppError::Validation(_))
        ));
    }
}
