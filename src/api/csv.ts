import { invoke } from "@tauri-apps/api/core";

// Séparateur point-virgule : Excel français l'attend par défaut.
const SEP = ";";
// Marque d'ordre des octets : aide Excel à lire l'UTF-8 (accents).
const BOM = "\uFEFF";

function echappe(valeur: string): string {
  const v = valeur ?? "";
  if (
    v.includes(SEP) ||
    v.includes('"') ||
    v.includes("\n") ||
    v.includes("\r")
  ) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/**
 * Sépare les colonnes sur la ligne d'en-tête plutôt que sur la présence d'un
 * `;` n'importe où dans le fichier : une seule adresse contenant un
 * point-virgule (« Cocody; Angré ») faisait basculer tout un CSV en virgules,
 * et l'import décalait silencieusement les colonnes.
 *
 * Les séparateurs situés à l'intérieur de guillemets ne comptent pas.
 */
function detecterSeparateur(texte: string): string {
  const finLigne = texte.search(/\r?\n/);
  const entete = finLigne === -1 ? texte : texte.slice(0, finLigne);

  const compte = (sep: string): number => {
    let n = 0;
    let dansGuillemets = false;
    for (let i = 0; i < entete.length; i++) {
      const c = entete[i];
      if (c === '"') {
        if (dansGuillemets && entete[i + 1] === '"') i++;
        else dansGuillemets = !dansGuillemets;
      } else if (c === sep && !dansGuillemets) {
        n++;
      }
    }
    return n;
  };

  // À égalité (y compris zéro colonne supplémentaire), le point-virgule
  // l'emporte : c'est le format que l'application produit elle-même.
  return compte(";") >= compte(",") ? ";" : ",";
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
  const sep = detecterSeparateur(sansBom);
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

// La boîte « Enregistrer sous »/« Ouvrir » s'ouvre côté Rust (voir
// commands::fichiers) : un chemin choisi en JS traverserait la frontière
// JS→Rust et un renderer compromis pourrait alors le falsifier pour écrire
// ou lire n'importe quel fichier du disque.

/** Enregistre un contenu CSV via la boîte « Enregistrer sous ». */
export async function enregistrerCsv(
  nomFichier: string,
  contenu: string,
): Promise<boolean> {
  return invoke<boolean>("exporter_csv", { nomDefaut: nomFichier, contenu });
}

/** Ouvre un fichier CSV et renvoie son contenu texte (ou null si annulé). */
export async function ouvrirCsv(): Promise<string | null> {
  return invoke<string | null>("importer_csv");
}
