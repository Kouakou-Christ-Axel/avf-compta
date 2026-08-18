import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockIPC } from "@tauri-apps/api/mocks";
import { DepensesPage } from "./DepensesPage";
import { ToastProvider } from "../components/ToastProvider";
import type { DepenseLigne } from "../api/types";

const depenses: DepenseLigne[] = [
  {
    id: 1,
    note_id: 1,
    note_reference: "26-06-0001",
    libelle: "Déplacement",
    montant: 15000,
    date_depense: "2026-06-20",
  },
  {
    id: 2,
    note_id: null,
    note_reference: null,
    libelle: "Loyer du cabinet",
    montant: 120000,
    date_depense: "2026-06-01",
  },
];

function mockPage(appels: Array<{ cmd: string; args: unknown }> = []) {
  mockIPC((cmd, args) => {
    appels.push({ cmd, args });
    switch (cmd) {
      case "list_all_depenses":
        return depenses;
      case "list_notes_resume":
      case "list_clients_resume":
        return [];
      default:
        return undefined;
    }
  });
}

describe("DepensesPage", () => {
  // Le loyer ou le carburant du cabinet n'ont pas de facture cliente : ils
  // étaient impossibles à enregistrer.
  it("affiche une dépense sans facture comme charge du cabinet", async () => {
    mockPage();
    render(
      <ToastProvider>
        <DepensesPage />
      </ToastProvider>,
    );

    expect(await screen.findByText("Loyer du cabinet")).toBeInTheDocument();
    expect(screen.getByText("Charge du cabinet")).toBeInTheDocument();
    expect(screen.getByText("26-06-0001")).toBeInTheDocument();
  });

  it("enregistre une dépense sans facture sélectionnée", async () => {
    const appels: Array<{ cmd: string; args: unknown }> = [];
    mockPage(appels);
    render(
      <ToastProvider>
        <DepensesPage />
      </ToastProvider>,
    );
    await screen.findByText("Loyer du cabinet");

    await userEvent.type(
      screen.getByPlaceholderText("Ex : Frais de déplacement"),
      "Électricité",
    );
    await userEvent.type(screen.getByPlaceholderText("Ex : 25 000"), "35.000");
    await userEvent.click(
      screen.getByRole("button", { name: "Ajouter la dépense" }),
    );

    const creation = appels.find((a) => a.cmd === "create_depense");
    expect(creation).toBeDefined();
    expect(creation?.args).toMatchObject({
      depense: {
        note_id: null,
        libelle: "Électricité",
        // « 35.000 » doit être compris comme 35 000 francs, pas rejeté.
        montant: 35000,
      },
    });
  });

  it("demande confirmation avant de supprimer", async () => {
    const appels: Array<{ cmd: string; args: unknown }> = [];
    mockPage(appels);
    const confirmation = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => false);

    render(
      <ToastProvider>
        <DepensesPage />
      </ToastProvider>,
    );
    const boutons = await screen.findAllByRole("button", { name: "Supprimer" });
    await userEvent.click(boutons[0]);

    expect(confirmation).toHaveBeenCalled();
    expect(appels.map((a) => a.cmd)).not.toContain("delete_depense");
    confirmation.mockRestore();
  });
});
