pub mod clients;
pub mod depenses;
pub mod fichiers;
pub mod modes_paiement;
pub mod notes;
pub mod paiements;
pub mod parametres;
pub mod prestations;
pub mod recus;
pub mod stats;

use rusqlite::Connection;
use std::sync::{Mutex, MutexGuard};

/// État partagé géré par Tauri : la connexion SQLite, sérialisée par un mutex
/// (mono-utilisateur desktop).
pub type DbState = Mutex<Connection>;

/// Prend le verrou sur la connexion.
///
/// Un `unwrap()` sur un mutex empoisonné (panique survenue sous le verrou)
/// ferait paniquer **toutes** les commandes suivantes, rendant l'application
/// inutilisable jusqu'au redémarrage. On récupère la connexion telle quelle :
/// la panique éventuelle est déjà remontée à l'appelant d'origine.
pub fn db<'a>(state: &'a tauri::State<'_, DbState>) -> MutexGuard<'a, Connection> {
    state.lock().unwrap_or_else(|e| e.into_inner())
}
