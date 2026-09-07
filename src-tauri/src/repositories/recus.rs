use crate::error::{AppError, AppResult};
use crate::models::{Recu, RecuDetail, RecuResume};
use rusqlite::{Connection, Row};

fn map_row(row: &Row) -> rusqlite::Result<Recu> {
    Ok(Recu {
        id: row.get("id")?,
        paiement_id: row.get("paiement_id")?,
        numero: row.get("numero")?,
        emis_le: row.get("emis_le")?,
        annule: row.get::<_, i64>("annule")? != 0,
        note_total: row.get("note_total")?,
        note_solde: row.get("note_solde")?,
    })
}

/// Reçu enrichi (client + note + paiement + prestations) pour l'impression.
pub fn detail(conn: &Connection, id: i64) -> AppResult<RecuDetail> {
    let mut recu = conn
        .query_row(
            "SELECT r.id, r.numero, r.emis_le, r.annule, r.note_total, r.note_solde,
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
                    annule: row.get::<_, i64>("annule")? != 0,
                    note_id: row.get("note_id")?,
                    note_reference: row.get("note_reference")?,
                    client_nom: row.get("client_nom")?,
                    client_email: row.get("client_email")?,
                    client_telephone: row.get("client_telephone")?,
                    lignes: Vec::new(),
                    note_total: row.get("note_total")?,
                    note_solde: row.get("note_solde")?,
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("reçu {id}")),
            other => other.into(),
        })?;
    // `note_total` et `note_solde` sont figés à l'émission (migration v11) : un
    // reçu réimprimé montre la situation du jour de l'encaissement, pas celle
    // d'aujourd'hui.
    recu.lignes = super::notes::lignes(conn, recu.note_id)?;
    Ok(recu)
}

