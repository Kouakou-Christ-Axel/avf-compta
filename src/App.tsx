import { useState } from "react";
import "./App.css";
import { ClientsPage } from "./pages/ClientsPage";
import { PrestationsPage } from "./pages/PrestationsPage";
import { NotesPage } from "./pages/NotesPage";
import { RecusPage } from "./pages/RecusPage";
import { StatsPage } from "./pages/StatsPage";
import { ParametresPage } from "./pages/ParametresPage";
import { ToastProvider } from "./components/ToastProvider";

const ONGLETS = [
  { id: "stats", label: "Tableau de bord", icone: "▱" },
  { id: "clients", label: "Clients", icone: "○" },
  { id: "prestations", label: "Prestations", icone: "◇" },
  { id: "notes", label: "Notes de frais", icone: "▤" },
  { id: "recus", label: "Reçus", icone: "▣" },
  { id: "parametres", label: "Paramètres", icone: "⚙" },
] as const;

type OngletId = (typeof ONGLETS)[number]["id"];

function App() {
  const [onglet, setOnglet] = useState<OngletId>("stats");

  return (
    <ToastProvider>
      <div className="app">
        <aside className="sidebar">
          <div className="marque">
            <span className="marque-logo">A</span>
            <span className="marque-nom">avf-compta</span>
          </div>
          <nav>
            {ONGLETS.map((o) => (
              <button
                key={o.id}
                className={o.id === onglet ? "nav-item actif" : "nav-item"}
                onClick={() => setOnglet(o.id)}
              >
                <span className="nav-icone" aria-hidden>
                  {o.icone}
                </span>
                {o.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-pied">Devise : FCFA (XOF)</div>
        </aside>

        <main className="content">
          {onglet === "stats" && <StatsPage />}
          {onglet === "clients" && <ClientsPage />}
          {onglet === "prestations" && <PrestationsPage />}
          {onglet === "notes" && <NotesPage />}
          {onglet === "recus" && <RecusPage />}
          {onglet === "parametres" && <ParametresPage />}
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;
