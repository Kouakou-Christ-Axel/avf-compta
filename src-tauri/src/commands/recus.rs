use super::{db, DbState};
use crate::error::AppResult;
use crate::models::{Recu, RecuDetail, RecuResume};
use crate::repositories::recus;
use crate::services::recus_service;
use tauri::State;

#[tauri::command]
pub fn list_recus(state: State<'_, DbState>) -> AppResult<Vec<Recu>> {
    let conn = db(&state);
    recus::list(&conn)
}

#[tauri::command]
pub fn list_recus_resume(state: State<'_, DbState>) -> AppResult<Vec<RecuResume>> {
    let conn = db(&state);
    recus::list_resume(&conn)
}

#[tauri::command]
pub fn get_recu(state: State<'_, DbState>, id: i64) -> AppResult<RecuDetail> {
    let conn = db(&state);
    recus::detail(&conn, id)
}

#[tauri::command]
pub fn generer_recu(state: State<'_, DbState>, paiement_id: i64) -> AppResult<Recu> {
    let conn = db(&state);
    recus_service::generer(&conn, paiement_id)
}

#[tauri::command]
pub fn annuler_recu(state: State<'_, DbState>, id: i64) -> AppResult<()> {
    let mut conn = db(&state);
    recus_service::annuler(&mut conn, id)
}
