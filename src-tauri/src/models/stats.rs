use serde::{Deserialize, Serialize};

/// Synthèse comptable (montants en francs CFA).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct ResumeStats {
    pub nb_clients: i64,
    pub nb_notes: i64,
    pub total_facture: i64,
    pub total_encaisse: i64,
    pub total_impaye: i64,
}
