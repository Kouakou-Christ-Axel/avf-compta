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

    /// Multiplie le montant par une quantité (lignes de note de frais).
    pub fn mul_qty(self, qty: i64) -> Self {
        Money(self.0 * qty)
    }

    /// Addition protégée contre le débordement.
    pub fn checked_add(self, other: Money) -> Option<Money> {
        self.0.checked_add(other.0).map(Money)
    }

    pub fn is_negative(self) -> bool {
        self.0 < 0
    }

    /// Convertit une saisie utilisateur (« 150 000 », « 150000 ») en francs.
    /// Les espaces (groupage) sont ignorés ; les décimales ne sont pas
    /// acceptées car le franc CFA n'a pas de sous-unité.
    pub fn parse(input: &str) -> Result<Money, String> {
        let cleaned: String = input.chars().filter(|c| !c.is_whitespace()).collect();
        let invalid = || format!("montant invalide: {input}");

        let neg = cleaned.starts_with('-');
        let body = cleaned.trim_start_matches(['-', '+']);
        if body.is_empty() || !body.chars().all(|c| c.is_ascii_digit()) {
            return Err(invalid());
        }
        let value: i64 = body.parse().map_err(|_| invalid())?;
        Ok(Money(if neg { -value } else { value }))
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
        assert_eq!(Money::from_xof(2_500).mul_qty(3).xof(), 7_500);
        assert_eq!(Money::from_xof(2_500).mul_qty(0).xof(), 0);
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

    #[test]
    fn parse_accepts_grouped_and_plain_input() {
        assert_eq!(Money::parse("150 000").unwrap().xof(), 150_000);
        assert_eq!(Money::parse("150000").unwrap().xof(), 150_000);
        assert_eq!(Money::parse("500").unwrap().xof(), 500);
    }

    #[test]
    fn parse_rejects_decimals_and_invalid() {
        assert!(Money::parse("").is_err());
        assert!(Money::parse("abc").is_err());
        assert!(Money::parse("1,50").is_err());
        assert!(Money::parse("1.5").is_err());
    }
}
