import { describe, it, expect } from "vitest";
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
});
