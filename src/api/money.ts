/**
 * Formate un montant en centimes vers une chaîne en euros à la française
 * (« 1 234,56 € »). Reproduit le `Display` Rust de `Money`.
 */
export function formatEuros(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const euros = Math.floor(abs / 100);
  const c = abs % 100;

  const grouped = euros.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const cc = c.toString().padStart(2, "0");

  return `${negative ? "-" : ""}${grouped},${cc} €`;
}

/**
 * Analyse une saisie utilisateur (« 1 234,56 », « 1234.5 », « 12 ») en
 * centimes, sans flottant, avec arrondi au centime le plus proche. Renvoie
 * `null` si l'entrée est invalide.
 */
export function parseEuros(input: string): number | null {
  const cleaned = input.replace(/\s/g, "").replace(",", ".");
  const neg = cleaned.startsWith("-");
  const body = cleaned.replace(/^[+-]/, "");

  const parts = body.split(".");
  if (parts.length > 2) return null;
  const [intPart = "", fracPart = ""] = parts;
  if (intPart === "" && fracPart === "") return null;
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) return null;

  const intVal = intPart === "" ? 0 : Number(intPart);
  const d = (i: number) => (fracPart[i] ? Number(fracPart[i]) : 0);
  let cents = intVal * 100 + d(0) * 10 + d(1);
  if (d(2) >= 5) cents += 1;

  return neg ? -cents : cents;
}
