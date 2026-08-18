//! Sauvegarde et restauration du fichier de base de données.
//!
//! La restauration ne peut pas écraser le fichier pendant que l'application le
//! tient ouvert (impossible sous Windows). Le fichier choisi est donc recopié
//! sous un nom de transit, et c'est **au démarrage suivant**, avant toute
//! ouverture, que la bascule est faite. L'interface propose de redémarrer.

use crate::error::{AppError, AppResult};
use rusqlite::Connection;
use std::path::{Path, PathBuf};

/// Nom du fichier de base dans le dossier de données de l'application.
pub const DB_FILE: &str = "avf_compta.sqlite";
/// Sauvegarde déposée par `restaurer`, appliquée au prochain démarrage.
pub const RESTORE_FILE: &str = "avf_compta.sqlite.a-restaurer";

/// Écrit une copie cohérente de la base à l'emplacement choisi.
///
/// `VACUUM INTO` produit un fichier complet et compacté sans interrompre la
/// connexion en cours, contrairement à une copie brute du fichier qui peut
/// attraper un état intermédiaire.
pub fn sauvegarder(conn: &Connection, destination: &str) -> AppResult<()> {
    if destination.trim().is_empty() {
        return Err(AppError::Validation("chemin de sauvegarde manquant".into()));
    }
    // Une destination existante ferait échouer VACUUM INTO : la boîte
    // « Enregistrer sous » a déjà demandé confirmation à l'utilisateur.
    if Path::new(destination).exists() {
        std::fs::remove_file(destination).map_err(|e| AppError::Io(e.to_string()))?;
    }
    conn.execute("VACUUM INTO ?1", [destination])?;
    Ok(())
}

/// Vérifie que le fichier choisi est bien une base avf-compta, puis le dépose
/// en transit pour le prochain démarrage.
pub fn restaurer(dossier: &Path, source: &str) -> AppResult<()> {
    verifier_base(source)?;
    std::fs::copy(source, dossier.join(RESTORE_FILE)).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}

/// Refuse tout fichier qui n'est pas une base SQLite contenant nos tables :
/// sans ce contrôle, restaurer un fichier quelconque rendrait l'application
/// impossible à ouvrir.
fn verifier_base(source: &str) -> AppResult<()> {
    let conn = Connection::open(source).map_err(|_| {
        AppError::Validation("ce fichier n'est pas une sauvegarde avf-compta".into())
    })?;
    let tables: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master
              WHERE type = 'table'
                AND name IN ('clients', 'prestations', 'notes_de_frais', 'paiements', 'recus')",
            [],
            |r| r.get(0),
        )
        .map_err(|_| {
            AppError::Validation("ce fichier n'est pas une sauvegarde avf-compta".into())
        })?;
    if tables < 5 {
        return Err(AppError::Validation(
            "ce fichier n'est pas une sauvegarde avf-compta".into(),
        ));
    }
    Ok(())
}

/// Applique une restauration en attente, si elle existe. Appelé au démarrage
/// **avant** l'ouverture de la base. La base remplacée est conservée en
/// `.avant-restauration` : une fausse manœuvre reste rattrapable.
pub fn appliquer_restauration_en_attente(dossier: &Path) -> AppResult<bool> {
    let transit = dossier.join(RESTORE_FILE);
    if !transit.exists() {
        return Ok(false);
    }
    let base = dossier.join(DB_FILE);
    if base.exists() {
        let precedente: PathBuf = dossier.join(format!("{DB_FILE}.avant-restauration"));
        std::fs::rename(&base, &precedente).map_err(|e| AppError::Io(e.to_string()))?;
    }
    std::fs::rename(&transit, &base).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open;

    fn dossier_temporaire(nom: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("avf-compta-test-{nom}"));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn sauvegarde_puis_restauration_conserve_les_donnees() {
        let dossier = dossier_temporaire("aller-retour");
        let base = dossier.join(DB_FILE);
        {
            let conn = open(&base).unwrap();
            conn.execute(
                "INSERT INTO clients (nom, cree_le) VALUES ('Acme', '2026-01-01')",
                [],
            )
            .unwrap();

            let copie = dossier.join("sauvegarde.sqlite");
            sauvegarder(&conn, copie.to_str().unwrap()).unwrap();
            assert!(copie.exists());

            // La base courante diverge après la sauvegarde…
            conn.execute(
                "INSERT INTO clients (nom, cree_le) VALUES ('Bêta', '2026-01-02')",
                [],
            )
            .unwrap();

            restaurer(&dossier, copie.to_str().unwrap()).unwrap();
        }

        assert!(appliquer_restauration_en_attente(&dossier).unwrap());
        let conn = open(&base).unwrap();
        let noms: Vec<String> = conn
            .prepare("SELECT nom FROM clients")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();
        assert_eq!(noms, ["Acme"], "la sauvegarde doit avoir remplacé la base");
        // La base d'avant reste récupérable.
        assert!(dossier
            .join(format!("{DB_FILE}.avant-restauration"))
            .exists());
    }

    #[test]
    fn restaurer_refuse_un_fichier_etranger() {
        let dossier = dossier_temporaire("fichier-etranger");
        let intrus = dossier.join("notes.txt");
        std::fs::write(&intrus, b"ceci n'est pas une base").unwrap();

        assert!(matches!(
            restaurer(&dossier, intrus.to_str().unwrap()),
            Err(AppError::Validation(_))
        ));
        assert!(!dossier.join(RESTORE_FILE).exists());
    }

    #[test]
    fn sans_restauration_en_attente_le_demarrage_ne_touche_a_rien() {
        let dossier = dossier_temporaire("sans-attente");
        assert!(!appliquer_restauration_en_attente(&dossier).unwrap());
    }
}
