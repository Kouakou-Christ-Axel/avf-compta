use crate::error::AppError;
use std::str::FromStr;

/// Statut d'une note de frais.
///
/// La colonne `notes_de_frais.statut` reste du `TEXT`, et les DTO exposent
/// toujours une `String` : ce type ne change **ni le schéma ni le JSON** rendu
/// au frontend. Il sert aux endroits qui *décident* d'après le statut, pour que
/// le compilateur y refuse une faute de frappe — un `== "annullee"` glissé dans
/// un seul module désactivait silencieusement une règle métier.
///
/// Les repositories continuent volontairement de lire la colonne en `String`
/// sans passer par ce type : une valeur inattendue dans une base retouchée à la
/// main ne doit pas empêcher l'affichage des listes ni l'ouverture de
/// l'application, seulement l'opération métier portant sur cette note.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatutNote {
    /// Émise, en attente d'encaissement.
    Emise,
    /// Entièrement réglée (ou entièrement remisée).
    Payee,
    /// Annulée : exclue des totaux, mais conservée.
    Annulee,
}

impl StatutNote {
    pub const EMISE: &'static str = "emise";
    pub const PAYEE: &'static str = "payee";
    pub const ANNULEE: &'static str = "annulee";

    /// Valeur telle que stockée en base et sérialisée vers le frontend.
    pub const fn as_str(self) -> &'static str {
        match self {
            StatutNote::Emise => Self::EMISE,
            StatutNote::Payee => Self::PAYEE,
            StatutNote::Annulee => Self::ANNULEE,
        }
    }
}

impl FromStr for StatutNote {
    type Err = AppError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            Self::EMISE => Ok(StatutNote::Emise),
            Self::PAYEE => Ok(StatutNote::Payee),
            Self::ANNULEE => Ok(StatutNote::Annulee),
            autre => Err(AppError::Database(format!(
                "statut de facture inconnu en base : « {autre} »"
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aller_retour_entre_texte_et_variante() {
        for s in [StatutNote::Emise, StatutNote::Payee, StatutNote::Annulee] {
            assert_eq!(StatutNote::from_str(s.as_str()).unwrap(), s);
        }
    }

    /// Les valeurs stockées ne doivent jamais changer : elles sont déjà en base
    /// chez les utilisateurs et sérialisées telles quelles vers le frontend.
    #[test]
    fn les_valeurs_stockees_sont_figees() {
        assert_eq!(StatutNote::Emise.as_str(), "emise");
        assert_eq!(StatutNote::Payee.as_str(), "payee");
        assert_eq!(StatutNote::Annulee.as_str(), "annulee");
    }

    #[test]
    fn un_statut_inconnu_est_rejete_proprement() {
        assert!(matches!(
            StatutNote::from_str("brouillon"),
            Err(AppError::Database(_))
        ));
    }
}
