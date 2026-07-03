#!/usr/bin/env node
// Calcule la prochaine version semver (X.Y.Z) à partir des commits
// Conventional Commits accumulés depuis le dernier tag (ou depuis le début
// du dépôt s'il n'existe encore aucun tag). Utilisé par le workflow
// auto-tag.yml pour créer automatiquement un tag après chaque merge sur
// master.
//
//   git log <range> --format='%s%x01%b%x02' | node scripts/next-version.mjs [lastTag]
//
// Affiche la nouvelle version (ex: "1.2.3") sur stdout et sort en code 0.
// S'il n'y a aucun commit fix/feat/breaking, n'affiche rien et sort en
// code 1 (aucune nouvelle version à publier).

import { readFileSync } from "node:fs";

const BREAKING_TYPE_RE = /^\w+(\([^)]*\))?!:/;
const BREAKING_FOOTER_RE = /^BREAKING CHANGE:/m;
const FEAT_RE = /^feat(\([^)]*\))?:/;
const FIX_RE = /^(fix|perf)(\([^)]*\))?:/;

const BUMP_RANK = { major: 3, minor: 2, patch: 1 };

function bumpFor(subject, body) {
  if (BREAKING_TYPE_RE.test(subject) || BREAKING_FOOTER_RE.test(body)) {
    return "major";
  }
  if (FEAT_RE.test(subject)) return "minor";
  if (FIX_RE.test(subject)) return "patch";
  return null;
}

function strongestBump(bumps) {
  return bumps.reduce(
    (best, bump) =>
      bump && BUMP_RANK[bump] > (BUMP_RANK[best] ?? 0) ? bump : best,
    null,
  );
}

export function nextVersion(lastTag, commits) {
  const bump = strongestBump(commits.map((c) => bumpFor(c.subject, c.body)));
  if (!bump) return null;

  const base = (lastTag || "v0.0.0").replace(/^v/, "");
  const [major, minor, patch] = base.split(".").map(Number);

  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function parseCommits(raw) {
  return raw
    .split("\x02")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [subject = "", body = ""] = entry.split("\x01");
      return { subject: subject.trim(), body: body.trim() };
    });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const lastTag = process.argv[2] || null;
  const commits = parseCommits(readFileSync(0, "utf8"));

  const next = nextVersion(lastTag, commits);
  if (!next) {
    console.error(
      "Aucun commit fix/feat/breaking depuis le dernier tag : pas de nouvelle version.",
    );
    process.exit(1);
  }
  console.log(next);
}
