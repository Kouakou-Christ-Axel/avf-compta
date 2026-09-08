import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const check = vi.fn();
const downloadAndInstall = vi.fn();

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: () => check(),
}));

import { MisesAJour } from "./MisesAJour";

beforeEach(() => {
  check.mockReset();
  downloadAndInstall.mockReset();
  check.mockResolvedValue({
    version: "0.8.0",
    currentVersion: "0.7.3",
    body: "",
    downloadAndInstall,
  });
});

async function allerJusquA(bouton: string) {
  render(<MisesAJour />);
  await userEvent.click(
    screen.getByRole("button", { name: "Vérifier les mises à jour" }),
  );
  await userEvent.click(await screen.findByRole("button", { name: bouton }));
}

describe("MisesAJour", () => {
  /// L'installateur n'étant pas signé, Windows affiche un écran d'alerte.
  /// Abandonner à ce moment-là peut laisser le poste sans application : il faut
  /// donc prévenir avant, pas après.
  it("avertit de l'alerte Windows avant de lancer l'installation", async () => {
    await allerJusquA("Télécharger et installer");

    expect(
      screen.getByText(/Windows a protégé votre ordinateur/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Exécuter quand même/)).toBeInTheDocument();
    expect(
      screen.getByText(/N'interrompez pas l'installation/),
    ).toBeInTheDocument();
    // Rien n'est téléchargé tant que l'avertissement n'est pas accepté.
    expect(downloadAndInstall).not.toHaveBeenCalled();
  });

  it("n'installe qu'après confirmation explicite", async () => {
    await allerJusquA("Télécharger et installer");
    await userEvent.click(
      screen.getByRole("button", { name: "J'ai compris, installer" }),
    );

    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
  });

  it("permet de revenir en arrière sans rien installer", async () => {
    await allerJusquA("Télécharger et installer");
    await userEvent.click(screen.getByRole("button", { name: "Plus tard" }));

    expect(
      screen.getByRole("button", { name: "Télécharger et installer" }),
    ).toBeInTheDocument();
    expect(downloadAndInstall).not.toHaveBeenCalled();
  });

  /// Un échec ne doit pas laisser croire que l'application a disparu.
  it("rassure sur la version en place quand l'installation échoue", async () => {
    downloadAndInstall.mockRejectedValue(new Error("installation annulée"));
    await allerJusquA("Télécharger et installer");
    await userEvent.click(
      screen.getByRole("button", { name: "J'ai compris, installer" }),
    );

    expect(
      await screen.findByText(/Votre version actuelle reste en place/),
    ).toBeInTheDocument();
  });
});
