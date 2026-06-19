use rusqlite_migration::{Migrations, M};

/// Migrations ordonnées du schéma. `rusqlite_migration` suit la version dans
/// `PRAGMA user_version`, donc l'exécution est idempotente.
///
/// Les montants sont stockés en **francs CFA entiers** (XOF n'a pas de
/// sous-unité). Les colonnes/champs ne portent donc pas de suffixe « cents ».
pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(
            r#"
        CREATE TABLE clients (
            id        INTEGER PRIMARY KEY,
            nom       TEXT NOT NULL,
            email     TEXT,
            telephone TEXT,
            adresse   TEXT,
            cree_le   TEXT NOT NULL
        );

        CREATE TABLE prestations (
            id         INTEGER PRIMARY KEY,
            libelle    TEXT NOT NULL,
            prix_cents INTEGER NOT NULL,
            actif      INTEGER NOT NULL DEFAULT 1,
            cree_le    TEXT NOT NULL
        );

        CREATE TABLE notes_de_frais (
            id            INTEGER PRIMARY KEY,
            client_id     INTEGER NOT NULL REFERENCES clients(id),
            reference     TEXT,
            date_emission TEXT NOT NULL,
            statut        TEXT NOT NULL,
            cree_le       TEXT NOT NULL
        );

        CREATE TABLE note_lignes (
            id                  INTEGER PRIMARY KEY,
            note_id             INTEGER NOT NULL REFERENCES notes_de_frais(id) ON DELETE CASCADE,
            prestation_id       INTEGER NOT NULL REFERENCES prestations(id),
            libelle_snapshot    TEXT NOT NULL,
            prix_cents_snapshot INTEGER NOT NULL,
            quantite            INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE paiements (
            id            INTEGER PRIMARY KEY,
            note_id       INTEGER NOT NULL REFERENCES notes_de_frais(id),
            montant_cents INTEGER NOT NULL,
            date_paiement TEXT NOT NULL,
            methode       TEXT,
            cree_le       TEXT NOT NULL
        );

        CREATE TABLE recus (
            id          INTEGER PRIMARY KEY,
            paiement_id INTEGER NOT NULL REFERENCES paiements(id),
            numero      TEXT NOT NULL,
            emis_le     TEXT NOT NULL
        );
        "#,
        ),
        // v2 : devise XOF (francs entiers) — on retire le suffixe « cents ».
        M::up(
            r#"
        ALTER TABLE prestations  RENAME COLUMN prix_cents          TO prix;
        ALTER TABLE note_lignes  RENAME COLUMN prix_cents_snapshot TO prix_snapshot;
        ALTER TABLE paiements    RENAME COLUMN montant_cents        TO montant;
        "#,
        ),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_valid() {
        // rusqlite_migration valide la cohérence des migrations.
        assert!(migrations().validate().is_ok());
    }
}
