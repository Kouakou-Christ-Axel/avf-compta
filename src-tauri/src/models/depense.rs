use serde::{Deserialize, Serialize};

/// Dépense rattachée à une note de frais (montant en francs CFA entiers).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Depense {
    pub id: i64,
    pub note_id: i64,
    pub libelle: String,
    pub montant: i64,
    pub date_depense: String,
    pub cree_le: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewDepense {
    pub note_id: i64,
    pub libelle: String,
    pub montant: i64,
    pub date_depense: String,
}
