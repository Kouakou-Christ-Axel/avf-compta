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
    /// Reçu déjà émis pour ce paiement, s'il y en a un (au plus un depuis la
    /// migration v10). Permet à l'interface de proposer « Voir le reçu »
    /// plutôt que d'en générer un second.
    pub recu_id: Option<i64>,
    pub recu_numero: Option<String>,
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
