mod commands;
mod db;
mod error;
mod models;
// Utilitaire monétaire canonique : arithmétique protégée contre le
// débordement et formatage français des montants.
mod money;
mod repositories;
mod services;

use crate::error::{AppError, AppResult};
use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;
use tauri::Manager;

/// Applique une restauration en attente puis ouvre la base, prête à l'emploi.
fn ouvrir_base(dir: &Path) -> AppResult<Connection> {
    std::fs::create_dir_all(dir).map_err(|e| AppError::Io(e.to_string()))?;
    // Une sauvegarde déposée par « Restaurer » remplace la base ici, avant
    // toute ouverture : le fichier ne peut pas être écrasé tant qu'une
    // connexion le tient (impossible sous Windows).
    db::sauvegarde::appliquer_restauration_en_attente(dir)?;
    db::open(dir.join(db::sauvegarde::DB_FILE))
}

/// Signale un démarrage impossible, puis arrête le processus.
///
/// Sans cela, une erreur ici (migration en échec, base illisible) remontait
/// jusqu'au `.expect` final : sur un binaire graphique Windows, une panique
/// ferme la fenêtre **sans le moindre message**, et l'utilisateur n'a plus
/// qu'une application qui « ne se lance plus ».
///
/// La boîte est affichée par `rfd` directement, et non par le plugin dialogue :
/// celui-ci passe par `run_on_main_thread`, or la boucle d'événements n'a pas
/// encore démarré à cet instant.
fn echec_demarrage(dir: Option<&Path>, erreur: &AppError) -> ! {
    let mut detail = format!("{erreur}");

    if let Some(dir) = dir {
        let journal = dir.join("demarrage-erreur.log");
        let ligne = format!("[{}] {erreur}\n", crate::repositories::now());
        let ecrit = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&journal)
            .and_then(|mut f| std::io::Write::write_all(&mut f, ligne.as_bytes()));
        detail = format!(
            "{erreur}\n\nVos données ne sont pas perdues : elles restent dans\n{}",
            dir.display()
        );
        if ecrit.is_ok() {
            detail.push_str(&format!(
                "\n\nDétail enregistré dans :\n{}",
                journal.display()
            ));
        }
    }

    eprintln!("Démarrage impossible : {erreur}");
    rfd::MessageDialog::new()
        .set_level(rfd::MessageLevel::Error)
        .set_title("avf-compta n'a pas pu démarrer")
        .set_description(&detail)
        .show();
    std::process::exit(1);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Mise à jour automatique (desktop uniquement).
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }

            // Un échec ici n'est jamais silencieux : l'utilisateur voit ce qui
            // a bloqué, et où retrouver ses données.
            let dir = match app.path().app_data_dir() {
                Ok(dir) => dir,
                Err(e) => echec_demarrage(None, &AppError::Io(e.to_string())),
            };
            match ouvrir_base(&dir) {
                Ok(conn) => {
                    app.manage(Mutex::new(conn));
                }
                Err(e) => echec_demarrage(Some(&dir), &e),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::clients::list_clients,
            commands::clients::list_clients_resume,
            commands::clients::get_client,
            commands::clients::create_client,
            commands::clients::update_client,
            commands::clients::delete_client,
            commands::prestations::list_prestations,
            commands::prestations::get_prestation,
            commands::prestations::create_prestation,
            commands::prestations::update_prestation,
            commands::prestations::delete_prestation,
            commands::prestations::list_prestations_actives,
            commands::prestations::archiver_prestation,
            commands::notes::list_notes,
            commands::notes::list_notes_resume,
            commands::notes::get_note,
            commands::notes::create_note,
            commands::notes::update_note,
            commands::notes::annuler_note,
            commands::paiements::list_paiements,
            commands::paiements::solde_note,
            commands::paiements::enregistrer_paiement,
            commands::paiements::annuler_paiement,
            commands::recus::list_recus,
            commands::recus::list_recus_resume,
            commands::recus::get_recu,
            commands::recus::generer_recu,
            commands::recus::annuler_recu,
            commands::stats::resume_stats,
            commands::stats::stats_mensuelles,
            commands::parametres::get_parametres,
            commands::parametres::save_parametres,
            commands::depenses::list_depenses,
            commands::depenses::list_all_depenses,
            commands::depenses::create_depense,
            commands::depenses::delete_depense,
            commands::modes_paiement::list_modes_paiement,
            commands::modes_paiement::create_mode_paiement,
            commands::modes_paiement::delete_mode_paiement,
            commands::fichiers::exporter_csv,
            commands::fichiers::importer_csv,
            commands::sauvegarde::sauvegarder_base,
            commands::sauvegarde::restaurer_base,
            commands::sauvegarde::chemin_base,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Le démarrage doit refuser un fichier qui n'est pas une base avf-compta
    /// plutôt que de le corrompre — et l'erreur doit être exploitable.
    #[test]
    fn ouvrir_base_signale_un_fichier_illisible() {
        let dir = std::env::temp_dir().join("avf-compta-test-demarrage");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join(db::sauvegarde::DB_FILE),
            b"ceci n'est pas une base",
        )
        .unwrap();

        let erreur = ouvrir_base(&dir).unwrap_err();
        assert!(
            !format!("{erreur}").is_empty(),
            "l'erreur doit porter un message affichable"
        );
    }

    /// Cas nominal : une base absente est créée et migrée.
    #[test]
    fn ouvrir_base_cree_une_base_neuve() {
        let dir = std::env::temp_dir().join("avf-compta-test-demarrage-neuf");
        let _ = std::fs::remove_dir_all(&dir);

        let conn = ouvrir_base(&dir).unwrap();
        let clients: i64 = conn
            .query_row("SELECT COUNT(*) FROM clients", [], |r| r.get(0))
            .unwrap();
        assert_eq!(clients, 0);
    }
}
