pub mod clients;
pub mod depenses;
pub mod notes;
pub mod paiements;
pub mod parametres;
pub mod prestations;
pub mod recus;
pub mod stats;

use rusqlite::Connection;
use std::sync::Mutex;

/// État partagé géré par Tauri : la connexion SQLite, sérialisée par un mutex
/// (mono-utilisateur desktop).
pub type DbState = Mutex<Connection>;
