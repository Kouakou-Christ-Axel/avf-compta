/** Symbole de la devise (franc CFA ouest-africain). */
export const DEVISE = "FCFA";

/**
 * Formate un montant en francs CFA entiers vers une chaîne à la française
 * (« 150 000 FCFA »). Reproduit le `Display` Rust de `Money`.
 */
export function formatMontant(francs: number): string {
  const negative = francs < 0;
  const abs = Math.abs(Math.trunc(francs));
  const grouped = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${negative ? "-" : ""}${grouped} ${DEVISE}`;
}

/**
 * Retire les séparateurs de milliers d'une saisie et renvoie les chiffres
 * seuls, ou `null` si la forme n'est pas celle d'un entier groupé par trois.
 * Miroir exact de `chiffres_seuls` dans `src-tauri/src/money.rs`.
 */
function chiffresSeuls(body: string): string | null {
  if (body === "") return null;
  if (/^\d+$/.test(body)) return body;
  // Un seul type de séparateur, des groupes de trois chiffres après le
  // premier : « 1.250.000 » passe, « 5,50 » et « 1.2345 » sont refusés.
  const sep = body.includes(".") ? "." : ",";
  const autre = sep === "." ? "," : ".";
  if (body.includes(autre)) return null;
  const groupes = body.split(sep);
  if (groupes.length < 2) return null;
  const [tete, ...reste] = groupes;
  if (!/^\d{1,3}$/.test(tete)) return null;
  if (!reste.every((g) => /^\d{3}$/.test(g))) return null;
  return tete + reste.join("");
}

/**
 * Analyse une saisie utilisateur en francs CFA entiers.
 *
 * Accepte les séparateurs de milliers usuels — espace, point ou virgule —
 * quand ils délimitent des groupes de trois chiffres : « 150 000 »,
 * « 150.000 », « 1,250,000 », « 150000 ». Les décimales restent refusées
 * (« 5,50 ») car le franc CFA n'a pas de sous-unité. Renvoie `null` si
 * l'entrée est invalide.
 */
export function parseMontant(input: string): number | null {
  const cleaned = input.replace(/\s/g, "");
  const neg = cleaned.startsWith("-");
  const body = cleaned.replace(/^[+-]/, "");
  const chiffres = chiffresSeuls(body);
  if (chiffres === null) return null;
  const value = Number(chiffres);
  if (!Number.isSafeInteger(value)) return null;
  return neg ? -value : value;
}
