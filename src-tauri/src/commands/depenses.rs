use super::{db, DbState};
use crate::error::AppResult;
use crate::models::{Depense, DepenseLigne, NewDepense};
use crate::repositories::depenses;
use crate::services::depenses_service;
use tauri::State;

#[tauri::command]
pub fn list_depenses(state: State<'_, DbState>, note_id: i64) -> AppResult<Vec<Depense>> {
    let conn = db(&state);
    depenses::list_by_note(&conn, note_id)
}

#[tauri::command]
pub fn list_all_depenses(state: State<'_, DbState>) -> AppResult<Vec<DepenseLigne>> {
    let conn = db(&state);
    depenses::list_all(&conn)
}

#[tauri::command]
pub fn create_depense(state: State<'_, DbState>, depense: NewDepense) -> AppResult<i64> {
    let conn = db(&state);
    depenses_service::create(&conn, &depense)
}

#[tauri::command]
pub fn delete_depense(state: State<'_, DbState>, id: i64) -> AppResult<()> {
    let conn = db(&state);
    depenses::delete(&conn, id)
}
