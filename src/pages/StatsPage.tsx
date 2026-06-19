import { useEffect, useState } from "react";
import { resumeStats } from "../api/client";
import { formatMontant } from "../api/money";
import type { ResumeStats } from "../api/types";

export function StatsPage() {
  const [stats, setStats] = useState<ResumeStats | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    resumeStats()
      .then(setStats)
      .catch((e) => setErreur(String(e)));
  }, []);

  if (erreur) return <p className="erreur">{erreur}</p>;
  if (!stats) return <p className="aide">Chargement…</p>;

  const cartes = [
    { label: "Clients", valeur: String(stats.nb_clients), ton: "neutre" },
    { label: "Notes de frais", valeur: String(stats.nb_notes), ton: "neutre" },
    {
      label: "Total facturé",
      valeur: formatMontant(stats.total_facture),
      ton: "info",
    },
    {
      label: "Total encaissé",
      valeur: formatMontant(stats.total_encaisse),
      ton: "ok",
    },
    {
      label: "Total impayé",
      valeur: formatMontant(stats.total_impaye),
      ton: "alerte",
    },
  ];

  return (
    <section className="page">
      <header className="page-tete">
        <div>
          <h2>Tableau de bord</h2>
          <p className="page-sous">Vue d'ensemble du cabinet</p>
        </div>
      </header>

      <div className="cartes">
        {cartes.map((c) => (
          <div className={`carte carte-${c.ton}`} key={c.label}>
            <span className="carte-label">{c.label}</span>
            <span className="carte-valeur">{c.valeur}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
