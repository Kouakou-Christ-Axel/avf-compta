use crate::error::{AppError, AppResult};
use crate::models::NewNote;
use crate::repositories::prestations;
use rusqlite::Connection;

/// Statut initial d'une note de frais.
pub const STATUT_EMISE: &str = "emise";

/// Remise exprimée en francs CFA.
pub const REMISE_MONTANT: &str = "montant";
/// Remise exprimée en pourcentage du total des lignes.
pub const REMISE_POURCENT: &str = "pourcent";

/// Valide la remise saisie. Le montant réellement déduit est calculé par la vue
/// SQL `note_totaux` (bornée à [0, brut]) : ici on ne contrôle que la saisie.
fn valider_remise(remise_type: Option<&str>, valeur: i64) -> AppResult<()> {
    match remise_type {
        None => Ok(()),
        Some(REMISE_MONTANT) | Some(REMISE_POURCENT) if valeur < 0 => Err(AppError::Validation(
            "la remise ne peut pas être négative".into(),
        )),
        Some(REMISE_POURCENT) if valeur > 100 => Err(AppError::Validation(
            "la remise en pourcentage ne peut pas dépasser 100 %".into(),
        )),
        Some(REMISE_MONTANT) | Some(REMISE_POURCENT) => Ok(()),
        Some(autre) => Err(AppError::Validation(format!(
            "type de remise inconnu: {autre}"
        ))),
    }
}

/// Extrait l'année (2 chiffres) et le mois d'une date « YYYY-MM-DD ».
fn annee_mois(date: &str) -> AppResult<(&str, &str)> {
    let bytes = date.as_bytes();
    // `date` vient du frontend : on exige de l'ASCII avant tout découpage par
    // octets, sinon un caractère multi-octets ferait paniquer le slicing.
    let valide = date.len() >= 7
        && date.is_ascii()
        && bytes[4] == b'-'
        && bytes[..4].iter().all(u8::is_ascii_digit)
        && bytes[5..7].iter().all(u8::is_ascii_digit);
    if !valide {
        return Err(AppError::Validation(format!("date invalide: {date}")));
    }
    Ok((&date[2..4], &date[5..7]))
}

/// Génère la référence séquentielle d'une note au format `AA-MM-NNNN`
/// (séquence remise à zéro chaque mois).
fn generer_reference(conn: &Connection, date_emission: &str) -> AppResult<String> {
    let (aa, mm) = annee_mois(date_emission)?;
    let prefix = format!("{aa}-{mm}-");
    let deja: i64 = conn.query_row(
        "SELECT COUNT(*) FROM notes_de_frais WHERE reference LIKE ?1",
        [format!("{prefix}%")],
        |r| r.get(0),
    )?;
    Ok(format!("{prefix}{:04}", deja + 1))
}

