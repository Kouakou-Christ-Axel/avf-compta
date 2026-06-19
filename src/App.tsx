import { useState } from "react";
import "./App.css";
import { ClientsPage } from "./pages/ClientsPage";
import { PrestationsPage } from "./pages/PrestationsPage";
import { NotesPage } from "./pages/NotesPage";
import { RecusPage } from "./pages/RecusPage";
import { StatsPage } from "./pages/StatsPage";

const ONGLETS = [
  { id: "stats", label: "Tableau de bord" },
  { id: "clients", label: "Clients" },
  { id: "prestations", label: "Prestations" },
  { id: "notes", label: "Notes de frais" },
  { id: "recus", label: "Reçus" },
] as const;

type OngletId = (typeof ONGLETS)[number]["id"];

function App() {
  const [onglet, setOnglet] = useState<OngletId>("stats");

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">avf-compta</h1>
      </header>
      <div className="layout">
        <nav className="sidebar">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              className={o.id === onglet ? "nav-item actif" : "nav-item"}
              onClick={() => setOnglet(o.id)}
            >
              {o.label}
            </button>
          ))}
        </nav>
        <main className="content">
          {onglet === "stats" && <StatsPage />}
          {onglet === "clients" && <ClientsPage />}
          {onglet === "prestations" && <PrestationsPage />}
          {onglet === "notes" && <NotesPage />}
          {onglet === "recus" && <RecusPage />}
        </main>
      </div>
    </div>
  );
}

export default App;
