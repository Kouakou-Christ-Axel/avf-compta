use super::DbState;
use crate::error::AppResult;
use crate::models::Parametres;
use crate::repositories::parametres as repo;
use tauri::State;

#[tauri::command]
pub fn get_parametres(state: State<'_, DbState>) -> AppResult<Parametres> {
    let conn = state.lock().unwrap();
    repo::get(&conn)
}

#[tauri::command]
pub fn save_parametres(state: State<'_, DbState>, parametres: Parametres) -> AppResult<()> {
    let conn = state.lock().unwrap();
    repo::save(&conn, &parametres)
}
