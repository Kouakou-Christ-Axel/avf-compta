use super::{db, DbState};
use crate::error::AppResult;
use crate::models::{ResumeStats, StatMois};
use crate::repositories::stats;
use tauri::State;

#[tauri::command]
pub fn resume_stats(state: State<'_, DbState>) -> AppResult<ResumeStats> {
    let conn = db(&state);
    stats::resume(&conn)
}

#[tauri::command]
pub fn stats_mensuelles(state: State<'_, DbState>) -> AppResult<Vec<StatMois>> {
    let conn = db(&state);
    stats::mensuelles(&conn)
}
