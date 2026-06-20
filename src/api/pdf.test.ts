import { describe, it, expect } from "vitest";
import { noteDocDefinition, recuDocDefinition } from "./pdf";
import type { NoteDetail, Parametres, RecuDetail } from "./types";

const detail: NoteDetail = {
  note: {
    id: 1,
    client_id: 1,
    reference: "26-06-0001",
    date_emission: "2026-06-18",
    statut: "emise",
    echeance: null,
    cree_le: "2026-06-18",
  },
  lignes: [
    {
      id: 1,
      note_id: 1,
      prestation_id: 1,
      libelle_snapshot: "Conseil",
      prix_snapshot: 50000,
      quantite: 2,
    },
  ],
  total: 100000,
  depenses: [],
  depenses_total: 0,
  marge: 100000,
};

const params: Parametres = {
  cabinet_nom: "Cabinet AVF",
  sous_titre: "Expert-comptable",
  email: "avf@exemple.ci",
  telephone: "0102030405",
  coordonnees_paiement: "Wave +225 0700000000",
  logo: null,
};

/** Aplati le contenu pdfmake en texte pour les assertions. */
function texte(def: unknown): string {
  return JSON.stringify(def);
}

describe("noteDocDefinition", () => {
  it("inclut la référence, le client et le total formaté", () => {
    const t = texte(noteDocDefinition(detail, "Acme SARL", null, params));
    expect(t).toContain("26-06-0001");
    expect(t).toContain("Acme SARL");
    expect(t).toContain("100 000 FCFA");
    expect(t).toContain("Cabinet AVF");
    expect(t).toContain("Wave +225 0700000000");
  });
});

describe("recuDocDefinition", () => {
  it("inclut le numéro et le montant, sans les coordonnées de paiement", () => {
    const recu: RecuDetail = {
      id: 1,
      numero: "RECU-0001",
      emis_le: "2026-06-19",
      montant: 100000,
      date_paiement: "2026-06-19",
      methode: "espèces",
      note_id: 1,
      note_reference: "26-06-0001",
      client_nom: "Acme SARL",
      client_email: null,
      client_telephone: null,
      lignes: [
        {
          id: 1,
          note_id: 1,
          prestation_id: 1,
          libelle_snapshot: "Conseil",
          prix_snapshot: 100000,
          quantite: 1,
        },
      ],
      note_total: 100000,
      note_solde: 40000,
    };
    const t = texte(recuDocDefinition(recu, params));
    expect(t).toContain("RECU-0001");
    expect(t).toContain("100 000 FCFA");
    expect(t).toContain("Conseil");
    expect(t).toContain("Reste à payer");
    expect(t).toContain("40 000 FCFA");
    // Les coordonnées de paiement ne figurent pas sur le reçu.
    expect(t).not.toContain("Wave +225 0700000000");
  });
});

describe("noteDocDefinition (reste à payer)", () => {
  it("affiche le reste à payer", () => {
    const t = texte(
      noteDocDefinition(detail, "Acme SARL", {
        note_id: 1,
        total: 100000,
        paye: 40000,
        solde: 60000,
        payee: false,
      }),
    );
    expect(t).toContain("Reste à payer");
    expect(t).toContain("60 000 FCFA");
  });
});
