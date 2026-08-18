use crate::error::{AppError, AppResult};
use crate::models::Paiement;
use rusqlite::{Connection, Row};

fn map_row(row: &Row) -> rusqlite::Result<Paiement> {
    Ok(Paiement {
        id: row.get("id")?,
        note_id: row.get("note_id")?,
        montant: row.get("montant")?,
        date_paiement: row.get("date_paiement")?,
        methode: row.get("methode")?,
        annule: row.get::<_, i64>("annule")? != 0,
        cree_le: row.get("cree_le")?,
        recu_id: row.get("recu_id")?,
        recu_numero: row.get("recu_numero")?,
    })
}

/// Colonnes du paiement enrichies du reçu éventuellement déjà émis, pour que
/// l'interface propose « Voir le reçu » plutôt que d'en générer un second.
const SELECT_PAIEMENT: &str = "SELECT p.*, r.id AS recu_id, r.numero AS recu_numero
     FROM paiements p LEFT JOIN recus r ON r.paiement_id = p.id";

pub fn insert(
    conn: &Connection,
    note_id: i64,
    montant: i64,
    date_paiement: &str,
    methode: Option<&str>,
) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO paiements (note_id, montant, date_paiement, methode, cree_le)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![note_id, montant, date_paiement, methode, super::now()],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Paiement> {
    conn.query_row(&format!("{SELECT_PAIEMENT} WHERE p.id = ?1"), [id], map_row)
        .map_err(|e| match e {
            // Sans ce mappage l'utilisateur lisait « introuvable: aucune
            // ligne », sans savoir de quoi il s'agissait.
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("paiement {id}")),
            other => other.into(),
        })
}

pub fn list_by_note(conn: &Connection, note_id: i64) -> AppResult<Vec<Paiement>> {
    let mut stmt = conn.prepare(&format!(
        "{SELECT_PAIEMENT} WHERE p.note_id = ?1 ORDER BY p.date_paiement, p.id"
    ))?;
    let rows = stmt.query_map([note_id], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Total déjà encaissé pour une note (paiements non annulés, francs CFA).
pub fn total_paye(conn: &Connection, note_id: i64) -> AppResult<i64> {
    let total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(montant), 0) FROM paiements WHERE note_id = ?1 AND annule = 0",
        [note_id],
        |r| r.get(0),
    )?;
    Ok(total)
}

/// Annule un paiement (le retire des totaux/soldes). Renvoie la note associée.
pub fn annuler(conn: &Connection, id: i64) -> AppResult<i64> {
    let note_id: i64 = conn
        .query_row("SELECT note_id FROM paiements WHERE id = ?1", [id], |r| {
            r.get(0)
        })
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("paiement {id}")),
            other => other.into(),
        })?;
    conn.execute("UPDATE paiements SET annule = 1 WHERE id = ?1", [id])?;
    Ok(note_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::models::note::NewNoteLigne;
    use crate::models::{NewClient, NewNote, NewPrestation};
    use crate::repositories::{clients, notes, prestations, recus};
    use crate::services::{notes_service, recus_service};

    /// Facture de 30 000 (3 × 10 000).
    fn seed(conn: &mut Connection) -> i64 {
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
                prix: 10_000,
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
                    quantite: 3,
                }],
                remise_type: None,
                remise_valeur: 0,
            },
        )
        .unwrap()
    }

    #[test]
    fn insert_get_et_liste_par_note() {
        let mut conn = open_in_memory().unwrap();
        let note = seed(&mut conn);

        let tardif = insert(&conn, note, 5_000, "2026-06-25", Some("Virement")).unwrap();
        let precoce = insert(&conn, note, 10_000, "2026-06-20", None).unwrap();

        let p = get(&conn, precoce).unwrap();
        assert_eq!(p.note_id, note);
        assert_eq!(p.montant, 10_000);
        assert!(!p.annule);
        assert_eq!(p.recu_id, None);

        // Classement chronologique, indépendant de l'ordre de saisie.
        let liste = list_by_note(&conn, note).unwrap();
        assert_eq!(
            liste.iter().map(|p| p.id).collect::<Vec<_>>(),
            vec![precoce, tardif]
        );
    }

    #[test]
    fn get_nomme_le_paiement_introuvable() {
        let conn = open_in_memory().unwrap();
        match get(&conn, 404).unwrap_err() {
            AppError::NotFound(msg) => assert!(msg.contains("paiement 404"), "message: {msg}"),
            other => panic!("expected NotFound, got {other:?}"),
        }
    }

    /// Le total encaissé ignore les paiements annulés.
    #[test]
    fn total_paye_exclut_les_annules() {
        let mut conn = open_in_memory().unwrap();
        let note = seed(&mut conn);
        insert(&conn, note, 10_000, "2026-06-20", None).unwrap();
        let annule = insert(&conn, note, 5_000, "2026-06-21", None).unwrap();
        assert_eq!(total_paye(&conn, note).unwrap(), 15_000);

        assert_eq!(annuler(&conn, annule).unwrap(), note);
        assert_eq!(total_paye(&conn, note).unwrap(), 10_000);
        assert!(get(&conn, annule).unwrap().annule);
    }

    /// Le reçu émis remonte avec le paiement : l'interface propose « Voir le
    /// reçu » plutôt que d'en générer un second.
    #[test]
    fn le_recu_emis_est_joint_au_paiement() {
        let mut conn = open_in_memory().unwrap();
        let note = seed(&mut conn);
        let p = insert(&conn, note, 10_000, "2026-06-20", None).unwrap();
        let recu = recus_service::generer(&conn, p).unwrap();

        let charge = get(&conn, p).unwrap();
        assert_eq!(charge.recu_id, Some(recu.id));
        assert_eq!(charge.recu_numero.as_deref(), Some(recu.numero.as_str()));
        assert_eq!(recus::list(&conn).unwrap().len(), 1);
        // La note existe toujours et reste cohérente.
        assert_eq!(notes::total(&conn, note).unwrap(), 30_000);
    }
}
