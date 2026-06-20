use crate::error::{AppError, AppResult};

/// Écrit des octets bruts à un chemin choisi par l'utilisateur (via la boîte
/// « Enregistrer sous » côté frontend). Sert à enregistrer les PDF/CSV générés.
#[tauri::command]
pub fn enregistrer_fichier(chemin: String, contenu: Vec<u8>) -> AppResult<()> {
    std::fs::write(&chemin, &contenu).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}

/// Lit un fichier texte choisi par l'utilisateur (import CSV).
#[tauri::command]
pub fn lire_fichier(chemin: String) -> AppResult<String> {
    std::fs::read_to_string(&chemin).map_err(|e| AppError::Io(e.to_string()))
}
