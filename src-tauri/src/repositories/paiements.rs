use crate::error::{AppError, AppResult};
use crate::models::Paiement;
use rusqlite::{Connection, Row};

fn map_row(row: &Row) -> rusqlite::Result<Paiement> {
    Ok(Paiement {
        id: row.get("id")?,
        note_id: row.get("note_id")?,
        montant: row.get("montant")?,
        date_paiement: row.get("date_paiement")?,
        methode: row.get("methode")?,
        annule: row.get::<_, i64>("annule")? != 0,
        cree_le: row.get("cree_le")?,
    })
}

pub fn insert(
    conn: &Connection,
    note_id: i64,
    montant: i64,
    date_paiement: &str,
    methode: Option<&str>,
) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO paiements (note_id, montant, date_paiement, methode, cree_le)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![note_id, montant, date_paiement, methode, super::now()],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Paiement> {
    Ok(conn.query_row("SELECT * FROM paiements WHERE id = ?1", [id], map_row)?)
}

pub fn list_by_note(conn: &Connection, note_id: i64) -> AppResult<Vec<Paiement>> {
    let mut stmt =
        conn.prepare("SELECT * FROM paiements WHERE note_id = ?1 ORDER BY date_paiement, id")?;
    let rows = stmt.query_map([note_id], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Total déjà encaissé pour une note (paiements non annulés, francs CFA).
pub fn total_paye(conn: &Connection, note_id: i64) -> AppResult<i64> {
    let total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(montant), 0) FROM paiements WHERE note_id = ?1 AND annule = 0",
        [note_id],
        |r| r.get(0),
    )?;
    Ok(total)
}

/// Annule un paiement (le retire des totaux/soldes). Renvoie la note associée.
pub fn annuler(conn: &Connection, id: i64) -> AppResult<i64> {
    let note_id: i64 = conn
        .query_row("SELECT note_id FROM paiements WHERE id = ?1", [id], |r| {
            r.get(0)
        })
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("paiement {id}")),
            other => other.into(),
        })?;
    conn.execute("UPDATE paiements SET annule = 1 WHERE id = ?1", [id])?;
    Ok(note_id)
}
