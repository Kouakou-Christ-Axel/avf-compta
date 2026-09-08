import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockIPC } from "@tauri-apps/api/mocks";
import { RecusPage } from "./RecusPage";
import { ToastProvider } from "../components/ToastProvider";
import type { RecuResume } from "../api/types";

const recus: RecuResume[] = [
  {
    id: 1,
    numero: "RECU-0001",
    emis_le: "2026-06-20T10:00:00",
    montant: 40000,
    annule: false,
    client_nom: "Acme SARL",
  },
  {
    id: 2,
    numero: "RECU-0002",
    emis_le: "2026-06-21T10:00:00",
    montant: 15000,
    annule: true,
    client_nom: "Bêta SA",
  },
];

function mockPage() {
  const appels: string[] = [];
  mockIPC((cmd) => {
    appels.push(cmd);
    if (cmd === "list_recus_resume") return recus;
    if (cmd === "get_parametres") {
      return {
        cabinet_nom: null,
        sous_titre: null,
        email: null,
        telephone: null,
        coordonnees_paiement: null,
        logo: null,
      };
    }
    return undefined;
  });
  return appels;
}

function afficher() {
  render(
    <ToastProvider>
      <RecusPage />
    </ToastProvider>,
  );
}

describe("RecusPage", () => {
  it("liste les reçus et signale ceux qui sont annulés", async () => {
    mockPage();
    afficher();

    expect(await screen.findByText("RECU-0001")).toBeInTheDocument();
    const annule = screen.getByText("RECU-0002").closest("tr");
    expect(
      within(annule as HTMLElement).getByText("Annulé"),
    ).toBeInTheDocument();
    // Un reçu déjà annulé ne peut plus l'être une seconde fois.
    expect(
      within(annule as HTMLElement).queryByRole("button", { name: "Annuler" }),
    ).not.toBeInTheDocument();
  });

  // La page affichait « Aucun reçu pour le moment » pendant le tout premier
  // chargement, laissant croire à une liste vide.
  it("annonce le chargement avant la première réponse", () => {
    mockIPC(() => new Promise(() => {})); // ne répond jamais
    afficher();

    expect(screen.getByText("Chargement…")).toBeInTheDocument();
    expect(
      screen.queryByText("Aucun reçu pour le moment."),
    ).not.toBeInTheDocument();
  });

  it("n'annule rien si la confirmation est refusée", async () => {
    const appels = mockPage();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    afficher();

    const ligne = (await screen.findByText("RECU-0001")).closest("tr");
    await userEvent.click(
      within(ligne as HTMLElement).getByRole("button", { name: "Annuler" }),
    );

    expect(appels).not.toContain("annuler_recu");
  });

  it("filtre la liste sur la recherche", async () => {
    mockPage();
    afficher();

    await screen.findByText("RECU-0001");
    await userEvent.type(screen.getByRole("searchbox"), "Bêta");

    expect(screen.queryByText("RECU-0001")).not.toBeInTheDocument();
    expect(screen.getByText("RECU-0002")).toBeInTheDocument();
  });
});
