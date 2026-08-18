use std::fmt;

/// Code ISO et symbole d'affichage de la devise (franc CFA ouest-africain).
pub const DEVISE: &str = "FCFA";

/// Montant en **francs CFA entiers** (`i64`). Le XOF n'a pas de sous-unité :
/// la valeur stockée est directement un nombre de francs, jamais un flottant.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Money(i64);

impl Money {
    pub const ZERO: Money = Money(0);

    pub fn from_xof(francs: i64) -> Self {
        Money(francs)
    }

    pub fn xof(self) -> i64 {
        self.0
    }

    /// Multiplie le montant par une quantité (lignes de note de frais),
    /// en signalant le débordement plutôt qu'en le laissant passer.
    ///
    /// La multiplication est précisément l'endroit où un total de ligne peut
    /// déborder ; en SQLite le dépassement ne lève pas d'erreur mais bascule
    /// silencieusement en flottant, ce que la lecture en `i64` refuse ensuite
    /// avec un message incompréhensible.
    pub fn checked_mul_qty(self, qty: i64) -> Option<Money> {
        self.0.checked_mul(qty).map(Money)
    }

    /// Addition protégée contre le débordement.
    pub fn checked_add(self, other: Money) -> Option<Money> {
        self.0.checked_add(other.0).map(Money)
    }
}

impl fmt::Display for Money {
    /// Formate à la française avec séparateur de milliers : « 150 000 FCFA ».
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let negative = self.0 < 0;
        let abs = self.0.unsigned_abs().to_string();

        // Groupage des milliers par espace.
        let mut grouped = String::new();
        let len = abs.len();
        for (i, c) in abs.chars().enumerate() {
            if i > 0 && (len - i).is_multiple_of(3) {
                grouped.push(' ');
            }
            grouped.push(c);
        }

        if negative {
            write!(f, "-")?;
        }
        write!(f, "{grouped} {DEVISE}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_xof_round_trips() {
        assert_eq!(Money::from_xof(123_456).xof(), 123_456);
    }

    #[test]
    fn display_formats_french_xof() {
        assert_eq!(Money::from_xof(150_000).to_string(), "150 000 FCFA");
        assert_eq!(Money::from_xof(0).to_string(), "0 FCFA");
        assert_eq!(Money::from_xof(500).to_string(), "500 FCFA");
        assert_eq!(Money::from_xof(1_000).to_string(), "1 000 FCFA");
        assert_eq!(Money::from_xof(12_345_678).to_string(), "12 345 678 FCFA");
    }

    #[test]
    fn display_handles_negative() {
        assert_eq!(Money::from_xof(-150_000).to_string(), "-150 000 FCFA");
    }

    #[test]
    fn mul_qty_multiplies() {
        assert_eq!(
            Money::from_xof(2_500).checked_mul_qty(3).unwrap().xof(),
            7_500
        );
        assert_eq!(Money::from_xof(2_500).checked_mul_qty(0).unwrap().xof(), 0);
        // Le débordement est signalé, pas silencieusement enroulé.
        assert!(Money::from_xof(i64::MAX).checked_mul_qty(2).is_none());
    }

    #[test]
    fn checked_add_sums_or_overflows() {
        assert_eq!(
            Money::from_xof(100).checked_add(Money::from_xof(50)),
            Some(Money::from_xof(150))
        );
        assert_eq!(
            Money::from_xof(i64::MAX).checked_add(Money::from_xof(1)),
            None
        );
    }
}
