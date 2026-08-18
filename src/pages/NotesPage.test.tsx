import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockIPC } from "@tauri-apps/api/mocks";
import { NotesPage } from "./NotesPage";
import { ToastProvider } from "../components/ToastProvider";
import type { NoteDetail, NoteResume, Paiement, SoldeNote } from "../api/types";

const note: NoteResume = {
  id: 1,
  client_id: 1,
  client_nom: "Acme SARL",
  reference: "26-06-0001",
  date_emission: "2026-06-18",
  statut: "emise",
  echeance: null,
  total: 27000,
  paye: 10000,
  solde: 17000,
};

const detail: NoteDetail = {
  note: {
    id: 1,
    client_id: 1,
    reference: "26-06-0001",
    date_emission: "2026-06-18",
    statut: "emise",
    echeance: null,
    cree_le: "2026-06-18",
    remise_type: "pourcent",
    remise_valeur: 10,
  },
  lignes: [
    {
      id: 1,
      note_id: 1,
      prestation_id: 1,
      libelle_snapshot: "Conseil",
      prix_snapshot: 30000,
      quantite: 1,
    },
  ],
  total_brut: 30000,
  remise: 3000,
  total: 27000,
  depenses: [],
  depenses_total: 0,
  marge: 27000,
};

const solde: SoldeNote = {
  note_id: 1,
  total: 27000,
  paye: 10000,
  solde: 17000,
  payee: false,
};

function paiement(extra: Partial<Paiement> = {}): Paiement {
  return {
    id: 5,
    note_id: 1,
    montant: 10000,
    date_paiement: "2026-06-20",
    methode: "Espèces",
    annule: false,
    cree_le: "2026-06-20",
    recu_id: null,
    recu_numero: null,
    ...extra,
  };
}

/** Répond aux commandes chargées par la page et son modal de détail. */
function mockPage(paiements: Paiement[]) {
  mockIPC((cmd) => {
    switch (cmd) {
      case "list_notes_resume":
        return [note];
      case "list_clients":
      case "list_prestations_actives":
      case "list_modes_paiement":
        return [];
      case "get_parametres":
        return {
          cabinet_nom: null,
          sous_titre: null,
          email: null,
          telephone: null,
          coordonnees_paiement: null,
          logo: null,
        };
      case "get_note":
        return detail;
      case "solde_note":
        return solde;
      case "list_paiements":
        return paiements;
      default:
        return undefined;
    }
  });
}

async function ouvrirDetail() {
  render(
    <ToastProvider>
      <NotesPage />
    </ToastProvider>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "Détail" }));
}

describe("NotesPage — reçus", () => {
  it("propose de générer le reçu quand le paiement n'en a pas", async () => {
    mockPage([paiement()]);
    await ouvrirDetail();

    expect(
      await screen.findByRole("button", { name: "Générer le reçu" }),
    ).toBeInTheDocument();
  });

  // Cœur du bug de doublon : un paiement déjà quittancé ne doit plus offrir
  // « générer », seulement la consultation du reçu existant.
  it("renvoie vers le reçu existant au lieu d'en générer un second", async () => {
    mockPage([paiement({ recu_id: 9, recu_numero: "RECU-0003" })]);
    await ouvrirDetail();

    expect(
      await screen.findByRole("button", { name: "Voir RECU-0003" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Générer le reçu" }),
    ).not.toBeInTheDocument();
  });

  it("permet d'annuler un paiement saisi par erreur", async () => {
    mockPage([paiement()]);
    await ouvrirDetail();

    // La ligne du paiement, repérée par son mode de règlement.
    const ligne = (await screen.findByText("Espèces")).closest("tr");
    expect(ligne).not.toBeNull();
    expect(
      within(ligne as HTMLElement).getByRole("button", { name: "Annuler" }),
    ).toBeInTheDocument();
  });
});
