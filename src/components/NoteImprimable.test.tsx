import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NoteImprimable } from "./NoteImprimable";
import type { NoteDetail } from "../api/types";

function detailAvecRemise(remise: number): NoteDetail {
  return {
    note: {
      id: 1,
      client_id: 1,
      reference: "26-06-0001",
      date_emission: "2026-06-18",
      statut: "emise",
      echeance: null,
      cree_le: "2026-06-18",
      remise_type: remise > 0 ? "pourcent" : null,
      remise_valeur: remise > 0 ? 10 : 0,
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
    remise,
    total: 30000 - remise,
    depenses: [],
    depenses_total: 0,
    marge: 30000 - remise,
  };
}

describe("NoteImprimable", () => {
  it("détaille la remise et le total net", () => {
    render(
      <NoteImprimable
        detail={detailAvecRemise(3000)}
        clientNom="Acme SARL"
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("Sous-total")).toBeInTheDocument();
    // Une fois sur la ligne de prestation, une fois en sous-total.
    expect(screen.getAllByText("30 000 FCFA")).toHaveLength(2);
    expect(screen.getByText("Remise (10 %)")).toBeInTheDocument();
    expect(screen.getByText("−3 000 FCFA")).toBeInTheDocument();
    expect(screen.getByText("27 000 FCFA")).toBeInTheDocument();
  });

  it("n'affiche aucune ligne de remise sans remise", () => {
    render(
      <NoteImprimable
        detail={detailAvecRemise(0)}
        clientNom="Acme SARL"
        onClose={() => {}}
      />,
    );

    expect(screen.queryByText("Sous-total")).not.toBeInTheDocument();
  });

  // Une facture annulée ne doit pas pouvoir être imprimée comme un document
  // valide.
  it("marque une facture annulée d'un filigrane", () => {
    const detail = detailAvecRemise(0);
    detail.note.statut = "annulee";
    render(
      <NoteImprimable
        detail={detail}
        clientNom="Acme SARL"
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("ANNULÉE")).toBeInTheDocument();
  });
});
