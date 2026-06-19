use std::fmt;

/// Montant monétaire stocké en **centimes** (`i64`) pour éviter toute dérive
/// des flottants. Le formatage en euros n'a lieu qu'au bord de l'affichage.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Money(i64);

impl Money {
    pub const ZERO: Money = Money(0);

    pub fn from_cents(cents: i64) -> Self {
        Money(cents)
    }

    pub fn cents(self) -> i64 {
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

    /// Convertit une saisie utilisateur (« 1 234,56 », « 1234.5 », « 12 »)
    /// en centimes. Le séparateur décimal accepté est `,` ou `.`, les espaces
    /// (groupage des milliers) sont ignorés. L'analyse est purement décimale
    /// (sans flottant) pour un arrondi exact au centime le plus proche.
    pub fn parse(input: &str) -> Result<Money, String> {
        let cleaned: String = input
            .chars()
            .filter(|c| !c.is_whitespace())
            .collect::<String>()
            .replace(',', ".");
        let invalid = || format!("montant invalide: {input}");

        let neg = cleaned.starts_with('-');
        let body = cleaned.trim_start_matches(['-', '+']);

        let mut parts = body.split('.');
        let int_part = parts.next().unwrap_or("");
        let frac_part = parts.next().unwrap_or("");
        if parts.next().is_some() {
            return Err(invalid()); // plus d'un séparateur décimal
        }
        if int_part.is_empty() && frac_part.is_empty() {
            return Err(invalid());
        }
        if !int_part.chars().all(|c| c.is_ascii_digit())
            || !frac_part.chars().all(|c| c.is_ascii_digit())
        {
            return Err(invalid());
        }

        let int_val: i64 = if int_part.is_empty() {
            0
        } else {
            int_part.parse().map_err(|_| invalid())?
        };
        let digit = |i: usize| {
            frac_part
                .as_bytes()
                .get(i)
                .map_or(0, |&b| (b - b'0') as i64)
        };
        let mut cents = int_val
            .checked_mul(100)
            .and_then(|c| c.checked_add(digit(0) * 10 + digit(1)))
            .ok_or_else(invalid)?;
        if digit(2) >= 5 {
            cents += 1; // arrondi du 3e chiffre décimal
        }
        Ok(Money(if neg { -cents } else { cents }))
    }
}

impl fmt::Display for Money {
    /// Formate en euros à la française : « 1 234,56 € ».
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let negative = self.0 < 0;
        let abs = self.0.unsigned_abs();
        let euros = abs / 100;
        let cents = abs % 100;

        // Groupage des milliers par espace.
        let euros_str = euros.to_string();
        let mut grouped = String::new();
        let len = euros_str.len();
        for (i, c) in euros_str.chars().enumerate() {
            if i > 0 && (len - i).is_multiple_of(3) {
                grouped.push(' ');
            }
            grouped.push(c);
        }

        if negative {
            write!(f, "-")?;
        }
        write!(f, "{grouped},{cents:02} €")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_cents_round_trips() {
        assert_eq!(Money::from_cents(123_456).cents(), 123_456);
    }

    #[test]
    fn display_formats_french_currency() {
        assert_eq!(Money::from_cents(123_456).to_string(), "1 234,56 €");
        assert_eq!(Money::from_cents(0).to_string(), "0,00 €");
        assert_eq!(Money::from_cents(5).to_string(), "0,05 €");
        assert_eq!(Money::from_cents(100).to_string(), "1,00 €");
        assert_eq!(Money::from_cents(1_000_000).to_string(), "10 000,00 €");
    }

    #[test]
    fn display_handles_negative() {
        assert_eq!(Money::from_cents(-123_456).to_string(), "-1 234,56 €");
    }

    #[test]
    fn mul_qty_multiplies_cents() {
        assert_eq!(Money::from_cents(2_500).mul_qty(3).cents(), 7_500);
        assert_eq!(Money::from_cents(2_500).mul_qty(0).cents(), 0);
    }

    #[test]
    fn checked_add_sums_or_overflows() {
        assert_eq!(
            Money::from_cents(100).checked_add(Money::from_cents(50)),
            Some(Money::from_cents(150))
        );
        assert_eq!(
            Money::from_cents(i64::MAX).checked_add(Money::from_cents(1)),
            None
        );
    }

    #[test]
    fn parse_accepts_french_and_plain_input() {
        assert_eq!(Money::parse("1 234,56").unwrap().cents(), 123_456);
        assert_eq!(Money::parse("1234.56").unwrap().cents(), 123_456);
        assert_eq!(Money::parse("12").unwrap().cents(), 1_200);
        assert_eq!(Money::parse("0,05").unwrap().cents(), 5);
    }

    #[test]
    fn parse_rounds_to_nearest_cent() {
        assert_eq!(Money::parse("1,005").unwrap().cents(), 101);
        assert_eq!(Money::parse("1,004").unwrap().cents(), 100);
    }

    #[test]
    fn parse_rejects_invalid_input() {
        assert!(Money::parse("").is_err());
        assert!(Money::parse("abc").is_err());
    }
}
