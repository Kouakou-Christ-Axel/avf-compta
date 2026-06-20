use serde::Serialize;

/// Erreur applicative renvoyée par les commandes Tauri vers le frontend.
///
/// `serde::Serialize` permet de renvoyer l'erreur telle quelle depuis une
/// commande (`Result<T, AppError>`), sérialisée en chaîne côté JS.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    /// Donnée introuvable (ex: identifiant inexistant).
    #[error("introuvable: {0}")]
    NotFound(String),

    /// Règle métier violée (ex: sur-paiement, montant négatif).
    #[error("validation: {0}")]
    Validation(String),

    /// Erreur de la base de données SQLite.
    #[error("base de données: {0}")]
    Database(String),

    /// Erreur d'entrée/sortie (ex: écriture de fichier).
    #[error("fichier: {0}")]
    Io(String),
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound("aucune ligne".into()),
            other => AppError::Database(other.to_string()),
        }
    }
}

impl From<rusqlite_migration::Error> for AppError {
    fn from(e: rusqlite_migration::Error) -> Self {
        AppError::Database(e.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Résultat conventionnel des couches métier et commandes.
pub type AppResult<T> = Result<T, AppError>;
