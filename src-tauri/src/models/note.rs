use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NoteDeFrais {
    pub id: i64,
    pub client_id: i64,
    pub reference: Option<String>,
    pub date_emission: String,
    pub statut: String,
    pub cree_le: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NoteLigne {
    pub id: i64,
    pub note_id: i64,
    pub prestation_id: i64,
    /// Libellé figé au moment de l'ajout (insensible aux modifications futures
    /// de la prestation).
    pub libelle_snapshot: String,
    /// Prix unitaire figé, en francs CFA entiers.
    pub prix_snapshot: i64,
    pub quantite: i64,
}

/// Note de frais avec ses lignes et son total calculé (francs CFA).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NoteDetail {
    pub note: NoteDeFrais,
    pub lignes: Vec<NoteLigne>,
    pub total: i64,
}

/// Ligne du récapitulatif des notes : note + montants (facturé, payé, restant).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NoteResume {
    pub id: i64,
    pub client_id: i64,
    pub reference: Option<String>,
    pub date_emission: String,
    pub statut: String,
    pub total: i64,
    pub paye: i64,
    pub solde: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewNoteLigne {
    pub prestation_id: i64,
    pub quantite: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewNote {
    pub client_id: i64,
    pub date_emission: String,
    pub lignes: Vec<NewNoteLigne>,
}
