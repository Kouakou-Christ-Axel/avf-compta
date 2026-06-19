# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- **Référence de note auto-générée** au format `AA-MM-NNNN` (séquence remise à
  zéro chaque mois) — plus de saisie manuelle.
- **Export PDF** des notes de frais et des reçus (via pdfmake).
- **Profil du cabinet** (page Paramètres) : logo, nom, téléphone, email et
  coordonnées de paiement, repris sur les notes/reçus imprimés et les PDF.

### Modifié

- Devise passée à l'**euro → franc CFA (XOF)** : montants en francs entiers
  (pas de sous-unité), affichage « 150 000 FCFA » côté Rust et React.

### Ajouté

- **Reçu imprimable** : aperçu détaillé (cabinet, client, note, montant) et
  impression via le navigateur (commande `get_recu`, jointure dédiée).
- **Copier au clic** sur l'email et le téléphone d'un client, avec un toast
  « Copié ».
- Interface retravaillée : barre latérale, cartes du tableau de bord, badges
  de statut, fenêtres modales, notifications toast.

### Ajouté (v1 initiale)

- Domaine comptable complet (backend Rust + SQLite) : clients, prestations,
  notes de frais composées de prestations (prix figés), paiements avec refus
  des sur-paiements, reçus numérotés et statistiques agrégées.
- Interface React française : gestion des clients, prestations, notes de frais
  (création, détail, paiements, reçus) et tableau de bord.
- Développement en TDD : tests unitaires Rust (SQLite en mémoire) et tests
  frontend (Vitest + Testing Library, mock IPC Tauri).
- Intégration continue (lint, format, tests Rust + frontend) et workflow de
  release produisant les bundles Windows (`.msi`, `.exe`/NSIS) sur tag `vX.Y.Z`.
