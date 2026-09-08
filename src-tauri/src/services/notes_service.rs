use crate::error::{AppError, AppResult};
use crate::models::{NewNote, StatutNote};
use crate::money::Money;
use crate::repositories::{notes, prestations};
use rusqlite::Connection;

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

/// Une échéance antérieure à l'émission n'a pas de sens : la facture serait
/// due avant d'exister. Le formulaire le refuse déjà, mais c'est le backend qui
/// fait foi — un appel direct à la commande (script, import en masse) doit
/// buter sur la même règle.
///
/// Les dates sont au format `YYYY-MM-DD`, donc l'ordre lexicographique est
/// l'ordre chronologique.
fn valider_echeance(n: &NewNote) -> AppResult<()> {
    match &n.echeance {
        Some(e) if e.as_str() < n.date_emission.as_str() => Err(AppError::Validation(
            "l'échéance ne peut pas précéder la date d'émission".into(),
        )),
        _ => Ok(()),
    }
}

/// Une note doit porter au moins une ligne, chacune en quantité positive.
fn valider_lignes(n: &NewNote) -> AppResult<()> {
    if n.lignes.is_empty() {
        return Err(AppError::Validation(
            "une note doit comporter au moins une ligne".into(),
        ));
    }
    if n.lignes.iter().any(|l| l.quantite <= 0) {
        return Err(AppError::Validation(
            "la quantité doit être strictement positive".into(),
        ));
    }
    Ok(())
}

/// Vérifie que le total de la note tient dans un entier 64 bits.
///
/// SQLite ne signale pas le débordement d'un `prix × quantité` : il bascule en
/// flottant, et la relecture en entier échoue plus tard sur une erreur de type
/// illisible. On refuse donc la saisie au moment où elle est faite.
fn valider_total(conn: &Connection, n: &NewNote) -> AppResult<()> {
    let mut total = Money::ZERO;
    for l in &n.lignes {
        let p = prestations::get(conn, l.prestation_id)?;
        let ligne = Money::from_xof(p.prix)
            .checked_mul_qty(l.quantite)
            .and_then(|m| total.checked_add(m))
            .ok_or_else(|| {
                AppError::Validation(format!(
                    "montant trop élevé : « {} » × {} dépasse les limites de calcul",
                    p.libelle, l.quantite
                ))
            })?;
        total = ligne;
    }
    if total.xof() < 0 {
        return Err(AppError::Validation(
            "le total de la facture ne peut pas être négatif".into(),
        ));
    }
    Ok(())
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
///
/// La séquence part du **plus grand numéro déjà attribué** dans le mois, et non
/// d'un `COUNT(*)` : compter fait reculer la séquence dès qu'une facture du
/// mois manque, et deux factures finissent par porter le même identifiant
/// légal. L'application ne supprime plus de facture (seule l'annulation
/// existe), mais une base restaurée ou retouchée à la main peut présenter des
/// trous.
///
/// Ce maximum est pris sur la partie **numérique** : `reference` est du `TEXT`
/// et `{:04}` n'est qu'une largeur minimale, donc une comparaison textuelle
/// classerait `26-06-10000` avant `26-06-9999` et rendrait deux fois la même
/// référence.
fn generer_reference(conn: &Connection, date_emission: &str) -> AppResult<String> {
    let (aa, mm) = annee_mois(date_emission)?;
    let prefix = format!("{aa}-{mm}-");
    let dernier: Option<i64> = conn.query_row(
        "SELECT MAX(CAST(SUBSTR(reference, ?1) AS INTEGER))
           FROM notes_de_frais WHERE reference LIKE ?2",
        rusqlite::params![prefix.len() as i64 + 1, format!("{prefix}%")],
        |r| r.get(0),
    )?;
    let suivant = dernier.unwrap_or(0) + 1;
    Ok(format!("{prefix}{suivant:04}"))
}

/// Crée une note de frais et ses lignes de façon **atomique** : le libellé et
/// le prix de chaque prestation sont figés (snapshot). La référence est
/// générée automatiquement (`AA-MM-NNNN`). Si une prestation est introuvable,
/// toute la transaction est annulée (aucune note orpheline).
pub fn create_note(conn: &mut Connection, n: &NewNote) -> AppResult<i64> {
    valider_lignes(n)?;
    valider_total(conn, n)?;
    valider_remise(n.remise_type.as_deref(), n.remise_valeur)?;
    valider_echeance(n)?;
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
            StatutNote::Emise.as_str(),
            n.echeance,
            crate::repositories::now(),
            n.remise_type,
            remise_valeur
        ],
    )?;
    let note_id = tx.last_insert_rowid();

    inserer_lignes(&tx, note_id, n)?;
    // Une facture entièrement remisée (net = 0) est soldée d'emblée : sans ce
    // recalcul elle resterait « emise » à vie, aucun paiement ne pouvant la
    // solder. Doit venir **après** les lignes, dont dépend le total.
    crate::services::paiements_service::recalculer_statut(&tx, note_id)?;

    tx.commit()?;
    Ok(note_id)
}

