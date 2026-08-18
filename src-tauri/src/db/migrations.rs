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
        // v3 : profil du cabinet (logo + coordonnées) affiché sur les documents.
        // Ligne unique (id = 1).
        M::up(
            r#"
        CREATE TABLE parametres (
            id                   INTEGER PRIMARY KEY CHECK (id = 1),
            cabinet_nom          TEXT,
            email                TEXT,
            telephone            TEXT,
            coordonnees_paiement TEXT,
            logo                 TEXT
        );
        INSERT INTO parametres (id) VALUES (1);
        "#,
        ),
        // v4 : échéance (date d'exigibilité) optionnelle sur les notes de frais.
        M::up(r#"ALTER TABLE notes_de_frais ADD COLUMN echeance TEXT;"#),
        // v5 : dépenses, chacune liée à une note de frais (calcul de marge).
        M::up(
            r#"
        CREATE TABLE depenses (
            id           INTEGER PRIMARY KEY,
            note_id      INTEGER NOT NULL REFERENCES notes_de_frais(id) ON DELETE CASCADE,
            libelle      TEXT NOT NULL,
            montant      INTEGER NOT NULL,
            date_depense TEXT NOT NULL,
            cree_le      TEXT NOT NULL
        );
        "#,
        ),
        // v6 : sous-titre libre du cabinet (ex: « Expert-comptable »).
        M::up(r#"ALTER TABLE parametres ADD COLUMN sous_titre TEXT;"#),
        // v7 : annulation des paiements (reçus) + modes de paiement configurables.
        M::up(
            r#"
        ALTER TABLE paiements ADD COLUMN annule INTEGER NOT NULL DEFAULT 0;
        CREATE TABLE modes_paiement (
            id      INTEGER PRIMARY KEY,
            libelle TEXT NOT NULL
        );
        "#,
        ),
        // v8 : annulation propre à chaque reçu (indépendante du paiement lié,
        // pour qu'un nouveau reçu ne « hérite » pas de l'annulation d'un
        // paiement déjà annulé par un reçu précédent).
        M::up(r#"ALTER TABLE recus ADD COLUMN annule INTEGER NOT NULL DEFAULT 0;"#),
        // v9 : remise globale sur une note (montant fixe ou pourcentage) et vue
        // `note_totaux`, **source unique** du brut, de la remise et du net. Tous
        // les calculs de « total facturé » (liste des notes, fiche client,
        // tableau de bord) passent par cette vue : la règle de remise n'est
        // écrite qu'une fois.
        M::up(
            r#"
        ALTER TABLE notes_de_frais ADD COLUMN remise_type   TEXT;
        ALTER TABLE notes_de_frais ADD COLUMN remise_valeur INTEGER NOT NULL DEFAULT 0;

        CREATE VIEW note_totaux AS
        SELECT note_id, brut, remise, brut - remise AS net FROM (
            SELECT note_id, brut,
                   -- Remise bornée à [0, brut] ; le pourcentage est arrondi au
                   -- franc supérieur à partir de 0,5 (le XOF n'a pas de centime).
                   min(max(CASE rt
                             WHEN 'pourcent' THEN (brut * rv + 50) / 100
                             WHEN 'montant'  THEN rv
                             ELSE 0
                           END, 0), brut) AS remise
            FROM (
                SELECT n.id AS note_id,
                       COALESCE((SELECT SUM(l.prix_snapshot * l.quantite)
                                   FROM note_lignes l WHERE l.note_id = n.id), 0) AS brut,
                       n.remise_type   AS rt,
                       n.remise_valeur AS rv
                FROM notes_de_frais n
            )
        );
        "#,
        ),
        // v10 : un reçu et un seul par paiement. Les bases déjà en production
        // contiennent des doublons (le bouton « Reçu » en créait un à chaque
        // clic) : on les supprime **avant** de poser l'index unique, sinon la
        // migration échouerait au démarrage et l'application ne s'ouvrirait plus.
        // Le reçu conservé est le plus ancien (`MIN(id)`), celui qui a été remis
        // au client.
        M::up(
            r#"
        DELETE FROM recus WHERE id NOT IN (SELECT MIN(id) FROM recus GROUP BY paiement_id);

        CREATE UNIQUE INDEX idx_recus_paiement ON recus(paiement_id);
        -- Index simple, volontairement **pas** unique : la déduplication
        -- ci-dessus garantit l'unicité par paiement, mais rien ne garantit
        -- celle des numéros dans une base ancienne. Un index unique qui
        -- échouerait ici empêcherait l'application de démarrer après mise à
        -- jour. L'unicité des numéros est assurée en amont par
        -- `recus::prochain_numero` (basé sur MAX et non sur COUNT).
        CREATE INDEX idx_recus_numero ON recus(numero);

        CREATE INDEX idx_note_lignes_note ON note_lignes(note_id);
        CREATE INDEX idx_paiements_note   ON paiements(note_id);
        CREATE INDEX idx_depenses_note    ON depenses(note_id);
        "#,
        ),
        // v11 : le reçu fige le total et le reste à payer de la note au moment
        // de l'émission. Auparavant ils étaient recalculés à l'impression, si
        // bien qu'un reçu réimprimé affichait le solde du jour et non celui de
        // l'encaissement. Les reçus existants sont rattrapés avec le solde
        // calculé à partir des paiements antérieurs ou égaux au leur.
        M::up(
            r#"
        ALTER TABLE recus ADD COLUMN note_total INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE recus ADD COLUMN note_solde INTEGER NOT NULL DEFAULT 0;

        UPDATE recus SET note_total = COALESCE((
            SELECT t.net FROM note_totaux t
              JOIN paiements p ON p.note_id = t.note_id
             WHERE p.id = recus.paiement_id), 0);

        UPDATE recus SET note_solde = note_total - COALESCE((
            SELECT SUM(p2.montant)
              FROM paiements p2
              JOIN paiements p ON p.id = recus.paiement_id
             WHERE p2.note_id = p.note_id AND p2.annule = 0 AND p2.id <= p.id), 0);
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

    /// Les bases déjà en production contiennent des reçus en double (un par
    /// prévisualisation). La v10 doit les dédupliquer avant de poser l'index
    /// unique, sinon l'application ne démarrerait plus après mise à jour.
    #[test]
    fn v10_deduplique_les_recus_existants() {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        let m = migrations();
        m.to_version(&mut conn, 9).unwrap();

        conn.execute_batch(
            r#"
            INSERT INTO clients (id, nom, cree_le) VALUES (1, 'Acme', '2026-01-01');
            INSERT INTO notes_de_frais (id, client_id, reference, date_emission, statut, cree_le)
                VALUES (1, 1, '26-01-0001', '2026-01-01', 'payee', '2026-01-01');
            INSERT INTO paiements (id, note_id, montant, date_paiement, cree_le)
                VALUES (1, 1, 10000, '2026-01-02', '2026-01-02');
            INSERT INTO recus (id, paiement_id, numero, emis_le) VALUES (1, 1, 'RECU-0001', '2026-01-02');
            INSERT INTO recus (id, paiement_id, numero, emis_le) VALUES (2, 1, 'RECU-0002', '2026-01-02');
            INSERT INTO recus (id, paiement_id, numero, emis_le) VALUES (3, 1, 'RECU-0003', '2026-01-02');
            "#,
        )
        .unwrap();

        m.to_latest(&mut conn).unwrap();

        // Seul le plus ancien reçu (celui remis au client) subsiste.
        let restants: Vec<i64> = conn
            .prepare("SELECT id FROM recus ORDER BY id")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();
        assert_eq!(restants, vec![1]);

        // Et l'index unique interdit désormais d'en recréer un second pour le
        // même paiement.
        let doublon = conn.execute(
            "INSERT INTO recus (paiement_id, numero, emis_le) VALUES (1, 'RECU-0009', '2026-01-03')",
            [],
        );
        assert!(doublon.is_err(), "l'index unique doit refuser le doublon");
    }

    /// Rattrapage v11 : les reçus existants héritent du total et du reste à
    /// payer calculés à leur date, et non de la situation d'aujourd'hui.
    #[test]
    fn v11_rattrape_le_solde_des_recus_existants() {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        let m = migrations();
        m.to_version(&mut conn, 9).unwrap();

        conn.execute_batch(
            r#"
            INSERT INTO clients (id, nom, cree_le) VALUES (1, 'Acme', '2026-01-01');
            INSERT INTO notes_de_frais (id, client_id, reference, date_emission, statut, cree_le)
                VALUES (1, 1, '26-01-0001', '2026-01-01', 'payee', '2026-01-01');
            INSERT INTO prestations (id, libelle, prix, cree_le) VALUES (1, 'Conseil', 10000, '2026-01-01');
            INSERT INTO note_lignes (note_id, prestation_id, libelle_snapshot, prix_snapshot, quantite)
                VALUES (1, 1, 'Conseil', 10000, 1);
            INSERT INTO paiements (id, note_id, montant, date_paiement, cree_le)
                VALUES (1, 1, 4000, '2026-01-02', '2026-01-02');
            INSERT INTO paiements (id, note_id, montant, date_paiement, cree_le)
                VALUES (2, 1, 6000, '2026-01-05', '2026-01-05');
            INSERT INTO recus (id, paiement_id, numero, emis_le) VALUES (1, 1, 'RECU-0001', '2026-01-02');
            "#,
        )
        .unwrap();

        m.to_latest(&mut conn).unwrap();

        let (total, solde): (i64, i64) = conn
            .query_row(
                "SELECT note_total, note_solde FROM recus WHERE id = 1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(total, 10_000);
        // Au moment du reçu n°1, il restait 6 000 à payer.
        assert_eq!(solde, 6_000);
    }
}