pub fn insert(
    conn: &Connection,
    paiement_id: i64,
    numero: &str,
    note_total: i64,
    note_solde: i64,
) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO recus (paiement_id, numero, emis_le, note_total, note_solde)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![paiement_id, numero, super::now(), note_total, note_solde],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Reçu déjà émis pour ce paiement, s'il existe (au plus un : index unique
/// `idx_recus_paiement`).
pub fn find_by_paiement(conn: &Connection, paiement_id: i64) -> AppResult<Option<Recu>> {
    match conn.query_row(
        "SELECT * FROM recus WHERE paiement_id = ?1",
        [paiement_id],
        map_row,
    ) {
        Ok(r) => Ok(Some(r)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Prochain numéro de reçu, dérivé du **plus grand numéro déjà émis** et non
/// d'un `COUNT(*)` : supprimer un reçu ne fait plus réattribuer son numéro.
///
/// Le maximum est calculé sur la partie **numérique** du numéro, pas sur le
/// texte : `numero` est une colonne `TEXT`, et `MAX()` y compare caractère par
/// caractère. Or `{:04}` est une largeur *minimale*, donc le 10 000ᵉ reçu
/// s'écrit `RECU-10000` — lexicographiquement **inférieur** à `RECU-9999`
/// (`'1' < '9'`). Un `MAX(numero)` textuel renvoyait donc éternellement
/// `RECU-9999` et réémettait `RECU-10000` à chaque fois, en doublon silencieux
/// (l'index `idx_recus_numero` n'est volontairement pas unique).
pub fn prochain_numero(conn: &Connection) -> AppResult<String> {
    // SUBSTR est en base 1 : le 6ᵉ caractère est ce qui suit « RECU- ».
    // CAST ignore les zéros de tête, donc les numéros historiques
    // « RECU-0001 »…« RECU-9999 » sont relus correctement.
    let max: Option<i64> = conn.query_row(
        "SELECT MAX(CAST(SUBSTR(numero, 6) AS INTEGER))
           FROM recus WHERE numero LIKE 'RECU-%'",
        [],
        |r| r.get(0),
    )?;
    let suivant = max.unwrap_or(0) + 1;
    Ok(format!("RECU-{suivant:04}"))
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Recu> {
    conn.query_row("SELECT * FROM recus WHERE id = ?1", [id], map_row)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("reçu {id}")),
            other => other.into(),
        })
}

pub fn list(conn: &Connection) -> AppResult<Vec<Recu>> {
    let mut stmt = conn.prepare("SELECT * FROM recus ORDER BY id DESC")?;
    let rows = stmt.query_map([], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Récapitulatif des reçus (avec client, montant, état annulé) pour la liste.
pub fn list_resume(conn: &Connection) -> AppResult<Vec<RecuResume>> {
    let mut stmt = conn.prepare(
        "SELECT r.id, r.numero, r.emis_le, r.annule, p.montant, c.nom AS client_nom
         FROM recus r
         JOIN paiements p      ON p.id = r.paiement_id
         JOIN notes_de_frais n ON n.id = p.note_id
         JOIN clients c        ON c.id = n.client_id
         ORDER BY r.id DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(RecuResume {
            id: row.get("id")?,
            numero: row.get("numero")?,
            emis_le: row.get("emis_le")?,
            client_nom: row.get("client_nom")?,
            montant: row.get("montant")?,
            annule: row.get::<_, i64>("annule")? != 0,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Marque un reçu comme annulé et renvoie l'identifiant du paiement lié.
/// L'annulation complète (paiement + statut de la note) est orchestrée par
/// `services::recus_service::annuler`, qui l'exécute dans une transaction.
pub fn marquer_annule(conn: &Connection, recu_id: i64) -> AppResult<i64> {
    let paiement_id: i64 = conn
        .query_row(
            "SELECT paiement_id FROM recus WHERE id = ?1",
            [recu_id],
            |r| r.get(0),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("reçu {recu_id}")),
            other => other.into(),
        })?;
    conn.execute("UPDATE recus SET annule = 1 WHERE id = ?1", [recu_id])?;
    Ok(paiement_id)
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
        let paiement = paiements_service::enregistrer(
            &mut conn,
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
        assert_eq!(d.note_reference.as_deref(), Some("26-06-0001"));
        assert_eq!(d.methode.as_deref(), Some("espèces"));
        assert!(!d.annule);
    }

    /// Annuler un reçu marque ce reçu précis comme annulé (colonne propre à
    /// `recus`), pas seulement le paiement partagé — sinon un nouveau reçu
    /// généré plus tard sur un autre paiement pourrait être affecté à tort.
    #[test]
    fn annuler_marque_le_recu_lui_meme() {
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
                prix: 50_000,
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
                    quantite: 1,
                }],
                remise_type: None,
                remise_valeur: 0,
            },
        )
        .unwrap();
        let paiement = paiements_service::enregistrer(
            &mut conn,
            &NewPaiement {
                note_id: note,
                montant: 50_000,
                date_paiement: "2026-06-18".into(),
                methode: None,
            },
        )
        .unwrap();
        let recu = recus_service::generer(&conn, paiement).unwrap();

        crate::services::recus_service::annuler(&mut conn, recu.id).unwrap();

        let d = detail(&conn, recu.id).unwrap();
        assert!(d.annule);

        let r = list_resume(&conn).unwrap();
        assert_eq!(r.len(), 1);
        assert!(r[0].annule);
    }

    #[test]
    fn detail_missing_is_not_found() {
        let conn = open_in_memory().unwrap();
        assert!(matches!(detail(&conn, 999), Err(AppError::NotFound(_))));
    }

    /// Crée une note de 50 000 réglée en `nb` versements égaux et renvoie les
    /// identifiants de paiement (un reçu au plus par paiement).
    fn paiements_pour_recus(conn: &mut Connection, nb: i64) -> Vec<i64> {
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
                prix: 50_000,
            },
        )
        .unwrap();
        let note = notes_service::create_note(
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
        .unwrap();
        (0..nb)
            .map(|_| {
                paiements_service::enregistrer(
                    conn,
                    &NewPaiement {
                        note_id: note,
                        montant: 50_000 / nb,
                        date_paiement: "2026-06-18".into(),
                        methode: None,
                    },
                )
                .unwrap()
            })
            .collect()
    }

    #[test]
    fn prochain_numero_part_de_un_sur_une_base_vide() {
        let conn = open_in_memory().unwrap();
        assert_eq!(prochain_numero(&conn).unwrap(), "RECU-0001");
    }

    /// `numero` est du TEXT : un `MAX()` y compare caractère par caractère, et
    /// « RECU-10000 » y passe **avant** « RECU-9999 » (`'1' < '9'`). La
    /// séquence rendait donc « RECU-10000 » indéfiniment, en doublon, l'index
    /// sur `numero` n'étant volontairement pas unique.
    #[test]
    fn prochain_numero_ne_recycle_pas_au_dela_de_9999() {
        let mut conn = open_in_memory().unwrap();
        let paiements = paiements_pour_recus(&mut conn, 2);
        insert(&conn, paiements[0], "RECU-9999", 50_000, 0).unwrap();
        insert(&conn, paiements[1], "RECU-10000", 50_000, 0).unwrap();

        assert_eq!(prochain_numero(&conn).unwrap(), "RECU-10001");
    }

    /// La séquence usuelle (numéros à quatre chiffres) reste inchangée.
    #[test]
    fn prochain_numero_suit_la_sequence_sous_10000() {
        let mut conn = open_in_memory().unwrap();
        let paiements = paiements_pour_recus(&mut conn, 1);
        insert(&conn, paiements[0], "RECU-0007", 50_000, 0).unwrap();

        assert_eq!(prochain_numero(&conn).unwrap(), "RECU-0008");
    }
}
