import { useEffect, useState } from "react";
import { resumeStats } from "../api/client";
import { formatEuros } from "../api/money";
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
  if (!stats) return <p>Chargement…</p>;

  const cartes = [
    { label: "Clients", valeur: String(stats.nb_clients) },
    { label: "Notes de frais", valeur: String(stats.nb_notes) },
    { label: "Total facturé", valeur: formatEuros(stats.total_facture_cents) },
    {
      label: "Total encaissé",
      valeur: formatEuros(stats.total_encaisse_cents),
    },
    { label: "Total impayé", valeur: formatEuros(stats.total_impaye_cents) },
  ];

  return (
    <section>
      <h2>Tableau de bord</h2>
      <div className="cartes">
        {cartes.map((c) => (
          <div className="carte" key={c.label}>
            <span className="carte-label">{c.label}</span>
            <span className="carte-valeur">{c.valeur}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
