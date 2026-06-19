use crate::error::AppResult;
use crate::models::Recu;
use rusqlite::{Connection, Row};

fn map_row(row: &Row) -> rusqlite::Result<Recu> {
    Ok(Recu {
        id: row.get("id")?,
        paiement_id: row.get("paiement_id")?,
        numero: row.get("numero")?,
        emis_le: row.get("emis_le")?,
    })
}

pub fn insert(conn: &Connection, paiement_id: i64, numero: &str) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO recus (paiement_id, numero, emis_le) VALUES (?1, ?2, ?3)",
        rusqlite::params![paiement_id, numero, super::now()],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Recu> {
    Ok(conn.query_row("SELECT * FROM recus WHERE id = ?1", [id], map_row)?)
}

pub fn list(conn: &Connection) -> AppResult<Vec<Recu>> {
    let mut stmt = conn.prepare("SELECT * FROM recus ORDER BY id DESC")?;
    let rows = stmt.query_map([], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Nombre de reçus déjà émis (sert à la numérotation séquentielle).
pub fn count(conn: &Connection) -> AppResult<i64> {
    Ok(conn.query_row("SELECT COUNT(*) FROM recus", [], |r| r.get(0))?)
}
