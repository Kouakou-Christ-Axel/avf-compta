use super::{db, DbState};
use crate::db::sauvegarde;
use crate::error::{AppError, AppResult};
use tauri::{Manager, State};

fn dossier_donnees(app: &tauri::AppHandle) -> AppResult<std::path::PathBuf> {
    app.path()
        .app_data_dir()
        .map_err(|e| AppError::Io(e.to_string()))
}

/// Écrit une copie de la base à l'emplacement choisi par l'utilisateur.
#[tauri::command]
pub fn sauvegarder_base(state: State<'_, DbState>, chemin: String) -> AppResult<()> {
    let conn = db(&state);
    sauvegarde::sauvegarder(&conn, &chemin)
}

/// Prépare la restauration d'une sauvegarde. Elle prend effet au redémarrage :
/// le fichier de base ne peut pas être remplacé tant que l'application le tient
/// ouvert.
#[tauri::command]
pub fn restaurer_base(app: tauri::AppHandle, chemin: String) -> AppResult<()> {
    sauvegarde::restaurer(&dossier_donnees(&app)?, &chemin)
}

/// Emplacement du fichier de base, affiché dans les Paramètres.
#[tauri::command]
pub fn chemin_base(app: tauri::AppHandle) -> AppResult<String> {
    Ok(dossier_donnees(&app)?
        .join(sauvegarde::DB_FILE)
        .to_string_lossy()
        .into_owned())
}
