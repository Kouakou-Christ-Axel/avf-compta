use super::DbState;
use crate::error::AppResult;
use crate::models::{Recu, RecuDetail};
use crate::repositories::recus;
use crate::services::recus_service;
use tauri::State;

#[tauri::command]
pub fn list_recus(state: State<'_, DbState>) -> AppResult<Vec<Recu>> {
    let conn = state.lock().unwrap();
    recus::list(&conn)
}

#[tauri::command]
pub fn get_recu(state: State<'_, DbState>, id: i64) -> AppResult<RecuDetail> {
    let conn = state.lock().unwrap();
    recus::detail(&conn, id)
}

#[tauri::command]
pub fn generer_recu(state: State<'_, DbState>, paiement_id: i64) -> AppResult<Recu> {
    let conn = state.lock().unwrap();
    recus_service::generer(&conn, paiement_id)
}
