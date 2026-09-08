/** Date du jour au format `YYYY-MM-DD`, celui attendu par les champs date. */
export function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}
