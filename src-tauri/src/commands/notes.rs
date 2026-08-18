use super::{db, DbState};
use crate::error::AppResult;
use crate::models::{NewNote, NoteDeFrais, NoteDetail, NoteResume};
use crate::repositories::notes;
use crate::services::notes_service;
use tauri::State;

#[tauri::command]
pub fn list_notes(state: State<'_, DbState>) -> AppResult<Vec<NoteDeFrais>> {
    let conn = db(&state);
    notes::list(&conn)
}

#[tauri::command]
pub fn list_notes_resume(state: State<'_, DbState>) -> AppResult<Vec<NoteResume>> {
    let conn = db(&state);
    notes::list_resume(&conn)
}

#[tauri::command]
pub fn get_note(state: State<'_, DbState>, id: i64) -> AppResult<NoteDetail> {
    let conn = db(&state);
    notes::detail(&conn, id)
}

#[tauri::command]
pub fn create_note(state: State<'_, DbState>, note: NewNote) -> AppResult<i64> {
    let mut conn = db(&state);
    notes_service::create_note(&mut conn, &note)
}

#[tauri::command]
pub fn update_note(state: State<'_, DbState>, id: i64, note: NewNote) -> AppResult<()> {
    let mut conn = db(&state);
    notes_service::update_note(&mut conn, id, &note)
}

#[tauri::command]
pub fn delete_note(state: State<'_, DbState>, id: i64) -> AppResult<()> {
    let conn = db(&state);
    notes::delete(&conn, id)
}

#[tauri::command]
pub fn annuler_note(state: State<'_, DbState>, id: i64) -> AppResult<()> {
    let conn = db(&state);
    notes::annuler(&conn, id)
}
