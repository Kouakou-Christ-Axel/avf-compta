use serde::{Deserialize, Serialize};

use super::Depense;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NoteDeFrais {
    pub id: i64,
    pub client_id: i64,
    pub reference: Option<String>,
    pub date_emission: String,
    pub statut: String,
    pub echeance: Option<String>,
    pub cree_le: String,
    /// `None`, `"montant"` (remise en francs) ou `"pourcent"`.
    pub remise_type: Option<String>,
    /// Valeur brute saisie : des francs ou des points de pourcentage selon
    /// `remise_type`. Le montant réellement déduit est calculé par la vue
    /// SQL `note_totaux`, qui le borne à [0, brut].
    pub remise_valeur: i64,
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

/// Note de frais avec ses lignes, son total, ses dépenses et sa marge (francs).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NoteDetail {
    pub note: NoteDeFrais,
    pub lignes: Vec<NoteLigne>,
    /// Total des lignes avant remise.
    pub total_brut: i64,
    /// Montant de la remise effectivement déduite.
    pub remise: i64,
    /// Total net facturé (brut − remise) : c'est lui qui fait foi partout.
    pub total: i64,
    pub depenses: Vec<Depense>,
    pub depenses_total: i64,
    /// Marge = total facturé − cumul des dépenses liées.
    pub marge: i64,
}

/// Ligne du récapitulatif des notes : note + montants (facturé, payé, restant).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NoteResume {
    pub id: i64,
    pub client_id: i64,
    /// Nom du client (jointure), pour l'affichage direct dans la liste.
    pub client_nom: String,
    pub reference: Option<String>,
    pub date_emission: String,
    pub statut: String,
    pub echeance: Option<String>,
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
    pub echeance: Option<String>,
    pub lignes: Vec<NewNoteLigne>,
    #[serde(default)]
    pub remise_type: Option<String>,
    #[serde(default)]
    pub remise_valeur: i64,
}
