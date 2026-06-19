use crate::error::{AppError, AppResult};

/// Écrit des octets bruts à un chemin choisi par l'utilisateur (via la boîte
/// « Enregistrer sous » côté frontend). Sert à enregistrer les PDF générés.
#[tauri::command]
pub fn enregistrer_fichier(chemin: String, contenu: Vec<u8>) -> AppResult<()> {
    std::fs::write(&chemin, &contenu).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}
