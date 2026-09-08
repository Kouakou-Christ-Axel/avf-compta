import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { NoteImprimable } from "./NoteImprimable";
import { RecuImprimable } from "./RecuImprimable";
import type {
  NoteDetail,
  Parametres,
  RecuDetail,
  SoldeNote,
} from "../api/types";

const params: Parametres = {
  cabinet_nom: "Cabinet AVF",
  sous_titre: "Expertise comptable",
  email: "contact@avf.ci",
  telephone: "+225 01 02 03 04",
  coordonnees_paiement: "IBAN CI00 0000",
  logo: "data:image/png;base64,AAA",
};

const detail: NoteDetail = {
  note: {
    id: 1,
    client_id: 1,
    reference: "26-06-0001",
    date_emission: "2026-06-18",
    statut: "annulee",
    echeance: "2026-07-18",
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
      quantite: 2,
    },
  ],
  total_brut: 60000,
  remise: 6000,
  total: 54000,
  depenses: [],
  depenses_total: 0,
  marge: 54000,
};

const solde: SoldeNote = {
  note_id: 1,
  total: 54000,
  paye: 4000,
  solde: 50000,
  payee: false,
};

const recu: RecuDetail = {
  id: 1,
  numero: "RECU-0001",
  emis_le: "2026-06-20T10:00:00",
  montant: 4000,
  date_paiement: "2026-06-20",
  methode: "Espèces",
  annule: true,
  note_id: 1,
  note_reference: "26-06-0001",
  client_nom: "Acme SARL",
  client_email: "acme@example.ci",
  client_telephone: "+225 05 06 07 08",
  lignes: detail.lignes,
  note_total: 54000,
  note_solde: 50000,
};

/**
 * `App.css` accroche ses règles `@media print` à la structure et aux classes de
 * ces deux aperçus, et l'impression dépend de leur rendu **sous `<body>`**, via
 * un portail, en dehors de `#root`. Un instantané fige donc tout cela : aucun
 * autre test ne regarde la mise en page imprimée, qu'un refactor peut casser
 * en silence.
 */
describe("DOM des aperçus avant impression", () => {
  it("facture — structure figée", () => {
    render(
      <NoteImprimable
        detail={detail}
        solde={solde}
        clientNom="Acme SARL"
        params={params}
        onClose={() => {}}
      />,
    );
    expect(document.body.innerHTML).toMatchSnapshot();
  });

  it("reçu — structure figée", () => {
    render(<RecuImprimable recu={recu} params={params} onClose={() => {}} />);
    expect(document.body.innerHTML).toMatchSnapshot();
  });
});
