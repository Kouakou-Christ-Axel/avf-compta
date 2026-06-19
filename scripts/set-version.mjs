#!/usr/bin/env node
// Synchronise la version (depuis un tag git vX.Y.Z) dans les trois fichiers
// qui la portent. Utilisé uniquement en CI au moment d'une release ; les
// fichiers du dépôt gardent une version « placeholder » de développement.
//
//   node scripts/set-version.mjs 1.2.3
//
// Aucune dépendance externe (Node >= 18).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const version = (process.argv[2] ?? "").trim().replace(/^v/, "");
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Version invalide: "${process.argv[2]}" (attendu X.Y.Z)`);
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function patch(relPath, regex, replacement) {
  const path = join(root, relPath);
  const content = readFileSync(path, "utf8");
  // On vérifie que le motif correspond (et non que le contenu change) : si la
  // version du tag est identique au placeholder du dépôt, le remplacement est
  // un no-op légitime et ne doit pas être traité comme une erreur.
  if (!regex.test(content)) {
    console.error(`Motif de version introuvable dans ${relPath}`);
    process.exit(1);
  }
  writeFileSync(path, content.replace(regex, replacement));
  console.log(`✓ ${relPath} -> ${version}`);
}

// package.json : "version": "x.y.z"
patch("package.json", /("version":\s*")\d+\.\d+\.\d+(")/, `$1${version}$2`);

// src-tauri/tauri.conf.json : "version": "x.y.z"
patch(
  "src-tauri/tauri.conf.json",
  /("version":\s*")\d+\.\d+\.\d+(")/,
  `$1${version}$2`,
);

// src-tauri/Cargo.toml : version = "x.y.z" (première occurrence = [package])
patch(
  "src-tauri/Cargo.toml",
  /(version\s*=\s*")\d+\.\d+\.\d+(")/,
  `$1${version}$2`,
);
