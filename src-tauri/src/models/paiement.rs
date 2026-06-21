use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Paiement {
    pub id: i64,
    pub note_id: i64,
    pub montant: i64,
    pub date_paiement: String,
    pub methode: Option<String>,
    pub annule: bool,
    pub cree_le: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewPaiement {
    pub note_id: i64,
    pub montant: i64,
    pub date_paiement: String,
    pub methode: Option<String>,
}

/// Solde d'une note : total facturé, total encaissé et reste dû (francs CFA).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SoldeNote {
    pub note_id: i64,
    pub total: i64,
    pub paye: i64,
    pub solde: i64,
    pub payee: bool,
}
