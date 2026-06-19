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
 * Analyse une saisie utilisateur (« 150 000 », « 150000 ») en francs CFA
 * entiers. Les espaces sont ignorés ; les décimales ne sont pas acceptées car
 * le franc CFA n'a pas de sous-unité. Renvoie `null` si l'entrée est invalide.
 */
export function parseMontant(input: string): number | null {
  const cleaned = input.replace(/\s/g, "");
  const neg = cleaned.startsWith("-");
  const body = cleaned.replace(/^[+-]/, "");
  if (body === "" || !/^\d+$/.test(body)) return null;
  const value = Number(body);
  return neg ? -value : value;
}
