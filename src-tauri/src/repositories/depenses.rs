use crate::error::{AppError, AppResult};
use crate::models::{Depense, NewDepense};
use rusqlite::{Connection, Row};

fn map_row(row: &Row) -> rusqlite::Result<Depense> {
    Ok(Depense {
        id: row.get("id")?,
        note_id: row.get("note_id")?,
        libelle: row.get("libelle")?,
        montant: row.get("montant")?,
        date_depense: row.get("date_depense")?,
        cree_le: row.get("cree_le")?,
    })
}

pub fn create(conn: &Connection, d: &NewDepense) -> AppResult<i64> {
    if d.libelle.trim().is_empty() {
        return Err(AppError::Validation("le libellé est requis".into()));
    }
    if d.montant <= 0 {
        return Err(AppError::Validation(
            "le montant de la dépense doit être positif".into(),
        ));
    }
    conn.execute(
        "INSERT INTO depenses (note_id, libelle, montant, date_depense, cree_le)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            d.note_id,
            d.libelle,
            d.montant,
            d.date_depense,
            super::now()
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn list_by_note(conn: &Connection, note_id: i64) -> AppResult<Vec<Depense>> {
    let mut stmt =
        conn.prepare("SELECT * FROM depenses WHERE note_id = ?1 ORDER BY date_depense, id")?;
    let rows = stmt.query_map([note_id], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Cumul des dépenses liées à une note (francs CFA).
pub fn total_by_note(conn: &Connection, note_id: i64) -> AppResult<i64> {
    Ok(conn.query_row(
        "SELECT COALESCE(SUM(montant), 0) FROM depenses WHERE note_id = ?1",
        [note_id],
        |r| r.get(0),
    )?)
}

pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    let n = conn.execute("DELETE FROM depenses WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(AppError::NotFound(format!("dépense {id}")));
    }
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

    fn note_avec_total(conn: &mut Connection) -> i64 {
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
            },
        )
        .unwrap()
    }

    #[test]
    fn create_list_and_total() {
        let mut conn = open_in_memory().unwrap();
        let note = note_avec_total(&mut conn);
        create(
            &conn,
            &NewDepense {
                note_id: note,
                libelle: "Transport".into(),
                montant: 15_000,
                date_depense: "2026-06-18".into(),
            },
        )
        .unwrap();
        create(
            &conn,
            &NewDepense {
                note_id: note,
                libelle: "Fournitures".into(),
                montant: 5_000,
                date_depense: "2026-06-18".into(),
            },
        )
        .unwrap();
        assert_eq!(list_by_note(&conn, note).unwrap().len(), 2);
        assert_eq!(total_by_note(&conn, note).unwrap(), 20_000);
    }

    #[test]
    fn rejects_invalid() {
        let mut conn = open_in_memory().unwrap();
        let note = note_avec_total(&mut conn);
        assert!(matches!(
            create(
                &conn,
                &NewDepense {
                    note_id: note,
                    libelle: " ".into(),
                    montant: 1_000,
                    date_depense: "2026-06-18".into(),
                },
            ),
            Err(AppError::Validation(_))
        ));
        assert!(matches!(
            create(
                &conn,
                &NewDepense {
                    note_id: note,
                    libelle: "X".into(),
                    montant: 0,
                    date_depense: "2026-06-18".into(),
                },
            ),
            Err(AppError::Validation(_))
        ));
    }
}
