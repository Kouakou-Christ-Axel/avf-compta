# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- Domaine comptable complet (backend Rust + SQLite) : clients, prestations,
  notes de frais composées de prestations (prix figés), paiements avec refus
  des sur-paiements, reçus numérotés et statistiques agrégées.
- Interface React française : gestion des clients, prestations, notes de frais
  (création, détail, paiements, reçus) et tableau de bord.
- Développement en TDD : tests unitaires Rust (SQLite en mémoire) et tests
  frontend (Vitest + Testing Library, mock IPC Tauri).
- Intégration continue (lint, format, tests Rust + frontend) et workflow de
  release produisant les bundles Linux (AppImage, .deb) sur tag `vX.Y.Z`.
