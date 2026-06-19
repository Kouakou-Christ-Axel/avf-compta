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
      total_facture_cents: 123456,
      total_encaisse_cents: 100000,
      total_impaye_cents: 23456,
    };
    mockIPC((cmd) => (cmd === "resume_stats" ? stats : undefined));

    render(<StatsPage />);

    expect(await screen.findByText("1 234,56 €")).toBeInTheDocument();
    expect(screen.getByText("Total impayé")).toBeInTheDocument();
    expect(screen.getByText("234,56 €")).toBeInTheDocument();
  });
});
