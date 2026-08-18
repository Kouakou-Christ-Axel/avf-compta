use crate::error::{AppError, AppResult};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

// Le chemin de fichier ne doit jamais être un argument reçu du JavaScript :
// un renderer compromis pourrait alors faire écrire ou lire n'importe quel
// fichier du disque via ces commandes. C'est pourquoi le dialogue s'ouvre
// ici, côté Rust, et pourquoi ces commandes sont dédiées au CSV plutôt que
// génériques (chemin + octets).
//
// Les commandes sont déclarées en `async fn` pour que Tauri les exécute sur
// le runtime asynchrone plutôt que sur le thread principal : les API
// `blocking_*` de tauri-plugin-dialog bloquent l'appelant jusqu'à la
// fermeture de la boîte de dialogue, et une commande `#[tauri::command]`
// synchrone tourne sur le thread principal dans Tauri 2 — l'appeler ainsi
// gèlerait l'interface tant que l'utilisateur n'a pas répondu.

/// Ouvre « Enregistrer sous » filtré sur .csv et écrit le contenu en UTF-8.
/// Renvoie `false` si l'utilisateur annule.
#[tauri::command]
pub async fn exporter_csv(app: AppHandle, nom_defaut: String, contenu: String) -> AppResult<bool> {
    let choix = app
        .dialog()
        .file()
        .set_title("Enregistrer sous")
        .set_file_name(&nom_defaut)
        .add_filter("CSV", &["csv"])
        .blocking_save_file();

    let Some(chemin) = choix else {
        return Ok(false);
    };
    let chemin = chemin
        .into_path()
        .map_err(|e| AppError::Io(e.to_string()))?;
    std::fs::write(&chemin, contenu.as_bytes()).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(true)
}

/// Ouvre « Ouvrir » filtré sur .csv et renvoie le contenu texte, ou `None` si
/// l'utilisateur annule.
#[tauri::command]
pub async fn importer_csv(app: AppHandle) -> AppResult<Option<String>> {
    let choix = app
        .dialog()
        .file()
        .set_title("Ouvrir")
        .add_filter("CSV", &["csv"])
        .blocking_pick_file();

    let Some(chemin) = choix else {
        return Ok(None);
    };
    let chemin = chemin
        .into_path()
        .map_err(|e| AppError::Io(e.to_string()))?;
    let contenu = std::fs::read_to_string(&chemin).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(Some(contenu))
}
