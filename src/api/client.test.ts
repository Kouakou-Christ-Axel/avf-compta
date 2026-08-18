import { describe, it, expect } from "vitest";
import { mockIPC } from "@tauri-apps/api/mocks";
import {
  annulerPaiement,
  archiverPrestation,
  createClient,
  enregistrerPaiement,
  genererRecu,
  listClients,
  listPrestationsActives,
  soldeNote,
} from "./client";

/** Capture la dernière commande invoquée et ses arguments. */
function captureIPC() {
  const calls: { cmd: string; args: unknown }[] = [];
  mockIPC((cmd, args) => {
    calls.push({ cmd, args });
    return undefined;
  });
  return calls;
}

describe("client API", () => {
  it("listClients invoque la bonne commande", async () => {
    const calls = captureIPC();
    await listClients();
    expect(calls[0].cmd).toBe("list_clients");
  });

  it("createClient transmet le client", async () => {
    const calls = captureIPC();
    const client = {
      nom: "Acme",
      email: null,
      telephone: null,
      adresse: null,
    };
    await createClient(client);
    expect(calls[0].cmd).toBe("create_client");
    expect(calls[0].args).toEqual({ client });
  });

  it("soldeNote passe noteId", async () => {
    const calls = captureIPC();
    await soldeNote(42);
    expect(calls[0]).toEqual({ cmd: "solde_note", args: { noteId: 42 } });
  });

  it("enregistrerPaiement passe le paiement", async () => {
    const calls = captureIPC();
    const paiement = {
      note_id: 1,
      montant: 5000,
      date_paiement: "2026-06-18",
      methode: null,
    };
    await enregistrerPaiement(paiement);
    expect(calls[0]).toEqual({
      cmd: "enregistrer_paiement",
      args: { paiement },
    });
  });

  it("genererRecu passe paiementId", async () => {
    const calls = captureIPC();
    await genererRecu(7);
    expect(calls[0]).toEqual({ cmd: "generer_recu", args: { paiementId: 7 } });
  });

  it("annulerPaiement cible la bonne commande", async () => {
    const appels: Array<{ cmd: string; args: unknown }> = [];
    mockIPC((cmd, args) => {
      appels.push({ cmd, args });
      return undefined;
    });

    await annulerPaiement(7);
    expect(appels).toEqual([{ cmd: "annuler_paiement", args: { id: 7 } }]);
  });

  it("archiverPrestation transmet l'état actif", async () => {
    const appels: Array<{ cmd: string; args: unknown }> = [];
    mockIPC((cmd, args) => {
      appels.push({ cmd, args });
      return undefined;
    });

    await archiverPrestation(3, false);
    expect(appels).toEqual([
      { cmd: "archiver_prestation", args: { id: 3, actif: false } },
    ]);
  });

  it("listPrestationsActives n'appelle pas la liste complète", async () => {
    const appels: string[] = [];
    mockIPC((cmd) => {
      appels.push(cmd);
      return [];
    });

    await listPrestationsActives();
    expect(appels).toEqual(["list_prestations_actives"]);
  });
});
