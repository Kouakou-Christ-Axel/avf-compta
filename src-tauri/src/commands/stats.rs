use super::{db, DbState};
use crate::error::AppResult;
use crate::models::{ResumeStats, StatMois};
use crate::repositories::stats;
use tauri::State;

#[tauri::command]
pub fn resume_stats(
    state: State<'_, DbState>,
    du: Option<String>,
    au: Option<String>,
) -> AppResult<ResumeStats> {
    let conn = db(&state);
    stats::resume(&conn, du.as_deref(), au.as_deref())
}

#[tauri::command]
pub fn stats_mensuelles(state: State<'_, DbState>) -> AppResult<Vec<StatMois>> {
    let conn = db(&state);
    stats::mensuelles(&conn)
}
