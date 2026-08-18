use super::{db, DbState};
use crate::error::AppResult;
use crate::models::{NewPrestation, Prestation};
use crate::repositories::prestations;
use tauri::State;

#[tauri::command]
pub fn list_prestations(state: State<'_, DbState>) -> AppResult<Vec<Prestation>> {
    let conn = db(&state);
    prestations::list(&conn)
}

#[tauri::command]
pub fn get_prestation(state: State<'_, DbState>, id: i64) -> AppResult<Prestation> {
    let conn = db(&state);
    prestations::get(&conn, id)
}

#[tauri::command]
pub fn create_prestation(state: State<'_, DbState>, prestation: NewPrestation) -> AppResult<i64> {
    let conn = db(&state);
    prestations::create(&conn, &prestation)
}

#[tauri::command]
pub fn update_prestation(state: State<'_, DbState>, prestation: Prestation) -> AppResult<()> {
    let conn = db(&state);
    prestations::update(&conn, &prestation)
}

#[tauri::command]
pub fn delete_prestation(state: State<'_, DbState>, id: i64) -> AppResult<()> {
    let conn = db(&state);
    prestations::delete(&conn, id)
}

#[tauri::command]
pub fn list_prestations_actives(state: State<'_, DbState>) -> AppResult<Vec<Prestation>> {
    let conn = db(&state);
    prestations::list_actives(&conn)
}

#[tauri::command]
pub fn archiver_prestation(state: State<'_, DbState>, id: i64, actif: bool) -> AppResult<()> {
    let conn = db(&state);
    prestations::set_actif(&conn, id, actif)
}
