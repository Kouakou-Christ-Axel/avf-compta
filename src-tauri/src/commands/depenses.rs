use super::DbState;
use crate::error::AppResult;
use crate::models::{Depense, NewDepense};
use crate::repositories::depenses;
use tauri::State;

#[tauri::command]
pub fn list_depenses(state: State<'_, DbState>, note_id: i64) -> AppResult<Vec<Depense>> {
    let conn = state.lock().unwrap();
    depenses::list_by_note(&conn, note_id)
}

#[tauri::command]
pub fn create_depense(state: State<'_, DbState>, depense: NewDepense) -> AppResult<i64> {
    let conn = state.lock().unwrap();
    depenses::create(&conn, &depense)
}

#[tauri::command]
pub fn delete_depense(state: State<'_, DbState>, id: i64) -> AppResult<()> {
    let conn = state.lock().unwrap();
    depenses::delete(&conn, id)
}
