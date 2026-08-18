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

/** Remise globale d'une facture : montant fixe en francs, ou pourcentage. */
export type RemiseType = "montant" | "pourcent";

export interface NoteDeFrais {
  id: number;
  client_id: number;
  reference: string | null;
  date_emission: string;
  statut: string;
  echeance: string | null;
  cree_le: string;
  remise_type: RemiseType | null;
  remise_valeur: number;
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
  /** Total des lignes avant remise. */
  total_brut: number;
  /** Montant de la remise réellement déduite. */
  remise: number;
  /** Total net facturé (brut − remise). */
  total: number;
  depenses: Depense[];
  depenses_total: number;
  marge: number;
}

export interface NoteResume {
  id: number;
  client_id: number;
  client_nom: string;
  reference: string | null;
  date_emission: string;
  statut: string;
  echeance: string | null;
  total: number;
  paye: number;
  solde: number;
}

export interface Depense {
  id: number;
  note_id: number;
  libelle: string;
  montant: number;
  date_depense: string;
  cree_le: string;
}

export interface NewDepense {
  note_id: number;
  libelle: string;
  montant: number;
  date_depense: string;
}

export interface DepenseLigne {
  id: number;
  note_id: number;
  note_reference: string | null;
  libelle: string;
  montant: number;
  date_depense: string;
}

export interface ClientResume {
  id: number;
  nom: string;
  email: string | null;
  telephone: string | null;
  total_facture: number;
  total_paye: number;
  solde: number;
  total_depenses: number;
  marge: number;
}

export interface NewNoteLigne {
  prestation_id: number;
  quantite: number;
}

export interface NewNote {
  client_id: number;
  date_emission: string;
  echeance: string | null;
  lignes: NewNoteLigne[];
  remise_type: RemiseType | null;
  /** Francs si `remise_type === "montant"`, points de % sinon. */
  remise_valeur: number;
}

export interface Paiement {
  id: number;
  note_id: number;
  montant: number;
  date_paiement: string;
  methode: string | null;
  annule: boolean;
  cree_le: string;
  /** Reçu déjà émis pour ce paiement (au plus un), s'il existe. */
  recu_id: number | null;
  recu_numero: string | null;
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
  annule: boolean;
  /** Total facturé figé à l'émission du reçu. */
  note_total: number;
  /** Reste à payer figé à l'émission du reçu. */
  note_solde: number;
}

export interface RecuDetail {
  id: number;
  numero: string;
  emis_le: string;
  montant: number;
  date_paiement: string;
  methode: string | null;
  annule: boolean;
  note_id: number;
  note_reference: string | null;
  client_nom: string;
  client_email: string | null;
  client_telephone: string | null;
  lignes: NoteLigne[];
  note_total: number;
  note_solde: number;
}

export interface ResumeStats {
  nb_clients: number;
  nb_notes: number;
  total_facture: number;
  total_encaisse: number;
  total_impaye: number;
}

export interface RecuResume {
  id: number;
  numero: string;
  emis_le: string;
  client_nom: string;
  montant: number;
  annule: boolean;
}

export interface StatMois {
  mois: string;
  ca: number;
  depenses: number;
  marge: number;
}

export interface ModePaiement {
  id: number;
  libelle: string;
}

export interface Parametres {
  cabinet_nom: string | null;
  /** Sous-titre libre (ex: « Expert-comptable »). */
  sous_titre: string | null;
  email: string | null;
  telephone: string | null;
  coordonnees_paiement: string | null;
  /** Logo en data-URL base64 (image), facultatif. */
  logo: string | null;
}
