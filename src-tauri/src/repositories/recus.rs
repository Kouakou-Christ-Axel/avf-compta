use crate::error::{AppError, AppResult};
use crate::models::{Recu, RecuDetail};
use rusqlite::{Connection, Row};

fn map_row(row: &Row) -> rusqlite::Result<Recu> {
    Ok(Recu {
        id: row.get("id")?,
        paiement_id: row.get("paiement_id")?,
        numero: row.get("numero")?,
        emis_le: row.get("emis_le")?,
    })
}

/// Reçu enrichi (client + note + paiement) pour l'impression.
pub fn detail(conn: &Connection, id: i64) -> AppResult<RecuDetail> {
    conn.query_row(
        "SELECT r.id, r.numero, r.emis_le,
                p.montant, p.date_paiement, p.methode,
                n.id AS note_id, n.reference AS note_reference,
                c.nom AS client_nom, c.email AS client_email,
                c.telephone AS client_telephone
         FROM recus r
         JOIN paiements p      ON p.id = r.paiement_id
         JOIN notes_de_frais n ON n.id = p.note_id
         JOIN clients c        ON c.id = n.client_id
         WHERE r.id = ?1",
        [id],
        |row| {
            Ok(RecuDetail {
                id: row.get("id")?,
                numero: row.get("numero")?,
                emis_le: row.get("emis_le")?,
                montant: row.get("montant")?,
                date_paiement: row.get("date_paiement")?,
                methode: row.get("methode")?,
                note_id: row.get("note_id")?,
                note_reference: row.get("note_reference")?,
                client_nom: row.get("client_nom")?,
                client_email: row.get("client_email")?,
                client_telephone: row.get("client_telephone")?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("reçu {id}")),
        other => other.into(),
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::models::note::NewNoteLigne;
    use crate::models::{NewClient, NewNote, NewPaiement, NewPrestation};
    use crate::repositories::{clients, prestations};
    use crate::services::{notes_service, paiements_service, recus_service};

    #[test]
    fn detail_joins_client_note_and_paiement() {
        let mut conn = open_in_memory().unwrap();
        let client = clients::create(
            &conn,
            &NewClient {
                nom: "Acme".into(),
                email: Some("a@acme.fr".into()),
                telephone: Some("0102030405".into()),
                adresse: None,
            },
        )
        .unwrap();
        let presta = prestations::create(
            &conn,
            &NewPrestation {
                libelle: "Conseil".into(),
                prix: 50_000,
            },
        )
        .unwrap();
        let note = notes_service::create_note(
            &mut conn,
            &NewNote {
                client_id: client,
                reference: Some("N-1".into()),
                date_emission: "2026-06-18".into(),
                lignes: vec![NewNoteLigne {
                    prestation_id: presta,
                    quantite: 1,
                }],
            },
        )
        .unwrap();
        let paiement = paiements_service::enregistrer(
            &conn,
            &NewPaiement {
                note_id: note,
                montant: 50_000,
                date_paiement: "2026-06-18".into(),
                methode: Some("espèces".into()),
            },
        )
        .unwrap();
        let recu = recus_service::generer(&conn, paiement).unwrap();

        let d = detail(&conn, recu.id).unwrap();
        assert_eq!(d.numero, "RECU-0001");
        assert_eq!(d.montant, 50_000);
        assert_eq!(d.client_nom, "Acme");
        assert_eq!(d.client_telephone.as_deref(), Some("0102030405"));
        assert_eq!(d.note_reference.as_deref(), Some("N-1"));
        assert_eq!(d.methode.as_deref(), Some("espèces"));
    }

    #[test]
    fn detail_missing_is_not_found() {
        let conn = open_in_memory().unwrap();
        assert!(matches!(detail(&conn, 999), Err(AppError::NotFound(_))));
    }
}
