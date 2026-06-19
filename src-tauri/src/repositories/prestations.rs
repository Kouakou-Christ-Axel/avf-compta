use crate::error::{AppError, AppResult};
use crate::models::{NewPrestation, Prestation};
use rusqlite::{Connection, Row};

fn map_row(row: &Row) -> rusqlite::Result<Prestation> {
    Ok(Prestation {
        id: row.get("id")?,
        libelle: row.get("libelle")?,
        prix: row.get("prix")?,
        actif: row.get::<_, i64>("actif")? != 0,
        cree_le: row.get("cree_le")?,
    })
}

pub fn create(conn: &Connection, p: &NewPrestation) -> AppResult<i64> {
    if p.libelle.trim().is_empty() {
        return Err(AppError::Validation("le libellé est requis".into()));
    }
    if p.prix < 0 {
        return Err(AppError::Validation("le prix ne peut être négatif".into()));
    }
    conn.execute(
        "INSERT INTO prestations (libelle, prix, actif, cree_le)
         VALUES (?1, ?2, 1, ?3)",
        rusqlite::params![p.libelle, p.prix, super::now()],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Prestation> {
    conn.query_row("SELECT * FROM prestations WHERE id = ?1", [id], map_row)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("prestation {id}")),
            other => other.into(),
        })
}

pub fn list(conn: &Connection) -> AppResult<Vec<Prestation>> {
    let mut stmt = conn.prepare("SELECT * FROM prestations ORDER BY libelle COLLATE NOCASE")?;
    let rows = stmt.query_map([], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn update(conn: &Connection, p: &Prestation) -> AppResult<()> {
    if p.prix < 0 {
        return Err(AppError::Validation("le prix ne peut être négatif".into()));
    }
    let n = conn.execute(
        "UPDATE prestations SET libelle=?1, prix=?2, actif=?3 WHERE id=?4",
        rusqlite::params![p.libelle, p.prix, p.actif as i64, p.id],
    )?;
    if n == 0 {
        return Err(AppError::NotFound(format!("prestation {}", p.id)));
    }
    Ok(())
}

pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    let n = conn.execute("DELETE FROM prestations WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(AppError::NotFound(format!("prestation {id}")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    fn sample() -> NewPrestation {
        NewPrestation {
            libelle: "Bilan annuel".into(),
            prix: 150_000,
        }
    }

    #[test]
    fn create_then_get_round_trips_price() {
        let conn = open_in_memory().unwrap();
        let id = create(&conn, &sample()).unwrap();
        let p = get(&conn, id).unwrap();
        assert_eq!(p.prix, 150_000);
        assert!(p.actif);
    }

    #[test]
    fn create_rejects_negative_price() {
        let conn = open_in_memory().unwrap();
        let p = NewPrestation {
            libelle: "X".into(),
            prix: -1,
        };
        assert!(matches!(create(&conn, &p), Err(AppError::Validation(_))));
    }

    #[test]
    fn update_and_delete() {
        let conn = open_in_memory().unwrap();
        let id = create(&conn, &sample()).unwrap();
        let mut p = get(&conn, id).unwrap();
        p.prix = 200_000;
        p.actif = false;
        update(&conn, &p).unwrap();
        let p = get(&conn, id).unwrap();
        assert_eq!(p.prix, 200_000);
        assert!(!p.actif);
        delete(&conn, id).unwrap();
        assert!(matches!(get(&conn, id), Err(AppError::NotFound(_))));
    }
}
