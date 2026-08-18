import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockIPC } from "@tauri-apps/api/mocks";
import { ClientsPage } from "./ClientsPage";
import { ToastProvider } from "../components/ToastProvider";
import type { ClientResume } from "../api/types";

describe("ClientsPage", () => {
  it("affiche la liste des clients avec les cumuls", async () => {
    const clients: ClientResume[] = [
      {
        id: 1,
        nom: "Acme SARL",
        email: "contact@acme.fr",
        telephone: null,
        total_facture: 150000,
        total_paye: 50000,
        solde: 100000,
        total_depenses: 30000,
        marge: 120000,
      },
    ];
    mockIPC((cmd) => (cmd === "list_clients_resume" ? clients : undefined));

    render(
      <ToastProvider>
        <ClientsPage />
      </ToastProvider>,
    );

    expect(await screen.findByText("Acme SARL")).toBeInTheDocument();
    expect(screen.getByText("contact@acme.fr")).toBeInTheDocument();
    expect(screen.getByText("150 000 FCFA")).toBeInTheDocument();
    expect(screen.getByText("100 000 FCFA")).toBeInTheDocument();
  });

  it("filtre les clients via la barre de recherche", async () => {
    const clients: ClientResume[] = [
      {
        id: 1,
        nom: "Acme SARL",
        email: "contact@acme.fr",
        telephone: null,
        total_facture: 150000,
        total_paye: 50000,
        solde: 100000,
        total_depenses: 30000,
        marge: 120000,
      },
      {
        id: 2,
        nom: "Bêta Services",
        email: "hello@beta.ci",
        telephone: "0102030405",
        total_facture: 0,
        total_paye: 0,
        solde: 0,
        total_depenses: 0,
        marge: 0,
      },
    ];
    mockIPC((cmd) => (cmd === "list_clients_resume" ? clients : undefined));

    render(
      <ToastProvider>
        <ClientsPage />
      </ToastProvider>,
    );

    expect(await screen.findByText("Acme SARL")).toBeInTheDocument();
    expect(screen.getByText("Bêta Services")).toBeInTheDocument();

    const recherche = screen.getByPlaceholderText(
      "Rechercher un client (nom, email, téléphone)…",
    );
    // Recherche insensible aux accents : "beta" doit trouver "Bêta".
    await userEvent.type(recherche, "beta");

    expect(screen.queryByText("Acme SARL")).not.toBeInTheDocument();
    expect(screen.getByText("Bêta Services")).toBeInTheDocument();
  });

  it("charge la fiche complète dans le formulaire pour modification", async () => {
    const resume: ClientResume[] = [
      {
        id: 7,
        nom: "Acme SARL",
        email: "contact@acme.fr",
        telephone: "0102030405",
        total_facture: 0,
        total_paye: 0,
        solde: 0,
        total_depenses: 0,
        marge: 0,
      },
    ];
    mockIPC((cmd) => {
      if (cmd === "list_clients_resume") return resume;
      // La liste n'expose pas l'adresse : la modification repart de la fiche
      // complète pour ne pas l'effacer.
      if (cmd === "get_client")
        return {
          id: 7,
          nom: "Acme SARL",
          email: "contact@acme.fr",
          telephone: "0102030405",
          adresse: "Abidjan, Plateau",
          cree_le: "2026-01-01",
        };
      return undefined;
    });

    render(
      <ToastProvider>
        <ClientsPage />
      </ToastProvider>,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "Modifier" }),
    );

    expect(
      await screen.findByText("Modifier « Acme SARL »"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Acme SARL")).toBeInTheDocument();
    expect(screen.getByDisplayValue("contact@acme.fr")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enregistrer les modifications" }),
    ).toBeInTheDocument();
  });

  // Un client se supprimait en un clic, sans retour en arrière possible.
  it("demande confirmation avant de supprimer", async () => {
    const clients: ClientResume[] = [
      {
        id: 1,
        nom: "Acme SARL",
        email: null,
        telephone: null,
        total_facture: 0,
        total_paye: 0,
        solde: 0,
        total_depenses: 0,
        marge: 0,
      },
    ];
    const appels: string[] = [];
    mockIPC((cmd) => {
      appels.push(cmd);
      return cmd === "list_clients_resume" ? clients : undefined;
    });
    const confirmation = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => false);

    render(
      <ToastProvider>
        <ClientsPage />
      </ToastProvider>,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Supprimer" }),
    );

    expect(confirmation).toHaveBeenCalled();
    expect(appels).not.toContain("delete_client");
    confirmation.mockRestore();
  });
});
