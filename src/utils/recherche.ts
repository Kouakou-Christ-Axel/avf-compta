const DIACRITIQUES = /[̀-ͯ]/g;

export function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(DIACRITIQUES, "").toLowerCase();
}

export function correspond(
  champs: Array<string | number | null | undefined>,
  terme: string,
): boolean {
  const t = normaliser(terme.trim());
  if (t === "") return true;
  return champs.some((c) => c != null && normaliser(String(c)).includes(t));
}
