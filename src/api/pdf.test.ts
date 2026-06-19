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
};

const params: Parametres = {
  cabinet_nom: "Cabinet AVF",
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
  it("inclut le numéro, le montant et les coordonnées de paiement", () => {
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
    };
    const t = texte(recuDocDefinition(recu, params));
    expect(t).toContain("RECU-0001");
    expect(t).toContain("100 000 FCFA");
    expect(t).toContain("Wave +225 0700000000");
  });
});
