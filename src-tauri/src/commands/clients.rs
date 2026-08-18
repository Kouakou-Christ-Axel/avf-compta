use super::{db, DbState};
use crate::error::AppResult;
use crate::models::{Client, ClientResume, NewClient};
use crate::repositories::clients;
use tauri::State;

#[tauri::command]
pub fn list_clients(state: State<'_, DbState>) -> AppResult<Vec<Client>> {
    let conn = db(&state);
    clients::list(&conn)
}

#[tauri::command]
pub fn list_clients_resume(state: State<'_, DbState>) -> AppResult<Vec<ClientResume>> {
    let conn = db(&state);
    clients::list_resume(&conn)
}

#[tauri::command]
pub fn get_client(state: State<'_, DbState>, id: i64) -> AppResult<Client> {
    let conn = db(&state);
    clients::get(&conn, id)
}

#[tauri::command]
pub fn create_client(state: State<'_, DbState>, client: NewClient) -> AppResult<i64> {
    let conn = db(&state);
    clients::create(&conn, &client)
}

#[tauri::command]
pub fn update_client(state: State<'_, DbState>, client: Client) -> AppResult<()> {
    let conn = db(&state);
    clients::update(&conn, &client)
}

#[tauri::command]
pub fn delete_client(state: State<'_, DbState>, id: i64) -> AppResult<()> {
    let conn = db(&state);
    clients::delete(&conn, id)
}
