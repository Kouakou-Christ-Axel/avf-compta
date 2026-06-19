pub mod migrations;

use crate::error::AppResult;
use rusqlite::Connection;
use std::path::Path;

/// Active les contraintes de clés étrangères (OFF par défaut dans SQLite, par
/// connexion) puis applique les migrations en attente.
fn prepare(conn: &mut Connection) -> AppResult<()> {
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrations::migrations().to_latest(conn)?;
    Ok(())
}

/// Ouvre la base au chemin donné, prête à l'emploi (FK actives + migrations).
pub fn open<P: AsRef<Path>>(path: P) -> AppResult<Connection> {
    let mut conn = Connection::open(path)?;
    prepare(&mut conn)?;
    Ok(conn)
}

/// Ouvre une base en mémoire (tests), prête à l'emploi.
#[cfg(test)]
pub fn open_in_memory() -> AppResult<Connection> {
    let mut conn = Connection::open_in_memory()?;
    prepare(&mut conn)?;
    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table_exists(conn: &Connection, name: &str) -> bool {
        conn.query_row(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1",
            [name],
            |_| Ok(()),
        )
        .is_ok()
    }

    #[test]
    fn open_in_memory_creates_all_tables() {
        let conn = open_in_memory().unwrap();
        for t in [
            "clients",
            "prestations",
            "notes_de_frais",
            "note_lignes",
            "paiements",
            "recus",
        ] {
            assert!(table_exists(&conn, t), "table manquante: {t}");
        }
    }

    #[test]
    fn foreign_keys_are_enabled() {
        let conn = open_in_memory().unwrap();
        let on: i64 = conn
            .query_row("PRAGMA foreign_keys", [], |r| r.get(0))
            .unwrap();
        assert_eq!(on, 1);
    }

    #[test]
    fn migrations_are_idempotent() {
        let mut conn = Connection::open_in_memory().unwrap();
        prepare(&mut conn).unwrap();
        // Re-appliquer ne doit pas échouer ni recréer les tables.
        let res = migrations::migrations().to_latest(&mut conn);
        assert!(res.is_ok());
    }
}
