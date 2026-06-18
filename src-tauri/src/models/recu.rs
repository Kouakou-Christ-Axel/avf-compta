use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Recu {
    pub id: i64,
    pub paiement_id: i64,
    pub numero: String,
    pub emis_le: String,
}
