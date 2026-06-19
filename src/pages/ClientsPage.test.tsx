import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { mockIPC } from "@tauri-apps/api/mocks";
import { ClientsPage } from "./ClientsPage";
import { ToastProvider } from "../components/ToastProvider";
import type { Client } from "../api/types";

describe("ClientsPage", () => {
  it("affiche la liste des clients", async () => {
    const clients: Client[] = [
      {
        id: 1,
        nom: "Acme SARL",
        email: "contact@acme.fr",
        telephone: null,
        adresse: null,
        cree_le: "2026-06-18",
      },
    ];
    mockIPC((cmd) => (cmd === "list_clients" ? clients : undefined));

    render(
      <ToastProvider>
        <ClientsPage />
      </ToastProvider>,
    );

    expect(await screen.findByText("Acme SARL")).toBeInTheDocument();
    expect(screen.getByText("contact@acme.fr")).toBeInTheDocument();
  });
});