/// Insère les lignes d'une note en figeant le libellé et le prix courants de
/// chaque prestation (snapshot).
fn inserer_lignes(conn: &Connection, note_id: i64, n: &NewNote) -> AppResult<()> {
    for l in &n.lignes {
        let p = prestations::get(conn, l.prestation_id)?;
        conn.execute(
            "INSERT INTO note_lignes
                (note_id, prestation_id, libelle_snapshot, prix_snapshot, quantite)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![note_id, p.id, p.libelle, p.prix, l.quantite],
        )?;
    }
    Ok(())
}

/// Modifie une note existante : client, date, échéance, remise et lignes.
///
/// **Refusé dès qu'un paiement y est rattaché** (ou si elle est annulée) :
/// un reçu déjà remis au client atteste d'un montant, la facture ne doit plus
/// pouvoir en changer. La référence n'est jamais régénérée — c'est un
/// identifiant déjà communiqué, même si la date d'émission change de mois.
///
/// Les lignes sont remplacées en bloc, avec de nouveaux snapshots : modifier
/// une facture reprend donc les prix **actuels** des prestations.
pub fn update_note(conn: &mut Connection, id: i64, n: &NewNote) -> AppResult<()> {
    valider_lignes(n)?;
    valider_total(conn, n)?;
    valider_remise(n.remise_type.as_deref(), n.remise_valeur)?;
    valider_echeance(n)?;
    annee_mois(&n.date_emission)?;

    let statut = notes::statut(conn, id)?;
    if statut == StatutNote::ANNULEE {
        return Err(AppError::Validation(
            "cette facture est annulée : elle ne peut plus être modifiée".into(),
        ));
    }
    let payes = notes::nb_paiements_actifs(conn, id)?;
    if payes > 0 {
        return Err(AppError::Validation(format!(
            "cette facture porte déjà {payes} paiement(s) : annulez-les avant de la modifier."
        )));
    }

    let remise_valeur = if n.remise_type.is_some() {
        n.remise_valeur
    } else {
        0
    };

    let tx = conn.transaction()?;
    let modifiees = tx.execute(
        "UPDATE notes_de_frais
            SET client_id = ?1, date_emission = ?2, echeance = ?3,
                remise_type = ?4, remise_valeur = ?5
          WHERE id = ?6",
        rusqlite::params![
            n.client_id,
            n.date_emission,
            n.echeance,
            n.remise_type,
            remise_valeur,
            id
        ],
    )?;
    if modifiees == 0 {
        return Err(AppError::NotFound(format!("note {id}")));
    }
    tx.execute("DELETE FROM note_lignes WHERE note_id = ?1", [id])?;
    inserer_lignes(&tx, id, n)?;
    // Modifier les lignes ou la remise peut amener le net à zéro (ou l'en
    // sortir) : on réaligne le statut, comme à la création.
    crate::services::paiements_service::recalculer_statut(&tx, id)?;
    tx.commit()?;
    Ok(())
}

