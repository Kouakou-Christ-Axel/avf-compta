use super::{db, DbState};
use crate::db::sauvegarde;
use crate::error::{AppError, AppResult};
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;

fn dossier_donnees(app: &tauri::AppHandle) -> AppResult<std::path::PathBuf> {
    app.path()
        .app_data_dir()
        .map_err(|e| AppError::Io(e.to_string()))
}

/// Nom de fichier suggéré pour une sauvegarde, horodaté à la journée.
fn nom_sauvegarde_par_defaut() -> String {
    let aujourdhui = chrono::Local::now().format("%Y-%m-%d");
    format!("avf-compta-{aujourdhui}.sqlite")
}

// Le chemin ne doit jamais venir du JavaScript (voir commands::fichiers) :
// ces commandes ouvrent donc elles-mêmes leur boîte de dialogue, et sont
// déclarées en `async fn` pour tourner sur le runtime asynchrone plutôt que
// sur le thread principal — les API `blocking_*` de tauri-plugin-dialog
// gèleraient l'interface si elles s'exécutaient sur ce dernier.

/// Écrit une copie de la base à l'emplacement choisi par l'utilisateur.
/// Renvoie `false` si l'utilisateur annule.
#[tauri::command]
pub async fn sauvegarder_base(app: tauri::AppHandle, state: State<'_, DbState>) -> AppResult<bool> {
    let choix = app
        .dialog()
        .file()
        .set_title("Enregistrer une sauvegarde")
        .set_file_name(nom_sauvegarde_par_defaut())
        .add_filter("Sauvegarde avf-compta", &["sqlite"])
        .blocking_save_file();

    let Some(chemin) = choix else {
        return Ok(false);
    };
    let chemin = chemin
        .into_path()
        .map_err(|e| AppError::Io(e.to_string()))?;
    let conn = db(&state);
    sauvegarde::sauvegarder(&conn, &chemin.to_string_lossy())?;
    Ok(true)
}

/// Prépare la restauration d'une sauvegarde choisie par l'utilisateur. Elle
/// prend effet au redémarrage : le fichier de base ne peut pas être remplacé
/// tant que l'application le tient ouvert. Renvoie `false` si l'utilisateur
/// annule.
#[tauri::command]
pub async fn restaurer_base(app: tauri::AppHandle) -> AppResult<bool> {
    let choix = app
        .dialog()
        .file()
        .set_title("Restaurer une sauvegarde")
        .add_filter("Sauvegarde avf-compta", &["sqlite"])
        .blocking_pick_file();

    let Some(chemin) = choix else {
        return Ok(false);
    };
    let chemin = chemin
        .into_path()
        .map_err(|e| AppError::Io(e.to_string()))?;
    sauvegarde::restaurer(&dossier_donnees(&app)?, &chemin.to_string_lossy())?;
    Ok(true)
}

/// Emplacement du fichier de base, affiché dans les Paramètres.
#[tauri::command]
pub fn chemin_base(app: tauri::AppHandle) -> AppResult<String> {
    Ok(dossier_donnees(&app)?
        .join(sauvegarde::DB_FILE)
        .to_string_lossy()
        .into_owned())
}
