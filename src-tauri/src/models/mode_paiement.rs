use serde::{Deserialize, Serialize};

/// Mode de règlement configurable (ex: Espèces, Virement, Wave…).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModePaiement {
    pub id: i64,
    pub libelle: String,
}
