use crate::error::{AppError, AppResult};
use crate::models::{NoteDeFrais, NoteDetail, NoteLigne, NoteResume};
use rusqlite::{Connection, Row};

fn map_note(row: &Row) -> rusqlite::Result<NoteDeFrais> {
    Ok(NoteDeFrais {
        id: row.get("id")?,
        client_id: row.get("client_id")?,
        reference: row.get("reference")?,
        date_emission: row.get("date_emission")?,
        statut: row.get("statut")?,
        echeance: row.get("echeance")?,
        cree_le: row.get("cree_le")?,
    })
}

fn map_ligne(row: &Row) -> rusqlite::Result<NoteLigne> {
    Ok(NoteLigne {
        id: row.get("id")?,
        note_id: row.get("note_id")?,
        prestation_id: row.get("prestation_id")?,
        libelle_snapshot: row.get("libelle_snapshot")?,
        prix_snapshot: row.get("prix_snapshot")?,
        quantite: row.get("quantite")?,
    })
}

pub fn get(conn: &Connection, id: i64) -> AppResult<NoteDeFrais> {
    conn.query_row("SELECT * FROM notes_de_frais WHERE id = ?1", [id], map_note)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("note {id}")),
            other => other.into(),
        })
}

pub fn list(conn: &Connection) -> AppResult<Vec<NoteDeFrais>> {
    let mut stmt =
        conn.prepare("SELECT * FROM notes_de_frais ORDER BY date_emission DESC, id DESC")?;
    let rows = stmt.query_map([], map_note)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Récapitulatif de toutes les notes avec leurs montants (facturé, payé,
/// restant), pour le tableau de bord des notes.
pub fn list_resume(conn: &Connection) -> AppResult<Vec<NoteResume>> {
    let mut stmt = conn.prepare(
        "SELECT n.id, n.client_id, n.reference, n.date_emission, n.statut, n.echeance,
                COALESCE((SELECT SUM(prix_snapshot * quantite)
                          FROM note_lignes l WHERE l.note_id = n.id), 0) AS total,
                COALESCE((SELECT SUM(montant)
                          FROM paiements p WHERE p.note_id = n.id AND p.annule = 0), 0) AS paye
         FROM notes_de_frais n
         ORDER BY n.date_emission DESC, n.id DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let total: i64 = row.get("total")?;
        let paye: i64 = row.get("paye")?;
        Ok(NoteResume {
            id: row.get("id")?,
            client_id: row.get("client_id")?,
            reference: row.get("reference")?,
            date_emission: row.get("date_emission")?,
            statut: row.get("statut")?,
            echeance: row.get("echeance")?,
            total,
            paye,
            solde: total - paye,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn lignes(conn: &Connection, note_id: i64) -> AppResult<Vec<NoteLigne>> {
    let mut stmt = conn.prepare("SELECT * FROM note_lignes WHERE note_id = ?1 ORDER BY id")?;
    let rows = stmt.query_map([note_id], map_ligne)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Total facturé d'une note (Σ prix_snapshot × quantité), en francs CFA.
pub fn total(conn: &Connection, note_id: i64) -> AppResult<i64> {
    let total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(prix_snapshot * quantite), 0)
         FROM note_lignes WHERE note_id = ?1",
        [note_id],
        |r| r.get(0),
    )?;
    Ok(total)
}

pub fn detail(conn: &Connection, id: i64) -> AppResult<NoteDetail> {
    let note = get(conn, id)?;
    let lignes = lignes(conn, id)?;
    let total = total(conn, id)?;
    let depenses = super::depenses::list_by_note(conn, id)?;
    let depenses_total = super::depenses::total_by_note(conn, id)?;
    Ok(NoteDetail {
        note,
        lignes,
        total,
        depenses,
        depenses_total,
        marge: total - depenses_total,
    })
}

pub fn set_statut(conn: &Connection, id: i64, statut: &str) -> AppResult<()> {
    let n = conn.execute(
        "UPDATE notes_de_frais SET statut = ?1 WHERE id = ?2",
        rusqlite::params![statut, id],
    )?;
    if n == 0 {
        return Err(AppError::NotFound(format!("note {id}")));
    }
    Ok(())
}

pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    let n = conn.execute("DELETE FROM notes_de_frais WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(AppError::NotFound(format!("note {id}")));
    }
    Ok(())
}

/// Annule une note (statut « annulee ») ; elle est exclue des totaux/stats.
pub fn annuler(conn: &Connection, id: i64) -> AppResult<()> {
    set_statut(conn, id, "annulee")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::models::note::NewNoteLigne;
    use crate::models::{NewClient, NewNote, NewPaiement, NewPrestation};
    use crate::repositories::{clients, prestations};
    use crate::services::{notes_service, paiements_service};

    #[test]
    fn list_resume_computes_total_paye_solde() {
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
        let presta = prestations::create(
            &conn,
            &NewPrestation {
                libelle: "Conseil".into(),
                prix: 10_000,
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
                    quantite: 3,
                }],
            },
        )
        .unwrap();
        paiements_service::enregistrer(
            &conn,
            &NewPaiement {
                note_id: note,
                montant: 12_000,
                date_paiement: "2026-06-18".into(),
                methode: None,
            },
        )
        .unwrap();

        let resume = list_resume(&conn).unwrap();
        assert_eq!(resume.len(), 1);
        assert_eq!(resume[0].total, 30_000);
        assert_eq!(resume[0].paye, 12_000);
        assert_eq!(resume[0].solde, 18_000);
    }
}
