use serde::{Deserialize, Serialize};

/// Synthèse comptable (montants en centimes).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct ResumeStats {
    pub nb_clients: i64,
    pub nb_notes: i64,
    pub total_facture_cents: i64,
    pub total_encaisse_cents: i64,
    pub total_impaye_cents: i64,
}
