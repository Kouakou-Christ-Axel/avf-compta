pub mod clients;
pub mod depenses;
pub mod modes_paiement;
pub mod notes;
pub mod paiements;
pub mod parametres;
pub mod prestations;
pub mod recus;
pub mod stats;

/// Horodatage courant au format RFC 3339 (UTC).
pub(crate) fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}
