use crate::error::{AppError, AppResult};
use crate::models::NewNote;
use crate::repositories::prestations;
use rusqlite::Connection;

/// Statut initial d'une note de frais.
pub const STATUT_EMISE: &str = "emise";

/// Crée une note de frais et ses lignes de façon **atomique** : le libellé et
/// le prix de chaque prestation sont figés (snapshot). Si une prestation est
/// introuvable, toute la transaction est annulée (aucune note orpheline).
pub fn create_note(conn: &mut Connection, n: &NewNote) -> AppResult<i64> {
    if n.lignes.is_empty() {
        return Err(AppError::Validation(
            "une note doit comporter au moins une ligne".into(),
        ));
    }
    for l in &n.lignes {
        if l.quantite <= 0 {
            return Err(AppError::Validation(
                "la quantité doit être strictement positive".into(),
            ));
        }
    }

    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO notes_de_frais (client_id, reference, date_emission, statut, cree_le)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            n.client_id,
            n.reference,
            n.date_emission,
            STATUT_EMISE,
            crate::repositories::now()
        ],
    )?;
    let note_id = tx.last_insert_rowid();

    for l in &n.lignes {
        // Snapshot du libellé et du prix au moment de l'ajout.
        let p = prestations::get(&tx, l.prestation_id)?;
        tx.execute(
            "INSERT INTO note_lignes
                (note_id, prestation_id, libelle_snapshot, prix_snapshot, quantite)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![note_id, p.id, p.libelle, p.prix, l.quantite],
        )?;
    }

    tx.commit()?;
    Ok(note_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::models::note::NewNoteLigne;
    use crate::models::{NewClient, NewPrestation};
    use crate::repositories::{clients, notes, prestations};

    fn seed(conn: &Connection) -> (i64, i64) {
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
        (client, presta)
    }

    fn new_note(client_id: i64, prestation_id: i64, qte: i64) -> NewNote {
        NewNote {
            client_id,
            reference: Some("N-001".into()),
            date_emission: "2026-06-18".into(),
            lignes: vec![NewNoteLigne {
                prestation_id,
                quantite: qte,
            }],
        }
    }

    #[test]
    fn total_is_sum_of_lines() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let id = create_note(&mut conn, &new_note(client, presta, 3)).unwrap();
        assert_eq!(notes::total(&conn, id).unwrap(), 30_000);
    }

    #[test]
    fn price_is_snapshotted() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let id = create_note(&mut conn, &new_note(client, presta, 1)).unwrap();
        // Le prix de la prestation change après coup…
        let mut p = prestations::get(&conn, presta).unwrap();
        p.prix = 99_999;
        prestations::update(&conn, &p).unwrap();
        // …mais le total de la note historique reste inchangé.
        assert_eq!(notes::total(&conn, id).unwrap(), 10_000);
    }

    #[test]
    fn missing_prestation_rolls_back() {
        let mut conn = open_in_memory().unwrap();
        let (client, _) = seed(&conn);
        let note = new_note(client, 9999, 1);
        assert!(matches!(
            create_note(&mut conn, &note),
            Err(AppError::NotFound(_))
        ));
        // Aucune note orpheline créée.
        assert_eq!(notes::list(&conn).unwrap().len(), 0);
    }

    #[test]
    fn rejects_empty_or_bad_quantity() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let mut empty = new_note(client, presta, 1);
        empty.lignes.clear();
        assert!(matches!(
            create_note(&mut conn, &empty),
            Err(AppError::Validation(_))
        ));
        assert!(matches!(
            create_note(&mut conn, &new_note(client, presta, 0)),
            Err(AppError::Validation(_))
        ));
    }
}