/// Crée une note de frais et ses lignes de façon **atomique** : le libellé et
/// le prix de chaque prestation sont figés (snapshot). La référence est
/// générée automatiquement (`AA-MM-NNNN`). Si une prestation est introuvable,
/// toute la transaction est annulée (aucune note orpheline).
pub fn create_note(conn: &mut Connection, n: &NewNote) -> AppResult<i64> {
    if n.lignes.is_empty() {
        return Err(AppError::Validation(
            "une note doit comporter au moins une ligne".into(),
        ));
    }
    for l in &n.lignes {
        if l.quantite <= 0 {
            return Err(AppError::Validation(
                "la quantité doit être strictement positive".into(),
            ));
        }
    }
    valider_remise(n.remise_type.as_deref(), n.remise_valeur)?;
    // Une remise sans type saisi n'est pas appliquée : on normalise à zéro pour
    // que la valeur stockée reflète toujours ce qui est réellement déduit.
    let remise_valeur = if n.remise_type.is_some() {
        n.remise_valeur
    } else {
        0
    };

    let tx = conn.transaction()?;
    let reference = generer_reference(&tx, &n.date_emission)?;
    tx.execute(
        "INSERT INTO notes_de_frais
            (client_id, reference, date_emission, statut, echeance, cree_le,
             remise_type, remise_valeur)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            n.client_id,
            reference,
            n.date_emission,
            STATUT_EMISE,
            n.echeance,
            crate::repositories::now(),
            n.remise_type,
            remise_valeur
        ],
    )?;
    let note_id = tx.last_insert_rowid();

    for l in &n.lignes {
        // Snapshot du libellé et du prix au moment de l'ajout.
        let p = prestations::get(&tx, l.prestation_id)?;
        tx.execute(
            "INSERT INTO note_lignes
                (note_id, prestation_id, libelle_snapshot, prix_snapshot, quantite)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![note_id, p.id, p.libelle, p.prix, l.quantite],
        )?;
    }

    tx.commit()?;
    Ok(note_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::models::note::NewNoteLigne;
    use crate::models::{NewClient, NewPrestation};
    use crate::repositories::{clients, notes, prestations};

    fn seed(conn: &Connection) -> (i64, i64) {
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
        (client, presta)
    }

    fn new_note(client_id: i64, prestation_id: i64, qte: i64) -> NewNote {
        NewNote {
            client_id,
            date_emission: "2026-06-18".into(),
            echeance: None,
            lignes: vec![NewNoteLigne {
                prestation_id,
                quantite: qte,
            }],
            remise_type: None,
            remise_valeur: 0,
        }
    }

    #[test]
    fn reference_is_generated_sequentially_per_month() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let id1 = create_note(&mut conn, &new_note(client, presta, 1)).unwrap();
        let id2 = create_note(&mut conn, &new_note(client, presta, 1)).unwrap();
        assert_eq!(
            notes::get(&conn, id1).unwrap().reference.unwrap(),
            "26-06-0001"
        );
        assert_eq!(
            notes::get(&conn, id2).unwrap().reference.unwrap(),
            "26-06-0002"
        );

        // Un autre mois repart à 0001.
        let mut autre = new_note(client, presta, 1);
        autre.date_emission = "2026-07-02".into();
        let id3 = create_note(&mut conn, &autre).unwrap();
        assert_eq!(
            notes::get(&conn, id3).unwrap().reference.unwrap(),
            "26-07-0001"
        );
    }

    #[test]
    fn total_is_sum_of_lines() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let id = create_note(&mut conn, &new_note(client, presta, 3)).unwrap();
        assert_eq!(notes::total(&conn, id).unwrap(), 30_000);
    }

    #[test]
    fn price_is_snapshotted() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let id = create_note(&mut conn, &new_note(client, presta, 1)).unwrap();
        // Le prix de la prestation change après coup…
        let mut p = prestations::get(&conn, presta).unwrap();
        p.prix = 99_999;
        prestations::update(&conn, &p).unwrap();
        // …mais le total de la note historique reste inchangé.
        assert_eq!(notes::total(&conn, id).unwrap(), 10_000);
    }

    #[test]
    fn missing_prestation_rolls_back() {
        let mut conn = open_in_memory().unwrap();
        let (client, _) = seed(&conn);
        let note = new_note(client, 9999, 1);
        assert!(matches!(
            create_note(&mut conn, &note),
            Err(AppError::NotFound(_))
        ));
        // Aucune note orpheline créée.
        assert_eq!(notes::list(&conn).unwrap().len(), 0);
    }

    #[test]
    fn rejects_empty_or_bad_quantity() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let mut empty = new_note(client, presta, 1);
        empty.lignes.clear();
        assert!(matches!(
            create_note(&mut conn, &empty),
            Err(AppError::Validation(_))
        ));
        assert!(matches!(
            create_note(&mut conn, &new_note(client, presta, 0)),
            Err(AppError::Validation(_))
        ));
    }

    /// La remise doit être identique partout : détail de la facture, liste des
    /// factures, fiche client et tableau de bord lisent tous la vue
    /// `note_totaux`.
    #[test]
    fn remise_coherente_partout() {
        use crate::repositories::{clients as repo_clients, stats};

        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let mut n = new_note(client, presta, 3); // 3 × 10 000 = 30 000
        n.remise_type = Some(REMISE_POURCENT.into());
        n.remise_valeur = 10;
        let id = create_note(&mut conn, &n).unwrap();

        let (brut, remise, net) = notes::totaux(&conn, id).unwrap();
        assert_eq!((brut, remise, net), (30_000, 3_000, 27_000));
        assert_eq!(notes::total(&conn, id).unwrap(), 27_000);
        assert_eq!(notes::list_resume(&conn).unwrap()[0].total, 27_000);
        assert_eq!(
            repo_clients::list_resume(&conn).unwrap()[0].total_facture,
            27_000
        );
        assert_eq!(stats::resume(&conn).unwrap().total_facture, 27_000);
        assert_eq!(stats::mensuelles(&conn).unwrap()[0].ca, 27_000);
    }

    #[test]
    fn remise_en_montant_et_plafonnement() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);

        let mut n = new_note(client, presta, 1); // 10 000
        n.remise_type = Some(REMISE_MONTANT.into());
        n.remise_valeur = 2_500;
        let id = create_note(&mut conn, &n).unwrap();
        assert_eq!(notes::total(&conn, id).unwrap(), 7_500);

        // Une remise supérieure au brut ne rend pas la facture négative.
        let mut n2 = new_note(client, presta, 1);
        n2.remise_type = Some(REMISE_MONTANT.into());
        n2.remise_valeur = 99_000;
        let id2 = create_note(&mut conn, &n2).unwrap();
        assert_eq!(notes::total(&conn, id2).unwrap(), 0);
    }

    /// Arrondi au franc le plus proche : le XOF n'a pas de centime.
    #[test]
    fn remise_pourcent_arrondie_au_franc() {
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
                prix: 1_005,
            },
        )
        .unwrap();
        let mut n = new_note(client, presta, 1);
        n.remise_type = Some(REMISE_POURCENT.into());
        n.remise_valeur = 50; // 502,5 → 503
        let id = create_note(&mut conn, &n).unwrap();
        assert_eq!(notes::totaux(&conn, id).unwrap().1, 503);
    }

    #[test]
    fn remise_invalide_est_rejetee() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);

        let mut n = new_note(client, presta, 1);
        n.remise_type = Some(REMISE_POURCENT.into());
        n.remise_valeur = 120;
        assert!(matches!(
            create_note(&mut conn, &n),
            Err(AppError::Validation(_))
        ));

        let mut n2 = new_note(client, presta, 1);
        n2.remise_type = Some("cadeau".into());
        assert!(matches!(
            create_note(&mut conn, &n2),
            Err(AppError::Validation(_))
        ));
    }

    /// Une date malformée est refusée proprement, sans panique de découpage
    /// (un caractère multi-octets empoisonnait le mutex global).
    #[test]
    fn date_non_ascii_est_rejetee_sans_paniquer() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let mut n = new_note(client, presta, 1);
        n.date_emission = "1é2-06-18".into();
        assert!(matches!(
            create_note(&mut conn, &n),
            Err(AppError::Validation(_))
        ));
    }
}
