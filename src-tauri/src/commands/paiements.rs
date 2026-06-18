use super::DbState;
use crate::error::AppResult;
use crate::models::{NewPaiement, Paiement, SoldeNote};
use crate::repositories::paiements;
use crate::services::paiements_service;
use tauri::State;

#[tauri::command]
pub fn list_paiements(state: State<'_, DbState>, note_id: i64) -> AppResult<Vec<Paiement>> {
    let conn = state.lock().unwrap();
    paiements::list_by_note(&conn, note_id)
}

#[tauri::command]
pub fn solde_note(state: State<'_, DbState>, note_id: i64) -> AppResult<SoldeNote> {
    let conn = state.lock().unwrap();
    paiements_service::solde(&conn, note_id)
}

#[tauri::command]
pub fn enregistrer_paiement(state: State<'_, DbState>, paiement: NewPaiement) -> AppResult<i64> {
    let conn = state.lock().unwrap();
    paiements_service::enregistrer(&conn, &paiement)
}
