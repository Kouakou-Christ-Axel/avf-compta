import { describe, it, expect } from "vitest";
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
});
