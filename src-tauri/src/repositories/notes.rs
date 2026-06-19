use crate::error::{AppError, AppResult};
use crate::models::{NoteDeFrais, NoteDetail, NoteLigne};
use rusqlite::{Connection, Row};

fn map_note(row: &Row) -> rusqlite::Result<NoteDeFrais> {
    Ok(NoteDeFrais {
        id: row.get("id")?,
        client_id: row.get("client_id")?,
        reference: row.get("reference")?,
        date_emission: row.get("date_emission")?,
        statut: row.get("statut")?,
        cree_le: row.get("cree_le")?,
    })
}

fn map_ligne(row: &Row) -> rusqlite::Result<NoteLigne> {
    Ok(NoteLigne {
        id: row.get("id")?,
        note_id: row.get("note_id")?,
        prestation_id: row.get("prestation_id")?,
        libelle_snapshot: row.get("libelle_snapshot")?,
        prix_snapshot: row.get("prix_snapshot")?,
        quantite: row.get("quantite")?,
    })
}

pub fn get(conn: &Connection, id: i64) -> AppResult<NoteDeFrais> {
    conn.query_row("SELECT * FROM notes_de_frais WHERE id = ?1", [id], map_note)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("note {id}")),
            other => other.into(),
        })
}

pub fn list(conn: &Connection) -> AppResult<Vec<NoteDeFrais>> {
    let mut stmt =
        conn.prepare("SELECT * FROM notes_de_frais ORDER BY date_emission DESC, id DESC")?;
    let rows = stmt.query_map([], map_note)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn lignes(conn: &Connection, note_id: i64) -> AppResult<Vec<NoteLigne>> {
    let mut stmt = conn.prepare("SELECT * FROM note_lignes WHERE note_id = ?1 ORDER BY id")?;
    let rows = stmt.query_map([note_id], map_ligne)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Total facturé d'une note (Σ prix_snapshot × quantité), en francs CFA.
pub fn total(conn: &Connection, note_id: i64) -> AppResult<i64> {
    let total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(prix_snapshot * quantite), 0)
         FROM note_lignes WHERE note_id = ?1",
        [note_id],
        |r| r.get(0),
    )?;
    Ok(total)
}

pub fn detail(conn: &Connection, id: i64) -> AppResult<NoteDetail> {
    let note = get(conn, id)?;
    let lignes = lignes(conn, id)?;
    let total = total(conn, id)?;
    Ok(NoteDetail {
        note,
        lignes,
        total,
    })
}

pub fn set_statut(conn: &Connection, id: i64, statut: &str) -> AppResult<()> {
    let n = conn.execute(
        "UPDATE notes_de_frais SET statut = ?1 WHERE id = ?2",
        rusqlite::params![statut, id],
    )?;
    if n == 0 {
        return Err(AppError::NotFound(format!("note {id}")));
    }
    Ok(())
}

pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    let n = conn.execute("DELETE FROM notes_de_frais WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(AppError::NotFound(format!("note {id}")));
    }
    Ok(())
}
