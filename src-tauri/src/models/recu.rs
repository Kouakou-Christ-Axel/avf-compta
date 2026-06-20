use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Recu {
    pub id: i64,
    pub paiement_id: i64,
    pub numero: String,
    pub emis_le: String,
}

/// Reçu enrichi de tout le contexte nécessaire à l'impression.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RecuDetail {
    pub id: i64,
    pub numero: String,
    pub emis_le: String,
    pub montant: i64,
    pub date_paiement: String,
    pub methode: Option<String>,
    pub note_id: i64,
    pub note_reference: Option<String>,
    pub client_nom: String,
    pub client_email: Option<String>,
    pub client_telephone: Option<String>,
    /// Prestations (lignes) de la note réglée.
    pub lignes: Vec<super::NoteLigne>,
}
