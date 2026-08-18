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

/// Prestations encore proposées à la facturation (les archivées sont exclues).
/// Les factures déjà émises ne bougent pas : leur libellé et leur prix y sont
/// figés (`note_lignes.libelle_snapshot` / `prix_snapshot`).
pub fn list_actives(conn: &Connection) -> AppResult<Vec<Prestation>> {
    let mut stmt =
        conn.prepare("SELECT * FROM prestations WHERE actif = 1 ORDER BY libelle COLLATE NOCASE")?;
    let rows = stmt.query_map([], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Archive (`actif = false`) ou réactive une prestation. Alternative sûre à la
/// suppression, qui échoue dès que la prestation a déjà été facturée.
pub fn set_actif(conn: &Connection, id: i64, actif: bool) -> AppResult<()> {
    let n = conn.execute(
        "UPDATE prestations SET actif = ?1 WHERE id = ?2",
        rusqlite::params![actif as i64, id],
    )?;
    if n == 0 {
        return Err(AppError::NotFound(format!("prestation {id}")));
    }
    Ok(())
}

/// Nombre de fois où la prestation apparaît sur une facture : au-delà de zéro
/// la suppression est impossible (clé étrangère) et il faut archiver.
pub fn nb_utilisations(conn: &Connection, id: i64) -> AppResult<i64> {
    Ok(conn.query_row(
        "SELECT COUNT(*) FROM note_lignes WHERE prestation_id = ?1",
        [id],
        |r| r.get(0),
    )?)
}

pub fn update(conn: &Connection, p: &Prestation) -> AppResult<()> {
    if p.libelle.trim().is_empty() {
        return Err(AppError::Validation("le libellé est requis".into()));
    }
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
    let utilisations = nb_utilisations(conn, id)?;
    if utilisations > 0 {
        return Err(AppError::Validation(format!(
            "cette prestation figure sur {utilisations} ligne(s) de facture et ne peut pas \
             être supprimée. Archivez-la pour qu'elle disparaisse des nouvelles factures."
        )));
    }
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

    /// Une prestation archivée disparaît des nouvelles factures mais reste
    /// visible dans la gestion des prestations.
    #[test]
    fn archiver_retire_de_la_liste_active() {
        let conn = open_in_memory().unwrap();
        let id = create(
            &conn,
            &NewPrestation {
                libelle: "Bilan".into(),
                prix: 50_000,
            },
        )
        .unwrap();

        assert_eq!(list_actives(&conn).unwrap().len(), 1);
        set_actif(&conn, id, false).unwrap();
        assert!(list_actives(&conn).unwrap().is_empty());
        assert_eq!(list(&conn).unwrap().len(), 1);
        assert!(!get(&conn, id).unwrap().actif);

        set_actif(&conn, id, true).unwrap();
        assert_eq!(list_actives(&conn).unwrap().len(), 1);
    }

    /// Supprimer une prestation déjà facturée renvoie un message clair au lieu
    /// de l'erreur SQLite « FOREIGN KEY constraint failed ».
    #[test]
    fn suppression_refusee_si_deja_facturee() {
        use crate::models::note::NewNoteLigne;
        use crate::models::{NewClient, NewNote};
        use crate::repositories::clients;
        use crate::services::notes_service;

        let mut conn = open_in_memory().unwrap();
        let client = clients::create(
            &conn,
            &NewClient {
                nom: "Acme".into(),
                email: None,
                telephone: None,
                adresse: None,
            },
        )
        .unwrap();
        let presta = create(
            &conn,
            &NewPrestation {
                libelle: "Bilan".into(),
                prix: 50_000,
            },
        )
        .unwrap();
        notes_service::create_note(
            &mut conn,
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
        .unwrap();

        match delete(&conn, presta).unwrap_err() {
            AppError::Validation(msg) => assert!(msg.contains("Archivez")),
            other => panic!("expected Validation error, got {other:?}"),
        }
    }
}
