import { describe, it, expect } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { mockIPC } from "@tauri-apps/api/mocks";
import { StatsPage } from "./StatsPage";
import type { ResumeStats } from "../api/types";

describe("StatsPage", () => {
  it("affiche les montants formatés", async () => {
    const stats: ResumeStats = {
      nb_clients: 3,
      nb_notes: 2,
      total_facture: 1250000,
      total_encaisse: 1000000,
      total_impaye: 250000,
    };
    mockIPC((cmd) => {
      if (cmd === "resume_stats") return stats;
      if (cmd === "stats_mensuelles") return [];
      return undefined;
    });

    render(<StatsPage />);

    expect(await screen.findByText("1 250 000 FCFA")).toBeInTheDocument();
    expect(screen.getByText("Total impayé")).toBeInTheDocument();
    expect(screen.getByText("250 000 FCFA")).toBeInTheDocument();
  });

  // Les cartes ignoraient le filtre de période, alors que les graphiques le
  // respectaient : les deux moitiés de l'écran montraient des chiffres
  // différents sans que rien ne l'indique.
  it("relance le calcul des cartes quand la période change", async () => {
    const stats: ResumeStats = {
      nb_clients: 3,
      nb_notes: 2,
      total_facture: 1250000,
      total_encaisse: 1000000,
      total_impaye: 250000,
    };
    const bornes: unknown[] = [];
    mockIPC((cmd, args) => {
      if (cmd === "resume_stats") {
        bornes.push(args);
        return stats;
      }
      if (cmd === "stats_mensuelles") return [];
      return undefined;
    });

    render(<StatsPage />);
    await screen.findByText("1 250 000 FCFA");
    expect(bornes[0]).toEqual({ du: null, au: null });

    await userEvent.type(screen.getByLabelText("Du"), "2026-05-01");

    await screen.findByText(/du 2026-05-01/);
    expect(bornes[bornes.length - 1]).toEqual({ du: "2026-05-01", au: null });
  });
});
