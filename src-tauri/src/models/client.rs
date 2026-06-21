use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Client {
    pub id: i64,
    pub nom: String,
    pub email: Option<String>,
    pub telephone: Option<String>,
    pub adresse: Option<String>,
    pub cree_le: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewClient {
    pub nom: String,
    pub email: Option<String>,
    pub telephone: Option<String>,
    pub adresse: Option<String>,
}

/// Récapitulatif par client : cumul facturé (notes), cumul payé, restant, marge.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClientResume {
    pub id: i64,
    pub nom: String,
    pub email: Option<String>,
    pub telephone: Option<String>,
    pub total_facture: i64,
    pub total_paye: i64,
    pub solde: i64,
    pub total_depenses: i64,
    pub marge: i64,
}
