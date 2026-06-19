// Client typé : un wrapper par commande Tauri. Seul point du frontend qui
// connaît `invoke` ; tout le reste de l'UI passe par ces fonctions.
import { invoke } from "@tauri-apps/api/core";
import type {
  Client,
  NewClient,
  NewNote,
  NewPaiement,
  NewPrestation,
  NoteDeFrais,
  NoteDetail,
  Paiement,
  Prestation,
  Recu,
  ResumeStats,
  SoldeNote,
} from "./types";

// --- Clients ---
export const listClients = () => invoke<Client[]>("list_clients");
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

// --- Notes de frais ---
export const listNotes = () => invoke<NoteDeFrais[]>("list_notes");
export const getNote = (id: number) => invoke<NoteDetail>("get_note", { id });
export const createNote = (note: NewNote) =>
  invoke<number>("create_note", { note });
export const deleteNote = (id: number) => invoke<void>("delete_note", { id });

// --- Paiements ---
export const listPaiements = (noteId: number) =>
  invoke<Paiement[]>("list_paiements", { noteId });
export const soldeNote = (noteId: number) =>
  invoke<SoldeNote>("solde_note", { noteId });
export const enregistrerPaiement = (paiement: NewPaiement) =>
  invoke<number>("enregistrer_paiement", { paiement });

// --- Reçus ---
export const listRecus = () => invoke<Recu[]>("list_recus");
export const genererRecu = (paiementId: number) =>
  invoke<Recu>("generer_recu", { paiementId });

// --- Stats ---
export const resumeStats = () => invoke<ResumeStats>("resume_stats");
