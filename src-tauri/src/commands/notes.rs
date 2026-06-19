use super::DbState;
use crate::error::AppResult;
use crate::models::{NewNote, NoteDeFrais, NoteDetail, NoteResume};
use crate::repositories::notes;
use crate::services::notes_service;
use tauri::State;

#[tauri::command]
pub fn list_notes(state: State<'_, DbState>) -> AppResult<Vec<NoteDeFrais>> {
    let conn = state.lock().unwrap();
    notes::list(&conn)
}

#[tauri::command]
pub fn list_notes_resume(state: State<'_, DbState>) -> AppResult<Vec<NoteResume>> {
    let conn = state.lock().unwrap();
    notes::list_resume(&conn)
}

#[tauri::command]
pub fn get_note(state: State<'_, DbState>, id: i64) -> AppResult<NoteDetail> {
    let conn = state.lock().unwrap();
    notes::detail(&conn, id)
}

#[tauri::command]
pub fn create_note(state: State<'_, DbState>, note: NewNote) -> AppResult<i64> {
    let mut conn = state.lock().unwrap();
    notes_service::create_note(&mut conn, &note)
}

#[tauri::command]
pub fn delete_note(state: State<'_, DbState>, id: i64) -> AppResult<()> {
    let conn = state.lock().unwrap();
    notes::delete(&conn, id)
}
