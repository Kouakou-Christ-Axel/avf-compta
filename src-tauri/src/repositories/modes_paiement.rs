use crate::error::{AppError, AppResult};
use crate::models::ModePaiement;
use rusqlite::Connection;

pub fn list(conn: &Connection) -> AppResult<Vec<ModePaiement>> {
    let mut stmt =
        conn.prepare("SELECT id, libelle FROM modes_paiement ORDER BY libelle COLLATE NOCASE")?;
    let rows = stmt.query_map([], |row| {
        Ok(ModePaiement {
            id: row.get("id")?,
            libelle: row.get("libelle")?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn create(conn: &Connection, libelle: &str) -> AppResult<i64> {
    if libelle.trim().is_empty() {
        return Err(AppError::Validation("le libellé est requis".into()));
    }
    conn.execute(
        "INSERT INTO modes_paiement (libelle) VALUES (?1)",
        [libelle.trim()],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    let n = conn.execute("DELETE FROM modes_paiement WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(AppError::NotFound(format!("mode {id}")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    #[test]
    fn create_list_delete() {
        let conn = open_in_memory().unwrap();
        // La base neuve est pré-remplie avec les modes usuels (migration v13).
        let depart = list(&conn).unwrap().len();
        let id = create(&conn, "Wave").unwrap();
        create(&conn, "Orange Money").unwrap();
        assert_eq!(list(&conn).unwrap().len(), depart + 2);
        delete(&conn, id).unwrap();
        assert_eq!(list(&conn).unwrap().len(), depart + 1);
        assert!(matches!(create(&conn, " "), Err(AppError::Validation(_))));
    }
}
