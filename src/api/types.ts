// Types miroir des DTO Rust. Tous les montants sont en **centimes** (entiers) ;
// le formatage en euros se fait uniquement à l'affichage via `formatEuros`.

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
  prix_cents: number;
  actif: boolean;
  cree_le: string;
}

export interface NewPrestation {
  libelle: string;
  prix_cents: number;
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
  prix_cents_snapshot: number;
  quantite: number;
}

export interface NoteDetail {
  note: NoteDeFrais;
  lignes: NoteLigne[];
  total_cents: number;
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
  montant_cents: number;
  date_paiement: string;
  methode: string | null;
  cree_le: string;
}

export interface NewPaiement {
  note_id: number;
  montant_cents: number;
  date_paiement: string;
  methode: string | null;
}

export interface SoldeNote {
  note_id: number;
  total_cents: number;
  paye_cents: number;
  solde_cents: number;
  payee: boolean;
}

export interface Recu {
  id: number;
  paiement_id: number;
  numero: string;
  emis_le: string;
}

export interface ResumeStats {
  nb_clients: number;
  nb_notes: number;
  total_facture_cents: number;
  total_encaisse_cents: number;
  total_impaye_cents: number;
}
