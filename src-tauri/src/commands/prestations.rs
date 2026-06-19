use super::DbState;
use crate::error::AppResult;
use crate::models::{NewPrestation, Prestation};
use crate::repositories::prestations;
use tauri::State;

#[tauri::command]
pub fn list_prestations(state: State<'_, DbState>) -> AppResult<Vec<Prestation>> {
    let conn = state.lock().unwrap();
    prestations::list(&conn)
}

#[tauri::command]
pub fn get_prestation(state: State<'_, DbState>, id: i64) -> AppResult<Prestation> {
    let conn = state.lock().unwrap();
    prestations::get(&conn, id)
}

#[tauri::command]
pub fn create_prestation(state: State<'_, DbState>, prestation: NewPrestation) -> AppResult<i64> {
    let conn = state.lock().unwrap();
    prestations::create(&conn, &prestation)
}

#[tauri::command]
pub fn update_prestation(state: State<'_, DbState>, prestation: Prestation) -> AppResult<()> {
    let conn = state.lock().unwrap();
    prestations::update(&conn, &prestation)
}

#[tauri::command]
pub fn delete_prestation(state: State<'_, DbState>, id: i64) -> AppResult<()> {
    let conn = state.lock().unwrap();
    prestations::delete(&conn, id)
}
