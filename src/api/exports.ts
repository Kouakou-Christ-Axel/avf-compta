import {
  createClient,
  getRecu,
  listAllDepenses,
  listClientsResume,
  listNotesResume,
  listRecus,
} from "./client";
import { enregistrerCsv, ouvrirCsv, parseCsv, toCsv } from "./csv";

const ENTETES_CLIENTS = ["nom", "email", "telephone", "adresse"];

/** Exporte la liste des clients (avec cumuls) en CSV. */
export async function exporterClientsCsv(): Promise<boolean> {
  const clients = await listClientsResume();
  const csv = toCsv(
    ["Nom", "Email", "Téléphone", "Total facturé", "Payé", "Restant"],
    clients.map((c) => [
      c.nom,
      c.email ?? "",
      c.telephone ?? "",
      String(c.total_facture),
      String(c.total_paye),
      String(c.solde),
    ]),
  );
  return enregistrerCsv("clients.csv", csv);
}

/** Exporte la liste des reçus (détaillés) en CSV. */
export async function exporterRecusCsv(): Promise<boolean> {
  const recus = await listRecus();
  const details = await Promise.all(recus.map((r) => getRecu(r.id)));
  const csv = toCsv(
    ["Numéro", "Émis le", "Client", "Note", "Date paiement", "Montant"],
    details.map((d) => [
      d.numero,
      d.emis_le.slice(0, 10),
      d.client_nom,
      d.note_reference ?? `#${d.note_id}`,
      d.date_paiement.slice(0, 10),
      String(d.montant),
    ]),
  );
  return enregistrerCsv("recus.csv", csv);
}

/** Exporte la liste des notes de frais (avec montants) en CSV. */
export async function exporterNotesCsv(): Promise<boolean> {
  const [notes, clients] = await Promise.all([
    listNotesResume(),
    listClientsResume(),
  ]);
  const nomClient = new Map(clients.map((c) => [c.id, c.nom]));
  const csv = toCsv(
    [
      "Référence",
      "Client",
      "Date",
      "Échéance",
      "Statut",
      "Montant",
      "Payé",
      "Restant",
    ],
    notes.map((n) => [
      n.reference ?? `#${n.id}`,
      nomClient.get(n.client_id) ?? "",
      n.date_emission,
      n.echeance ?? "",
      n.statut,
      String(n.total),
      String(n.paye),
      String(n.solde),
    ]),
  );
  return enregistrerCsv("notes-de-frais.csv", csv);
}

/** Exporte toutes les dépenses (avec la note liée) en CSV. */
export async function exporterDepensesCsv(): Promise<boolean> {
  const depenses = await listAllDepenses();
  const csv = toCsv(
    ["Note", "Libellé", "Montant", "Date"],
    depenses.map((d) => [
      d.note_reference ?? `#${d.note_id}`,
      d.libelle,
      String(d.montant),
      d.date_depense,
    ]),
  );
  return enregistrerCsv("depenses.csv", csv);
}

/** Enregistre un modèle CSV vierge (en-têtes) pour l'import de clients. */
export async function telechargerModeleClients(): Promise<boolean> {
  const csv = toCsv(ENTETES_CLIENTS, [
    ["Exemple SARL", "contact@exemple.ci", "01 02 03 04 05", "Abidjan"],
  ]);
  return enregistrerCsv("modele-clients.csv", csv);
}

/**
 * Importe des clients depuis un fichier CSV (colonnes nom, email, téléphone,
 * adresse). Renvoie le nombre de clients créés, ou null si l'utilisateur a
 * annulé. La première ligne est ignorée si elle ressemble à un en-tête.
 */
export async function importerClientsCsv(): Promise<number | null> {
  const texte = await ouvrirCsv();
  if (texte === null) return null;

  const lignes = parseCsv(texte);
  if (lignes.length === 0) return 0;

  // Ignore l'en-tête éventuel (première cellule = « nom »).
  const premier = (lignes[0][0] ?? "").trim().toLowerCase();
  const corps = premier === "nom" ? lignes.slice(1) : lignes;

  let crees = 0;
  for (const cols of corps) {
    const nom = (cols[0] ?? "").trim();
    if (!nom) continue;
    await createClient({
      nom,
      email: (cols[1] ?? "").trim() || null,
      telephone: (cols[2] ?? "").trim() || null,
      adresse: (cols[3] ?? "").trim() || null,
    });
    crees++;
  }
  return crees;
}
