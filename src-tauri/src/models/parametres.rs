use serde::{Deserialize, Serialize};

/// Profil du cabinet affiché sur les notes de frais et les reçus.
/// `logo` est une data-URL base64 (image), facultative.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct Parametres {
    pub cabinet_nom: Option<String>,
    pub email: Option<String>,
    pub telephone: Option<String>,
    pub coordonnees_paiement: Option<String>,
    pub logo: Option<String>,
}
