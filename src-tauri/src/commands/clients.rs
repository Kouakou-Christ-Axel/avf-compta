use super::DbState;
use crate::error::AppResult;
use crate::models::{Client, ClientResume, NewClient};
use crate::repositories::clients;
use tauri::State;

#[tauri::command]
pub fn list_clients(state: State<'_, DbState>) -> AppResult<Vec<Client>> {
    let conn = state.lock().unwrap();
    clients::list(&conn)
}

#[tauri::command]
pub fn list_clients_resume(state: State<'_, DbState>) -> AppResult<Vec<ClientResume>> {
    let conn = state.lock().unwrap();
    clients::list_resume(&conn)
}

#[tauri::command]
pub fn get_client(state: State<'_, DbState>, id: i64) -> AppResult<Client> {
    let conn = state.lock().unwrap();
    clients::get(&conn, id)
}

#[tauri::command]
pub fn create_client(state: State<'_, DbState>, client: NewClient) -> AppResult<i64> {
    let conn = state.lock().unwrap();
    clients::create(&conn, &client)
}

#[tauri::command]
pub fn update_client(state: State<'_, DbState>, client: Client) -> AppResult<()> {
    let conn = state.lock().unwrap();
    clients::update(&conn, &client)
}

#[tauri::command]
pub fn delete_client(state: State<'_, DbState>, id: i64) -> AppResult<()> {
    let conn = state.lock().unwrap();
    clients::delete(&conn, id)
}
