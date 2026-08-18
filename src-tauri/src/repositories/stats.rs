use crate::error::AppResult;
use crate::models::{ResumeStats, StatMois};
use rusqlite::Connection;
use std::collections::BTreeMap;

/// Récapitulatif chiffré, éventuellement borné à une période (dates ISO
/// `YYYY-MM-DD` incluses).
///
/// Les notes annulées et les paiements annulés sont toujours exclus. Le
/// nombre de clients est un **stock**, pas un flux : il n'est pas filtré par
/// la période (l'interface l'indique).
///
/// L'impayé porte sur les factures **émises dans la période**, diminué de tout
/// ce qui a été encaissé dessus, y compris hors période : c'est le reste dû
/// réel sur ces factures.
pub fn resume(conn: &Connection, du: Option<&str>, au: Option<&str>) -> AppResult<ResumeStats> {
    // Bornes optionnelles : `NULL` neutralise la comparaison correspondante.
    let bornes = rusqlite::params![du, au];

    let nb_clients: i64 = conn.query_row("SELECT COUNT(*) FROM clients", [], |r| r.get(0))?;
    let nb_notes: i64 = conn.query_row(
        "SELECT COUNT(*) FROM notes_de_frais n
          WHERE n.statut != 'annulee'
            AND (?1 IS NULL OR n.date_emission >= ?1)
            AND (?2 IS NULL OR n.date_emission <= ?2)",
        bornes,
        |r| r.get(0),
    )?;
    let total_facture: i64 = conn.query_row(
        "SELECT COALESCE(SUM(t.net), 0)
         FROM note_totaux t JOIN notes_de_frais n ON n.id = t.note_id
         WHERE n.statut != 'annulee'
           AND (?1 IS NULL OR n.date_emission >= ?1)
           AND (?2 IS NULL OR n.date_emission <= ?2)",
        bornes,
        |r| r.get(0),
    )?;
    let total_encaisse: i64 = conn.query_row(
        "SELECT COALESCE(SUM(p.montant), 0)
         FROM paiements p JOIN notes_de_frais n ON n.id = p.note_id
         WHERE p.annule = 0 AND n.statut != 'annulee'
           AND (?1 IS NULL OR p.date_paiement >= ?1)
           AND (?2 IS NULL OR p.date_paiement <= ?2)",
        bornes,
        |r| r.get(0),
    )?;
    // Impayé = Σ par note de max(0, facturé − encaissé).
    let total_impaye: i64 = conn.query_row(
        "SELECT COALESCE(SUM(CASE WHEN diff > 0 THEN diff ELSE 0 END), 0) FROM (
            SELECT
              COALESCE((SELECT t.net FROM note_totaux t WHERE t.note_id = n.id), 0)
              -
              (SELECT COALESCE(SUM(montant), 0)
                 FROM paiements p WHERE p.note_id = n.id AND p.annule = 0) AS diff
            FROM notes_de_frais n
            WHERE n.statut != 'annulee'
              AND (?1 IS NULL OR n.date_emission >= ?1)
              AND (?2 IS NULL OR n.date_emission <= ?2)
         )",
        bornes,
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
                COALESCE(SUM(t.net), 0) AS ca
         FROM notes_de_frais n JOIN note_totaux t ON t.note_id = n.id
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
         FROM depenses d LEFT JOIN notes_de_frais n ON n.id = d.note_id
         WHERE n.id IS NULL OR n.statut != 'annulee'
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
        assert_eq!(resume(&conn, None, None).unwrap(), ResumeStats::default());
        assert!(mensuelles(&conn).unwrap().is_empty());
    }

    /// Le filtre de période s'applique aux montants : les cartes du tableau de
    /// bord affichaient jusqu'ici les totaux depuis toujours, alors que les
    /// graphiques respectaient le filtre.
    #[test]
    fn resume_respecte_la_periode() {
        use crate::models::note::NewNoteLigne;
        use crate::models::{NewClient, NewNote, NewPaiement, NewPrestation};
        use crate::repositories::{clients, prestations};
        use crate::services::{notes_service, paiements_service};

        let mut conn = crate::db::open_in_memory().unwrap();
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
        let mut facture = |date: &str| {
            notes_service::create_note(
                &mut conn,
                &NewNote {
                    client_id: client,
                    date_emission: date.into(),
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
        };
        let mai = facture("2026-05-10");
        facture("2026-06-10");
        paiements_service::enregistrer(
            &conn,
            &NewPaiement {
                note_id: mai,
                montant: 4_000,
                date_paiement: "2026-05-15".into(),
                methode: None,
            },
        )
        .unwrap();

        let tout = resume(&conn, None, None).unwrap();
        assert_eq!((tout.nb_notes, tout.total_facture), (2, 20_000));

        let mai_seul = resume(&conn, Some("2026-05-01"), Some("2026-05-31")).unwrap();
        assert_eq!(mai_seul.nb_notes, 1);
        assert_eq!(mai_seul.total_facture, 10_000);
        assert_eq!(mai_seul.total_encaisse, 4_000);
        assert_eq!(mai_seul.total_impaye, 6_000);

        let juin_seul = resume(&conn, Some("2026-06-01"), Some("2026-06-30")).unwrap();
        assert_eq!(juin_seul.total_facture, 10_000);
        assert_eq!(juin_seul.total_encaisse, 0);
        assert_eq!(juin_seul.total_impaye, 10_000);

        // Le nombre de clients est un stock : il ne dépend pas de la période.
        assert_eq!(juin_seul.nb_clients, 1);
    }
}
