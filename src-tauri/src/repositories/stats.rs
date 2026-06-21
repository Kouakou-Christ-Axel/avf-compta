use crate::error::AppResult;
use crate::models::{ResumeStats, StatMois};
use rusqlite::Connection;
use std::collections::BTreeMap;

// Les notes annulées (statut « annulee ») et les paiements annulés sont exclus.
pub fn resume(conn: &Connection) -> AppResult<ResumeStats> {
    let nb_clients: i64 = conn.query_row("SELECT COUNT(*) FROM clients", [], |r| r.get(0))?;
    let nb_notes: i64 = conn.query_row(
        "SELECT COUNT(*) FROM notes_de_frais WHERE statut != 'annulee'",
        [],
        |r| r.get(0),
    )?;
    let total_facture: i64 = conn.query_row(
        "SELECT COALESCE(SUM(l.prix_snapshot * l.quantite), 0)
         FROM note_lignes l JOIN notes_de_frais n ON n.id = l.note_id
         WHERE n.statut != 'annulee'",
        [],
        |r| r.get(0),
    )?;
    let total_encaisse: i64 = conn.query_row(
        "SELECT COALESCE(SUM(p.montant), 0)
         FROM paiements p JOIN notes_de_frais n ON n.id = p.note_id
         WHERE p.annule = 0 AND n.statut != 'annulee'",
        [],
        |r| r.get(0),
    )?;
    // Impayé = Σ par note de max(0, facturé − encaissé).
    let total_impaye: i64 = conn.query_row(
        "SELECT COALESCE(SUM(CASE WHEN diff > 0 THEN diff ELSE 0 END), 0) FROM (
            SELECT
              (SELECT COALESCE(SUM(prix_snapshot * quantite), 0)
                 FROM note_lignes l WHERE l.note_id = n.id)
              -
              (SELECT COALESCE(SUM(montant), 0)
                 FROM paiements p WHERE p.note_id = n.id AND p.annule = 0) AS diff
            FROM notes_de_frais n
            WHERE n.statut != 'annulee'
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

/// Série mensuelle : chiffre d'affaires (facturé), dépenses et marge par mois
/// (« YYYY-MM »), notes annulées exclues.
pub fn mensuelles(conn: &Connection) -> AppResult<Vec<StatMois>> {
    let mut par_mois: BTreeMap<String, (i64, i64)> = BTreeMap::new();

    let mut stmt = conn.prepare(
        "SELECT substr(n.date_emission, 1, 7) AS mois,
                COALESCE(SUM(l.prix_snapshot * l.quantite), 0) AS ca
         FROM notes_de_frais n JOIN note_lignes l ON l.note_id = n.id
         WHERE n.statut != 'annulee'
         GROUP BY mois",
    )?;
    for row in stmt.query_map([], |r| {
        Ok((r.get::<_, String>("mois")?, r.get::<_, i64>("ca")?))
    })? {
        let (mois, ca) = row?;
        par_mois.entry(mois).or_default().0 = ca;
    }

    let mut stmt = conn.prepare(
        "SELECT substr(d.date_depense, 1, 7) AS mois,
                COALESCE(SUM(d.montant), 0) AS dep
         FROM depenses d JOIN notes_de_frais n ON n.id = d.note_id
         WHERE n.statut != 'annulee'
         GROUP BY mois",
    )?;
    for row in stmt.query_map([], |r| {
        Ok((r.get::<_, String>("mois")?, r.get::<_, i64>("dep")?))
    })? {
        let (mois, dep) = row?;
        par_mois.entry(mois).or_default().1 = dep;
    }

    Ok(par_mois
        .into_iter()
        .map(|(mois, (ca, depenses))| StatMois {
            mois,
            ca,
            depenses,
            marge: ca - depenses,
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    #[test]
    fn empty_db_returns_zeros() {
        let conn = open_in_memory().unwrap();
        assert_eq!(resume(&conn).unwrap(), ResumeStats::default());
        assert!(mensuelles(&conn).unwrap().is_empty());
    }
}
