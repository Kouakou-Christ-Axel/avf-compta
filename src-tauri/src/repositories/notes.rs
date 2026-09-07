use crate::error::{AppError, AppResult};
use crate::models::{NoteDeFrais, NoteDetail, NoteLigne, NoteResume, StatutNote};
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
        remise_type: row.get("remise_type")?,
        remise_valeur: row.get("remise_valeur")?,
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
        "SELECT n.id, n.client_id, c.nom AS client_nom, n.reference, n.date_emission,
                n.statut, n.echeance,
                COALESCE((SELECT t.net FROM note_totaux t WHERE t.note_id = n.id), 0) AS total,
                COALESCE((SELECT SUM(montant)
                          FROM paiements p WHERE p.note_id = n.id AND p.annule = 0), 0) AS paye
         FROM notes_de_frais n
         JOIN clients c ON c.id = n.client_id
         ORDER BY n.date_emission DESC, n.id DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let total: i64 = row.get("total")?;
        let paye: i64 = row.get("paye")?;
        Ok(NoteResume {
            id: row.get("id")?,
            client_id: row.get("client_id")?,
            client_nom: row.get("client_nom")?,
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

/// Total **net** facturé d'une note (lignes − remise), en francs CFA. C'est le
/// montant qui fait foi partout : solde, statistiques, reçus.
pub fn total(conn: &Connection, note_id: i64) -> AppResult<i64> {
    Ok(totaux(conn, note_id)?.2)
}

/// Détail du calcul d'une note : `(brut, remise, net)` en francs CFA.
/// Unique point d'entrée Rust vers la vue `note_totaux`.
pub fn totaux(conn: &Connection, note_id: i64) -> AppResult<(i64, i64, i64)> {
    let res = conn.query_row(
        "SELECT brut, remise, net FROM note_totaux WHERE note_id = ?1",
        [note_id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    );
    match res {
        Ok(v) => Ok(v),
        // Une note sans ligne n'apparaît pas dans la vue : tout est à zéro.
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok((0, 0, 0)),
        Err(e) => Err(e.into()),
    }
}

/// Statut courant d'une note (`emise`, `payee`, `annulee`).
pub fn statut(conn: &Connection, id: i64) -> AppResult<String> {
    conn.query_row(
        "SELECT statut FROM notes_de_frais WHERE id = ?1",
        [id],
        |r| r.get(0),
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("note {id}")),
        other => other.into(),
    })
}

/// Nombre de paiements encore valides (non annulés) rattachés à une note.
pub fn nb_paiements_actifs(conn: &Connection, id: i64) -> AppResult<i64> {
    Ok(conn.query_row(
        "SELECT COUNT(*) FROM paiements WHERE note_id = ?1 AND annule = 0",
        [id],
        |r| r.get(0),
    )?)
}

pub fn detail(conn: &Connection, id: i64) -> AppResult<NoteDetail> {
    let note = get(conn, id)?;
    let lignes = lignes(conn, id)?;
    let (total_brut, remise, total) = totaux(conn, id)?;
    let depenses = super::depenses::list_by_note(conn, id)?;
    let depenses_total = super::depenses::total_by_note(conn, id)?;
    Ok(NoteDetail {
        note,
        lignes,
        total_brut,
        remise,
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

/// Annule une note (statut « annulee ») ; elle est exclue des totaux/stats.
///
/// Refusé tant qu'un paiement valide y est rattaché : les totaux excluant les
/// notes annulées, l'annulation ferait disparaître de l'argent réellement
/// encaissé du tableau de bord et du solde client. Il faut d'abord annuler les
/// paiements (ce qui trace le remboursement).
pub fn annuler(conn: &Connection, id: i64) -> AppResult<()> {
    if statut(conn, id)? == StatutNote::ANNULEE {
        return Ok(());
    }
    let actifs = nb_paiements_actifs(conn, id)?;
    if actifs > 0 {
        return Err(AppError::Validation(format!(
            "annulation impossible : {actifs} paiement(s) sont encore enregistrés              sur cette facture. Annulez-les d'abord."
        )));
    }
    set_statut(conn, id, StatutNote::ANNULEE)
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
                remise_type: None,
                remise_valeur: 0,
            },
        )
        .unwrap();
        paiements_service::enregistrer(
            &mut conn,
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
        assert_eq!(resume[0].client_nom, "Acme");
        assert_eq!(resume[0].total, 30_000);
        assert_eq!(resume[0].paye, 12_000);
        assert_eq!(resume[0].solde, 18_000);
    }
}
