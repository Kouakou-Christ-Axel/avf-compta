use super::DbState;
use crate::error::AppResult;
use crate::models::ResumeStats;
use crate::repositories::stats;
use tauri::State;

#[tauri::command]
pub fn resume_stats(state: State<'_, DbState>) -> AppResult<ResumeStats> {
    let conn = state.lock().unwrap();
    stats::resume(&conn)
}