/// Annule une facture (statut « annulee ») : elle sort des totaux et des
/// statistiques, mais reste consultable.
///
/// Refusé tant qu'un paiement valide y est rattaché : les totaux excluant les
/// factures annulées, l'annulation ferait disparaître du tableau de bord et du
/// solde client de l'argent réellement encaissé. Il faut d'abord annuler les
/// paiements, ce qui trace le remboursement.
pub fn annuler(conn: &Connection, id: i64) -> AppResult<()> {
    if notes::statut(conn, id)? == StatutNote::ANNULEE {
        return Ok(());
    }
    let actifs = notes::nb_paiements_actifs(conn, id)?;
    if actifs > 0 {
        return Err(AppError::Validation(format!(
            "annulation impossible : {actifs} paiement(s) sont encore enregistrés              sur cette facture. Annulez-les d'abord."
        )));
    }
    notes::set_statut(conn, id, StatutNote::ANNULEE)
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
        assert_eq!(
            stats::resume(&conn, None, None).unwrap().total_facture,
            27_000
        );
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

    /// Modifier une facture remplace ses lignes et reprend les prix actuels.
    #[test]
    fn update_note_remplace_les_lignes() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let id = create_note(&mut conn, &new_note(client, presta, 1)).unwrap();
        assert_eq!(notes::total(&conn, id).unwrap(), 10_000);

        let mut modif = new_note(client, presta, 4);
        modif.echeance = Some("2026-07-31".into());
        update_note(&mut conn, id, &modif).unwrap();

        assert_eq!(notes::total(&conn, id).unwrap(), 40_000);
        assert_eq!(notes::lignes(&conn, id).unwrap().len(), 1);
        assert_eq!(
            notes::get(&conn, id).unwrap().echeance.as_deref(),
            Some("2026-07-31")
        );
    }

    /// La référence reste celle communiquée au client, même si la date change.
    #[test]
    fn update_note_conserve_la_reference() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let id = create_note(&mut conn, &new_note(client, presta, 1)).unwrap();
        let reference = notes::get(&conn, id).unwrap().reference;

        let mut modif = new_note(client, presta, 1);
        modif.date_emission = "2026-09-02".into();
        update_note(&mut conn, id, &modif).unwrap();

        let apres = notes::get(&conn, id).unwrap();
        assert_eq!(apres.reference, reference);
        assert_eq!(apres.date_emission, "2026-09-02");
    }

    /// Une facture déjà encaissée est verrouillée : un reçu remis au client
    /// atteste d'un montant qui ne doit plus bouger.
    #[test]
    fn update_note_refuse_si_paiement() {
        use crate::models::NewPaiement;
        use crate::services::paiements_service;

        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let id = create_note(&mut conn, &new_note(client, presta, 1)).unwrap();
        paiements_service::enregistrer(
            &mut conn,
            &NewPaiement {
                note_id: id,
                montant: 10_000,
                date_paiement: "2026-06-18".into(),
                methode: None,
            },
        )
        .unwrap();

        assert!(matches!(
            update_note(&mut conn, id, &new_note(client, presta, 2)),
            Err(AppError::Validation(_))
        ));
        assert_eq!(notes::total(&conn, id).unwrap(), 10_000);
    }

    #[test]
    fn update_note_refuse_si_annulee() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let id = create_note(&mut conn, &new_note(client, presta, 1)).unwrap();
        annuler(&conn, id).unwrap();

        assert!(matches!(
            update_note(&mut conn, id, &new_note(client, presta, 2)),
            Err(AppError::Validation(_))
        ));
    }

    /// Une modification invalide ne doit pas laisser la facture amputée de ses
    /// lignes (la suppression et la réinsertion sont dans une transaction).
    #[test]
    fn update_note_invalide_ne_casse_pas_la_facture() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let id = create_note(&mut conn, &new_note(client, presta, 1)).unwrap();

        let mut modif = new_note(client, presta, 1);
        modif.lignes[0].prestation_id = 9_999; // prestation inexistante
        assert!(update_note(&mut conn, id, &modif).is_err());

        assert_eq!(notes::total(&conn, id).unwrap(), 10_000);
        assert_eq!(notes::lignes(&conn, id).unwrap().len(), 1);
    }

    /// Un total de ligne qui déborde l'entier 64 bits est refusé à la saisie.
    /// SQLite ne signalerait rien : il basculerait en flottant, et la relecture
    /// échouerait bien plus tard sur une erreur de type illisible.
    #[test]
    fn total_qui_deborde_est_refuse() {
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
                libelle: "Astronomique".into(),
                prix: i64::MAX / 2,
            },
        )
        .unwrap();

        let mut n = new_note(client, presta, 1);
        n.lignes[0].quantite = 10;
        match create_note(&mut conn, &n).unwrap_err() {
            AppError::Validation(msg) => assert!(msg.contains("trop élevé"), "message: {msg}"),
            other => panic!("expected Validation, got {other:?}"),
        }
        // Rien n'a été écrit.
        assert!(notes::list(&conn).unwrap().is_empty());
    }

    /// La séquence des références repart du dernier numéro attribué. Avec un
    /// `COUNT(*)`, un trou dans la série faisait reculer la séquence et deux
    /// factures se retrouvaient avec la même référence.
    #[test]
    fn reference_repart_du_dernier_numero() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        create_note(&mut conn, &new_note(client, presta, 1)).unwrap();
        let deuxieme = create_note(&mut conn, &new_note(client, presta, 1)).unwrap();
        let troisieme = create_note(&mut conn, &new_note(client, presta, 1)).unwrap();
        assert_eq!(
            notes::get(&conn, troisieme).unwrap().reference.as_deref(),
            Some("26-06-0003")
        );

        // Base retouchée à la main : il manque la facture du milieu.
        conn.execute("DELETE FROM notes_de_frais WHERE id = ?1", [deuxieme])
            .unwrap();

        let suivante = create_note(&mut conn, &new_note(client, presta, 1)).unwrap();
        assert_eq!(
            notes::get(&conn, suivante).unwrap().reference.as_deref(),
            Some("26-06-0004"),
            "la séquence ne doit pas recycler une référence déjà attribuée"
        );
    }

    /// Même défaut que pour les numéros de reçu, atténué par la remise à zéro
    /// mensuelle : un `MAX(reference)` textuel classe « 26-06-10000 » avant
    /// « 26-06-9999 » et rend deux fois la même référence.
    #[test]
    fn reference_ne_recycle_pas_au_dela_de_9999_dans_le_mois() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let id = create_note(&mut conn, &new_note(client, presta, 1)).unwrap();
        conn.execute(
            "UPDATE notes_de_frais SET reference = '26-06-9999' WHERE id = ?1",
            [id],
        )
        .unwrap();
        let id2 = create_note(&mut conn, &new_note(client, presta, 1)).unwrap();
        conn.execute(
            "UPDATE notes_de_frais SET reference = '26-06-10000' WHERE id = ?1",
            [id2],
        )
        .unwrap();

        let id3 = create_note(&mut conn, &new_note(client, presta, 1)).unwrap();
        assert_eq!(
            notes::get(&conn, id3).unwrap().reference.as_deref(),
            Some("26-06-10001")
        );
    }

    /// Une facture entièrement remisée est soldée dès son émission : aucun
    /// paiement ne peut la solder après coup (un montant nul est refusé), donc
    /// exiger un encaissement la laissait « emise » à vie.
    #[test]
    fn note_a_net_nul_est_payee_des_la_creation() {
        use crate::services::paiements_service;

        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn); // 10 000
        let mut n = new_note(client, presta, 1);
        n.remise_type = Some(REMISE_POURCENT.into());
        n.remise_valeur = 100;
        let id = create_note(&mut conn, &n).unwrap();

        assert_eq!(notes::total(&conn, id).unwrap(), 0);
        assert_eq!(notes::statut(&conn, id).unwrap(), StatutNote::PAYEE);
        assert!(paiements_service::solde(&conn, id).unwrap().payee);
    }

    /// Une facture ordinaire reste « emise » à la création : le recalcul de
    /// statut ne doit pas solder ce qui reste dû.
    #[test]
    fn note_ordinaire_reste_emise_a_la_creation() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let id = create_note(&mut conn, &new_note(client, presta, 1)).unwrap();
        assert_eq!(notes::statut(&conn, id).unwrap(), StatutNote::EMISE);
    }

    /// Retirer la remise d'une facture soldée à 0 la remet en « emise » : le
    /// statut suit le net après modification, dans les deux sens.
    #[test]
    fn update_note_realigne_le_statut_sur_le_net() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let mut n = new_note(client, presta, 1);
        n.remise_type = Some(REMISE_POURCENT.into());
        n.remise_valeur = 100;
        let id = create_note(&mut conn, &n).unwrap();
        assert_eq!(notes::statut(&conn, id).unwrap(), StatutNote::PAYEE);

        update_note(&mut conn, id, &new_note(client, presta, 1)).unwrap();

        assert_eq!(notes::total(&conn, id).unwrap(), 10_000);
        assert_eq!(notes::statut(&conn, id).unwrap(), StatutNote::EMISE);
    }

    /// La règle n'existait que dans le formulaire : un appel direct à la
    /// commande créait une facture due avant d'exister.
    #[test]
    fn echeance_anterieure_a_lemission_est_refusee() {
        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);

        let mut n = new_note(client, presta, 1); // émise le 2026-06-18
        n.echeance = Some("2026-06-17".into());
        assert!(matches!(
            create_note(&mut conn, &n),
            Err(AppError::Validation(_))
        ));

        // Une échéance le jour même, ou plus tard, reste acceptée.
        let mut meme_jour = new_note(client, presta, 1);
        meme_jour.echeance = Some("2026-06-18".into());
        let id = create_note(&mut conn, &meme_jour).unwrap();

        // Et la modification applique la même règle.
        let mut modif = new_note(client, presta, 1);
        modif.echeance = Some("2026-06-01".into());
        assert!(matches!(
            update_note(&mut conn, id, &modif),
            Err(AppError::Validation(_))
        ));
    }

    /// Annuler une facture sans paiement la retire des totaux mais la conserve.
    #[test]
    fn annuler_exclut_des_totaux_sans_supprimer() {
        use crate::repositories::stats;

        let mut conn = open_in_memory().unwrap();
        let (client, presta) = seed(&conn);
        let id = create_note(&mut conn, &new_note(client, presta, 2)).unwrap();
        assert_eq!(
            stats::resume(&conn, None, None).unwrap().total_facture,
            20_000
        );

        annuler(&conn, id).unwrap();

        assert_eq!(stats::resume(&conn, None, None).unwrap().total_facture, 0);
        assert_eq!(stats::resume(&conn, None, None).unwrap().nb_notes, 0);
        // La facture reste consultable, avec ses lignes.
        assert_eq!(notes::get(&conn, id).unwrap().statut, StatutNote::ANNULEE);
        assert_eq!(notes::lignes(&conn, id).unwrap().len(), 1);
    }
}
