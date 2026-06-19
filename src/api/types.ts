// Types miroir des DTO Rust. Tous les montants sont en **francs CFA entiers
// (XOF)** ; le formatage se fait à l'affichage via `formatMontant`.

export interface Client {
  id: number;
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  cree_le: string;
}

export interface NewClient {
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
}

export interface Prestation {
  id: number;
  libelle: string;
  prix: number;
  actif: boolean;
  cree_le: string;
}

export interface NewPrestation {
  libelle: string;
  prix: number;
}

export interface NoteDeFrais {
  id: number;
  client_id: number;
  reference: string | null;
  date_emission: string;
  statut: string;
  cree_le: string;
}

export interface NoteLigne {
  id: number;
  note_id: number;
  prestation_id: number;
  libelle_snapshot: string;
  prix_snapshot: number;
  quantite: number;
}

export interface NoteDetail {
  note: NoteDeFrais;
  lignes: NoteLigne[];
  total: number;
}

export interface NewNoteLigne {
  prestation_id: number;
  quantite: number;
}

export interface NewNote {
  client_id: number;
  reference: string | null;
  date_emission: string;
  lignes: NewNoteLigne[];
}

export interface Paiement {
  id: number;
  note_id: number;
  montant: number;
  date_paiement: string;
  methode: string | null;
  cree_le: string;
}

export interface NewPaiement {
  note_id: number;
  montant: number;
  date_paiement: string;
  methode: string | null;
}

export interface SoldeNote {
  note_id: number;
  total: number;
  paye: number;
  solde: number;
  payee: boolean;
}

export interface Recu {
  id: number;
  paiement_id: number;
  numero: string;
  emis_le: string;
}

export interface RecuDetail {
  id: number;
  numero: string;
  emis_le: string;
  montant: number;
  date_paiement: string;
  methode: string | null;
  note_id: number;
  note_reference: string | null;
  client_nom: string;
  client_email: string | null;
  client_telephone: string | null;
}

export interface ResumeStats {
  nb_clients: number;
  nb_notes: number;
  total_facture: number;
  total_encaisse: number;
  total_impaye: number;
}
