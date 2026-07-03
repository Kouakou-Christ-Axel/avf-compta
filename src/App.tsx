import { useState } from "react";
import "./App.css";
import { ClientsPage } from "./pages/ClientsPage";
import { PrestationsPage } from "./pages/PrestationsPage";
import { NotesPage } from "./pages/NotesPage";
import { DepensesPage } from "./pages/DepensesPage";
import { RecusPage } from "./pages/RecusPage";
import { StatsPage } from "./pages/StatsPage";
import { ParametresPage } from "./pages/ParametresPage";
import { ToastProvider } from "./components/ToastProvider";

const ONGLETS = [
  { id: "stats", label: "Tableau de bord", icone: "▱" },
  { id: "clients", label: "Clients", icone: "○" },
  { id: "prestations", label: "Prestations", icone: "◇" },
  { id: "notes", label: "Factures", icone: "▤" },
  { id: "depenses", label: "Dépenses", icone: "▦" },
  { id: "recus", label: "Reçus", icone: "▣" },
  { id: "parametres", label: "Paramètres", icone: "⚙" },
] as const;

type OngletId = (typeof ONGLETS)[number]["id"];

const CLE_SIDEBAR_REPLIEE = "sidebar-repliee";

function App() {
  const [onglet, setOnglet] = useState<OngletId>("stats");
  const [repliee, setRepliee] = useState(
    () => localStorage.getItem(CLE_SIDEBAR_REPLIEE) === "1",
  );

  function basculerSidebar() {
    setRepliee((v) => {
      const suivant = !v;
      localStorage.setItem(CLE_SIDEBAR_REPLIEE, suivant ? "1" : "0");
      return suivant;
    });
  }

  return (
    <ToastProvider>
      <div className="app">
        <aside className={repliee ? "sidebar repliee" : "sidebar"}>
          <div className="marque">
            <span className="marque-logo">A</span>
            {!repliee && <span className="marque-nom">avf-compta</span>}
            <button
              className="sidebar-bascule"
              onClick={basculerSidebar}
              title={repliee ? "Déplier le menu" : "Replier le menu"}
              aria-label={repliee ? "Déplier le menu" : "Replier le menu"}
            >
              {repliee ? "»" : "«"}
            </button>
          </div>
          <nav>
            {ONGLETS.map((o) => (
              <button
                key={o.id}
                className={o.id === onglet ? "nav-item actif" : "nav-item"}
                onClick={() => setOnglet(o.id)}
                title={repliee ? o.label : undefined}
              >
                <span className="nav-icone" aria-hidden>
                  {o.icone}
                </span>
                {!repliee && o.label}
              </button>
            ))}
          </nav>
          {!repliee && <div className="sidebar-pied">Devise : FCFA (XOF)</div>}
        </aside>

        <main className="content">
          {onglet === "stats" && <StatsPage />}
          {onglet === "clients" && <ClientsPage />}
          {onglet === "prestations" && <PrestationsPage />}
          {onglet === "notes" && <NotesPage />}
          {onglet === "depenses" && <DepensesPage />}
          {onglet === "recus" && <RecusPage />}
          {onglet === "parametres" && <ParametresPage />}
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;
