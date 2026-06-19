use crate::error::{AppError, AppResult};
use crate::models::{Client, ClientResume, NewClient};
use rusqlite::{Connection, Row};

fn map_row(row: &Row) -> rusqlite::Result<Client> {
    Ok(Client {
        id: row.get("id")?,
        nom: row.get("nom")?,
        email: row.get("email")?,
        telephone: row.get("telephone")?,
        adresse: row.get("adresse")?,
        cree_le: row.get("cree_le")?,
    })
}

pub fn create(conn: &Connection, c: &NewClient) -> AppResult<i64> {
    if c.nom.trim().is_empty() {
        return Err(AppError::Validation("le nom du client est requis".into()));
    }
    conn.execute(
        "INSERT INTO clients (nom, email, telephone, adresse, cree_le)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![c.nom, c.email, c.telephone, c.adresse, super::now()],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Client> {
    conn.query_row("SELECT * FROM clients WHERE id = ?1", [id], map_row)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("client {id}")),
            other => other.into(),
        })
}

pub fn list(conn: &Connection) -> AppResult<Vec<Client>> {
    let mut stmt = conn.prepare("SELECT * FROM clients ORDER BY nom COLLATE NOCASE")?;
    let rows = stmt.query_map([], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Récapitulatif par client : cumul facturé (notes), cumul encaissé, restant.
pub fn list_resume(conn: &Connection) -> AppResult<Vec<ClientResume>> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.nom, c.email, c.telephone,
                COALESCE((SELECT SUM(l.prix_snapshot * l.quantite)
                          FROM note_lignes l
                          JOIN notes_de_frais n ON n.id = l.note_id
                          WHERE n.client_id = c.id), 0) AS total_facture,
                COALESCE((SELECT SUM(p.montant)
                          FROM paiements p
                          JOIN notes_de_frais n ON n.id = p.note_id
                          WHERE n.client_id = c.id), 0) AS total_paye
         FROM clients c
         ORDER BY c.nom COLLATE NOCASE",
    )?;
    let rows = stmt.query_map([], |row| {
        let total_facture: i64 = row.get("total_facture")?;
        let total_paye: i64 = row.get("total_paye")?;
        Ok(ClientResume {
            id: row.get("id")?,
            nom: row.get("nom")?,
            email: row.get("email")?,
            telephone: row.get("telephone")?,
            total_facture,
            total_paye,
            solde: total_facture - total_paye,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn update(conn: &Connection, c: &Client) -> AppResult<()> {
    let n = conn.execute(
        "UPDATE clients SET nom=?1, email=?2, telephone=?3, adresse=?4 WHERE id=?5",
        rusqlite::params![c.nom, c.email, c.telephone, c.adresse, c.id],
    )?;
    if n == 0 {
        return Err(AppError::NotFound(format!("client {}", c.id)));
    }
    Ok(())
}

pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    let n = conn.execute("DELETE FROM clients WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(AppError::NotFound(format!("client {id}")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    fn sample() -> NewClient {
        NewClient {
            nom: "Acme SARL".into(),
            email: Some("contact@acme.fr".into()),
            telephone: None,
            adresse: None,
        }
    }

    #[test]
    fn create_then_get() {
        let conn = open_in_memory().unwrap();
        let id = create(&conn, &sample()).unwrap();
        let c = get(&conn, id).unwrap();
        assert_eq!(c.nom, "Acme SARL");
        assert_eq!(c.email.as_deref(), Some("contact@acme.fr"));
    }

    #[test]
    fn create_rejects_empty_name() {
        let conn = open_in_memory().unwrap();
        let mut c = sample();
        c.nom = "  ".into();
        assert!(matches!(create(&conn, &c), Err(AppError::Validation(_))));
    }

    #[test]
    fn get_missing_is_not_found() {
        let conn = open_in_memory().unwrap();
        assert!(matches!(get(&conn, 999), Err(AppError::NotFound(_))));
    }

    #[test]
    fn list_is_sorted_by_name() {
        let conn = open_in_memory().unwrap();
        for nom in ["Zeta", "alpha", "Mid"] {
            create(
                &conn,
                &NewClient {
                    nom: nom.into(),
                    email: None,
                    telephone: None,
                    adresse: None,
                },
            )
            .unwrap();
        }
        let noms: Vec<_> = list(&conn).unwrap().into_iter().map(|c| c.nom).collect();
        assert_eq!(noms, vec!["alpha", "Mid", "Zeta"]);
    }

    #[test]
    fn update_changes_fields() {
        let conn = open_in_memory().unwrap();
        let id = create(&conn, &sample()).unwrap();
        let mut c = get(&conn, id).unwrap();
        c.nom = "Acme SA".into();
        update(&conn, &c).unwrap();
        assert_eq!(get(&conn, id).unwrap().nom, "Acme SA");
    }

    #[test]
    fn delete_removes() {
        let conn = open_in_memory().unwrap();
        let id = create(&conn, &sample()).unwrap();
        delete(&conn, id).unwrap();
        assert!(matches!(get(&conn, id), Err(AppError::NotFound(_))));
        assert!(matches!(delete(&conn, id), Err(AppError::NotFound(_))));
    }

    #[test]
    fn list_resume_cumulates_facture_and_paye() {
        use crate::models::note::NewNoteLigne;
        use crate::models::{NewNote, NewPaiement, NewPrestation};
        use crate::repositories::prestations;
        use crate::services::{notes_service, paiements_service};

        let mut conn = open_in_memory().unwrap();
        let client = create(&conn, &sample()).unwrap();
        let presta = prestations::create(
            &conn,
            &NewPrestation {
                libelle: "Conseil".into(),
                prix: 100_000,
            },
        )
        .unwrap();
        let note = notes_service::create_note(
            &mut conn,
            &NewNote {
                client_id: client,
                date_emission: "2026-06-18".into(),
                echeance: None,
                lignes: vec![NewNoteLigne {
                    prestation_id: presta,
                    quantite: 2,
                }],
            },
        )
        .unwrap();
        paiements_service::enregistrer(
            &conn,
            &NewPaiement {
                note_id: note,
                montant: 50_000,
                date_paiement: "2026-06-18".into(),
                methode: None,
            },
        )
        .unwrap();

        let resume = list_resume(&conn).unwrap();
        assert_eq!(resume.len(), 1);
        assert_eq!(resume[0].total_facture, 200_000);
        assert_eq!(resume[0].total_paye, 50_000);
        assert_eq!(resume[0].solde, 150_000);
    }
}
