// Client typé : un wrapper par commande Tauri. Seul point du frontend qui
// connaît `invoke` ; tout le reste de l'UI passe par ces fonctions.
import { invoke } from "@tauri-apps/api/core";
import type {
  Client,
  ClientResume,
  Depense,
  DepenseLigne,
  NewClient,
  NewDepense,
  NewNote,
  NewPaiement,
  NewPrestation,
  ModePaiement,
  NoteDeFrais,
  NoteDetail,
  NoteResume,
  Paiement,
  Parametres,
  Prestation,
  Recu,
  RecuDetail,
  RecuResume,
  ResumeStats,
  SoldeNote,
  StatMois,
} from "./types";

// --- Clients ---
export const listClients = () => invoke<Client[]>("list_clients");
export const listClientsResume = () =>
  invoke<ClientResume[]>("list_clients_resume");
export const getClient = (id: number) => invoke<Client>("get_client", { id });
export const createClient = (client: NewClient) =>
  invoke<number>("create_client", { client });
export const updateClient = (client: Client) =>
  invoke<void>("update_client", { client });
export const deleteClient = (id: number) =>
  invoke<void>("delete_client", { id });

// --- Prestations ---
export const listPrestations = () => invoke<Prestation[]>("list_prestations");
export const getPrestation = (id: number) =>
  invoke<Prestation>("get_prestation", { id });
export const createPrestation = (prestation: NewPrestation) =>
  invoke<number>("create_prestation", { prestation });
export const updatePrestation = (prestation: Prestation) =>
  invoke<void>("update_prestation", { prestation });
export const deletePrestation = (id: number) =>
  invoke<void>("delete_prestation", { id });
/** Prestations encore proposées à la facturation (archivées exclues). */
export const listPrestationsActives = () =>
  invoke<Prestation[]>("list_prestations_actives");
/** Archive (`actif = false`) ou réactive une prestation. */
export const archiverPrestation = (id: number, actif: boolean) =>
  invoke<void>("archiver_prestation", { id, actif });

// --- Notes de frais ---
export const listNotes = () => invoke<NoteDeFrais[]>("list_notes");
export const listNotesResume = () => invoke<NoteResume[]>("list_notes_resume");
export const getNote = (id: number) => invoke<NoteDetail>("get_note", { id });
export const createNote = (note: NewNote) =>
  invoke<number>("create_note", { note });
export const updateNote = (id: number, note: NewNote) =>
  invoke<void>("update_note", { id, note });
export const annulerNote = (id: number) => invoke<void>("annuler_note", { id });

// --- Paiements ---
export const listPaiements = (noteId: number) =>
  invoke<Paiement[]>("list_paiements", { noteId });
export const soldeNote = (noteId: number) =>
  invoke<SoldeNote>("solde_note", { noteId });
export const enregistrerPaiement = (paiement: NewPaiement) =>
  invoke<number>("enregistrer_paiement", { paiement });
/** Annule un paiement saisi par erreur (et son reçu éventuel). */
export const annulerPaiement = (id: number) =>
  invoke<void>("annuler_paiement", { id });

// --- Reçus ---
export const listRecus = () => invoke<Recu[]>("list_recus");
export const listRecusResume = () => invoke<RecuResume[]>("list_recus_resume");
export const getRecu = (id: number) => invoke<RecuDetail>("get_recu", { id });
export const genererRecu = (paiementId: number) =>
  invoke<Recu>("generer_recu", { paiementId });
export const annulerRecu = (id: number) => invoke<void>("annuler_recu", { id });

// --- Dépenses ---
export const listDepenses = (noteId: number) =>
  invoke<Depense[]>("list_depenses", { noteId });
export const listAllDepenses = () =>
  invoke<DepenseLigne[]>("list_all_depenses");
export const createDepense = (depense: NewDepense) =>
  invoke<number>("create_depense", { depense });
export const deleteDepense = (id: number) =>
  invoke<void>("delete_depense", { id });

// --- Stats ---
/** Récapitulatif, éventuellement borné à une période (dates ISO incluses). */
export const resumeStats = (du?: string | null, au?: string | null) =>
  invoke<ResumeStats>("resume_stats", { du: du || null, au: au || null });
export const statsMensuelles = () => invoke<StatMois[]>("stats_mensuelles");

// --- Modes de paiement ---
export const listModesPaiement = () =>
  invoke<ModePaiement[]>("list_modes_paiement");
export const createModePaiement = (libelle: string) =>
  invoke<number>("create_mode_paiement", { libelle });
export const deleteModePaiement = (id: number) =>
  invoke<void>("delete_mode_paiement", { id });

// --- Sauvegarde de la base ---
// Le chemin n'est pas un paramètre : la commande Rust ouvre elle-même la
// boîte de dialogue (voir commands::sauvegarde) pour qu'un renderer
// compromis ne puisse pas dicter où la base est lue ou écrite.
/** Ouvre « Enregistrer sous » et écrit une copie de la base. `false` si annulé. */
export const sauvegarderBase = () => invoke<boolean>("sauvegarder_base");
/** Ouvre « Ouvrir » et prépare la restauration ; elle prend effet au
 * redémarrage. `false` si annulé. */
export const restaurerBase = () => invoke<boolean>("restaurer_base");
export const cheminBase = () => invoke<string>("chemin_base");

// --- Paramètres (profil du cabinet) ---
export const getParametres = () => invoke<Parametres>("get_parametres");
export const saveParametres = (parametres: Parametres) =>
  invoke<void>("save_parametres", { parametres });
