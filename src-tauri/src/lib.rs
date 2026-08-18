mod commands;
mod db;
mod error;
mod models;
// Utilitaire monétaire canonique (analyse/format des montants), entièrement
// testé et destiné à la couche commandes/UI ; conservé même si non encore
// appelé hors tests.
#[allow(dead_code)]
mod money;
mod repositories;
mod services;

use std::sync::Mutex;
use tauri::Manager;

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

            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            // Une sauvegarde déposée par « Restaurer » remplace la base ici,
            // avant toute ouverture : le fichier ne peut pas être écrasé tant
            // qu'une connexion le tient (impossible sous Windows).
            db::sauvegarde::appliquer_restauration_en_attente(&dir)?;
            let conn = db::open(dir.join(db::sauvegarde::DB_FILE))?;
            app.manage(Mutex::new(conn));
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
            commands::notes::delete_note,
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
            commands::fichiers::enregistrer_fichier,
            commands::fichiers::lire_fichier,
            commands::sauvegarde::sauvegarder_base,
            commands::sauvegarde::restaurer_base,
            commands::sauvegarde::chemin_base,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
