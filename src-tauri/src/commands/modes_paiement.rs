use super::{db, DbState};
use crate::error::AppResult;
use crate::models::ModePaiement;
use crate::repositories::modes_paiement as repo;
use tauri::State;

#[tauri::command]
pub fn list_modes_paiement(state: State<'_, DbState>) -> AppResult<Vec<ModePaiement>> {
    let conn = db(&state);
    repo::list(&conn)
}

#[tauri::command]
pub fn create_mode_paiement(state: State<'_, DbState>, libelle: String) -> AppResult<i64> {
    let conn = db(&state);
    repo::create(&conn, &libelle)
}

#[tauri::command]
pub fn delete_mode_paiement(state: State<'_, DbState>, id: i64) -> AppResult<()> {
    let conn = db(&state);
    repo::delete(&conn, id)
}
