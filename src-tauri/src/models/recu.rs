use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Recu {
    pub id: i64,
    pub paiement_id: i64,
    pub numero: String,
    pub emis_le: String,
}

/// Ligne du récapitulatif des reçus (liste), avec client et montant.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RecuResume {
    pub id: i64,
    pub numero: String,
    pub emis_le: String,
    pub client_nom: String,
    pub montant: i64,
    pub annule: bool,
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
    /// Total facturé de la note.
    pub note_total: i64,
    /// Reste à payer sur la note (après ce paiement).
    pub note_solde: i64,
}
