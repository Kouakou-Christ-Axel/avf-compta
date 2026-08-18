use serde::{Deserialize, Serialize};

/// Dépense en francs CFA entiers. `note_id` est `None` pour une charge
/// générale du cabinet (loyer, carburant…), qui n'entre donc dans la marge
/// d'aucun client.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Depense {
    pub id: i64,
    pub note_id: Option<i64>,
    pub libelle: String,
    pub montant: i64,
    pub date_depense: String,
    pub cree_le: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewDepense {
    pub note_id: Option<i64>,
    pub libelle: String,
    pub montant: i64,
    pub date_depense: String,
}

/// Dépense enrichie de la référence de sa note (pour l'export global).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DepenseLigne {
    pub id: i64,
    pub note_id: Option<i64>,
    pub note_reference: Option<String>,
    pub libelle: String,
    pub montant: i64,
    pub date_depense: String,
}
