import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockIPC } from "@tauri-apps/api/mocks";
import { PrestationsPage } from "./PrestationsPage";
import { ToastProvider } from "../components/ToastProvider";
import type { Prestation } from "../api/types";

const prestations: Prestation[] = [
  {
    id: 1,
    libelle: "Bilan annuel",
    prix: 150000,
    actif: true,
    cree_le: "2026-01-01",
  },
  {
    id: 2,
    libelle: "Ancienne formule",
    prix: 50000,
    actif: false,
    cree_le: "2026-01-01",
  },
];

/** Capture les commandes appelées, pour vérifier ce que la page déclenche. */
function mockPage() {
  const appels: string[] = [];
  mockIPC((cmd) => {
    appels.push(cmd);
    if (cmd === "list_prestations") return prestations;
    return undefined;
  });
  return appels;
}

function afficher() {
  render(
    <ToastProvider>
      <PrestationsPage />
    </ToastProvider>,
  );
}

describe("PrestationsPage", () => {
  it("liste les prestations avec leur prix en francs", async () => {
    mockPage();
    afficher();

    expect(await screen.findByText("Bilan annuel")).toBeInTheDocument();
    expect(screen.getByText(/150\s000/)).toBeInTheDocument();
  });

  // Archiver est la voie de sortie d'une prestation déjà facturée, que la
  // suppression refuse : la ligne doit donc proposer l'action inverse selon
  // l'état.
  it("propose d'archiver une prestation active et de réactiver une archivée", async () => {
    mockPage();
    afficher();

    const active = (await screen.findByText("Bilan annuel")).closest("tr");
    const archivee = screen.getByText("Ancienne formule").closest("tr");
    expect(
      within(active as HTMLElement).getByRole("button", { name: "Archiver" }),
    ).toBeInTheDocument();
    expect(
      within(archivee as HTMLElement).getByRole("button", {
        name: "Réactiver",
      }),
    ).toBeInTheDocument();
  });

  it("ne supprime rien si la confirmation est refusée", async () => {
    const appels = mockPage();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    afficher();

    const ligne = (await screen.findByText("Bilan annuel")).closest("tr");
    await userEvent.click(
      within(ligne as HTMLElement).getByRole("button", { name: "Supprimer" }),
    );

    expect(appels).not.toContain("delete_prestation");
  });
});
