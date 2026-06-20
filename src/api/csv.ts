import { invoke } from "@tauri-apps/api/core";

// Séparateur point-virgule : Excel français l'attend par défaut.
const SEP = ";";
// Marque d'ordre des octets : aide Excel à lire l'UTF-8 (accents).
const BOM = "\uFEFF";

function echappe(valeur: string): string {
  const v = valeur ?? "";
  if (v.includes(SEP) || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** Construit un CSV (UTF-8 BOM pour Excel) depuis des en-têtes et des lignes. */
export function toCsv(headers: string[], rows: string[][]): string {
  const lignes = [headers, ...rows]
    .map((cols) => cols.map(echappe).join(SEP))
    .join("\r\n");
  return BOM + lignes;
}

/** Analyse un CSV simple (séparateur `;` ou `,`, guillemets gérés). */
export function parseCsv(texte: string): string[][] {
  const sansBom = texte.startsWith(BOM) ? texte.slice(1) : texte;
  const sep = sansBom.includes(";") ? ";" : ",";
  const lignes: string[][] = [];
  let champ = "";
  let ligne: string[] = [];
  let dansGuillemets = false;

  for (let i = 0; i < sansBom.length; i++) {
    const c = sansBom[i];
    if (dansGuillemets) {
      if (c === '"') {
        if (sansBom[i + 1] === '"') {
          champ += '"';
          i++;
        } else {
          dansGuillemets = false;
        }
      } else {
        champ += c;
      }
    } else if (c === '"') {
      dansGuillemets = true;
    } else if (c === sep) {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n") {
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = "";
    } else if (c !== "\r") {
      champ += c;
    }
  }
  if (champ !== "" || ligne.length > 0) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  return lignes.filter((l) => l.some((c) => c.trim() !== ""));
}

/** Enregistre un contenu CSV via la boîte « Enregistrer sous ». */
export async function enregistrerCsv(
  nomFichier: string,
  contenu: string,
): Promise<boolean> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const chemin = await save({
    defaultPath: nomFichier,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (!chemin) return false;
  const octets = Array.from(new TextEncoder().encode(contenu));
  await invoke("enregistrer_fichier", { chemin, contenu: octets });
  return true;
}

/** Ouvre un fichier CSV et renvoie son contenu texte (ou null si annulé). */
export async function ouvrirCsv(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const chemin = await open({
    multiple: false,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (!chemin || typeof chemin !== "string") return null;
  return invoke<string>("lire_fichier", { chemin });
}
