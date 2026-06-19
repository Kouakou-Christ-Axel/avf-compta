use crate::error::AppResult;
use crate::models::ResumeStats;
use rusqlite::Connection;

pub fn resume(conn: &Connection) -> AppResult<ResumeStats> {
    let nb_clients: i64 = conn.query_row("SELECT COUNT(*) FROM clients", [], |r| r.get(0))?;
    let nb_notes: i64 = conn.query_row("SELECT COUNT(*) FROM notes_de_frais", [], |r| r.get(0))?;
    let total_facture: i64 = conn.query_row(
        "SELECT COALESCE(SUM(prix_snapshot * quantite), 0) FROM note_lignes",
        [],
        |r| r.get(0),
    )?;
    let total_encaisse: i64 =
        conn.query_row("SELECT COALESCE(SUM(montant), 0) FROM paiements", [], |r| {
            r.get(0)
        })?;
    // Impayé = Σ par note de max(0, facturé − encaissé) : on ne compte pas les
    // éventuels trop-perçus comme un impayé négatif.
    let total_impaye: i64 = conn.query_row(
        "SELECT COALESCE(SUM(CASE WHEN diff > 0 THEN diff ELSE 0 END), 0) FROM (
            SELECT
              (SELECT COALESCE(SUM(prix_snapshot * quantite), 0)
                 FROM note_lignes l WHERE l.note_id = n.id)
              -
              (SELECT COALESCE(SUM(montant), 0)
                 FROM paiements p WHERE p.note_id = n.id) AS diff
            FROM notes_de_frais n
         )",
        [],
        |r| r.get(0),
    )?;

    Ok(ResumeStats {
        nb_clients,
        nb_notes,
        total_facture,
        total_encaisse,
        total_impaye,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    #[test]
    fn empty_db_returns_zeros() {
        let conn = open_in_memory().unwrap();
        assert_eq!(resume(&conn).unwrap(), ResumeStats::default());
    }
}
