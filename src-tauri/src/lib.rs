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

const DB_FILE: &str = "avf_compta.sqlite";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
            let conn = db::open(dir.join(DB_FILE))?;
            app.manage(Mutex::new(conn));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::clients::list_clients,
            commands::clients::get_client,
            commands::clients::create_client,
            commands::clients::update_client,
            commands::clients::delete_client,
            commands::prestations::list_prestations,
            commands::prestations::get_prestation,
            commands::prestations::create_prestation,
            commands::prestations::update_prestation,
            commands::prestations::delete_prestation,
            commands::notes::list_notes,
            commands::notes::get_note,
            commands::notes::create_note,
            commands::notes::delete_note,
            commands::paiements::list_paiements,
            commands::paiements::solde_note,
            commands::paiements::enregistrer_paiement,
            commands::recus::list_recus,
            commands::recus::get_recu,
            commands::recus::generer_recu,
            commands::stats::resume_stats,
            commands::parametres::get_parametres,
            commands::parametres::save_parametres,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
