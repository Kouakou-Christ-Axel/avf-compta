# avf-compta

Application de bureau de gestion pour un cabinet comptable : clients,
prestations, factures, paiements, reçus et tableau de bord. Montants en francs
CFA (XOF).

## Installation sous Windows

Téléchargez `avf-compta_<version>_x64-setup.exe` depuis la
[dernière version publiée](https://github.com/Kouakou-Christ-Axel/avf-compta/releases/latest).

> **Windows affichera « Windows a protégé votre ordinateur ».**
> C'est attendu : l'application n'est pas signée par un éditeur reconnu auprès
> de Microsoft. Cliquez sur **Informations complémentaires**, puis sur
> **Exécuter quand même**.

Le même avertissement apparaît lors d'une mise à jour depuis l'application. Il
faut le franchir : **une installation interrompue à ce stade peut laisser le
poste sans application**, et il faut alors réinstaller à la main depuis le lien
ci-dessus. Les données, elles, ne sont jamais perdues.

## Vos données

Elles vivent dans un fichier unique :

```
%APPDATA%\com.kouax.avf-compta\avf_compta.sqlite
```

Ni la désinstallation ni une mise à jour n'y touchent. Pour une sauvegarde
manuelle, il suffit de copier ce fichier — l'application propose aussi
« Sauvegarder » et « Restaurer » dans ses Paramètres.

## Si l'application ne démarre pas

Elle affiche désormais la raison dans une fenêtre au lancement, et l'enregistre
dans :

```
%APPDATA%\com.kouax.avf-compta\demarrage-erreur.log
```

Ce fichier est la première chose à consulter. Si l'entrée du menu Démarrer
apparaît **avec une icône blanche**, le raccourci pointe vers un programme
absent : une mise à jour n'a pas abouti, il faut réinstaller depuis le lien
ci-dessus.

## Développement

Voir [`CLAUDE.md`](CLAUDE.md) pour l'architecture et les conventions.

```bash
pnpm install
pnpm tauri dev     # application complète (Rust + Vite)
pnpm test          # tests frontend
cd src-tauri && cargo test
```

Les dépendances système Linux nécessaires à la compilation sont listées dans
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).
