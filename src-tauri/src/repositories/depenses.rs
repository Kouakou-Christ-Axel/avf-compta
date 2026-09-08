use crate::error::{AppError, AppResult};
use crate::models::{Depense, DepenseLigne, NewDepense};
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

/// Insère une dépense. Les règles métier (libellé, montant, facture annulée)
/// sont appliquées par `services::depenses_service::create`.
pub fn insert(conn: &Connection, d: &NewDepense) -> AppResult<i64> {
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

/// Toutes les dépenses, avec la référence de leur note (export global).
pub fn list_all(conn: &Connection) -> AppResult<Vec<DepenseLigne>> {
    let mut stmt = conn.prepare(
        "SELECT d.id, d.note_id, n.reference AS note_reference,
                d.libelle, d.montant, d.date_depense
         FROM depenses d
         LEFT JOIN notes_de_frais n ON n.id = d.note_id
         ORDER BY d.date_depense DESC, d.id DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(DepenseLigne {
            id: row.get("id")?,
            note_id: row.get("note_id")?,
            note_reference: row.get("note_reference")?,
            libelle: row.get("libelle")?,
            montant: row.get("montant")?,
            date_depense: row.get("date_depense")?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
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
                remise_type: None,
                remise_valeur: 0,
            },
        )
        .unwrap()
    }

    #[test]
    fn create_list_and_total() {
        let mut conn = open_in_memory().unwrap();
        let note = note_avec_total(&mut conn);
        insert(
            &conn,
            &NewDepense {
                note_id: Some(note),
                libelle: "Transport".into(),
                montant: 15_000,
                date_depense: "2026-06-18".into(),
            },
        )
        .unwrap();
        insert(
            &conn,
            &NewDepense {
                note_id: Some(note),
                libelle: "Fournitures".into(),
                montant: 5_000,
                date_depense: "2026-06-18".into(),
            },
        )
        .unwrap();
        assert_eq!(list_by_note(&conn, note).unwrap().len(), 2);
        assert_eq!(total_by_note(&conn, note).unwrap(), 20_000);
    }

    /// Une charge générale du cabinet n'est rattachée à aucune facture.
    #[test]
    fn depense_sans_facture_est_acceptee() {
        let conn = open_in_memory().unwrap();
        let id = insert(
            &conn,
            &NewDepense {
                note_id: None,
                libelle: "Loyer du cabinet".into(),
                montant: 120_000,
                date_depense: "2026-06-01".into(),
            },
        )
        .unwrap();

        let toutes = list_all(&conn).unwrap();
        assert_eq!(toutes.len(), 1);
        assert_eq!(toutes[0].id, id);
        assert_eq!(toutes[0].note_id, None);
        assert_eq!(toutes[0].note_reference, None);
    }

    /// Elle compte dans les dépenses du mois au même titre que les autres.
    #[test]
    fn depense_sans_facture_compte_dans_les_stats() {
        use crate::repositories::stats;

        let conn = open_in_memory().unwrap();
        insert(
            &conn,
            &NewDepense {
                note_id: None,
                libelle: "Carburant".into(),
                montant: 25_000,
                date_depense: "2026-06-04".into(),
            },
        )
        .unwrap();

        let mois = stats::mensuelles(&conn).unwrap();
        assert_eq!(mois.len(), 1);
        assert_eq!(mois[0].mois, "2026-06");
        assert_eq!(mois[0].depenses, 25_000);
        assert_eq!(mois[0].marge, -25_000);
    }
}
