use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Prestation {
    pub id: i64,
    pub libelle: String,
    pub prix_cents: i64,
    pub actif: bool,
    pub cree_le: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewPrestation {
    pub libelle: String,
    pub prix_cents: i64,
}
