import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { resumeStats, statsMensuelles } from "../api/client";
import { formatMontant } from "../api/money";
import type { ResumeStats, StatMois } from "../api/types";

export function StatsPage() {
  const [stats, setStats] = useState<ResumeStats | null>(null);
  const [mensuelles, setMensuelles] = useState<StatMois[]>([]);
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([resumeStats(), statsMensuelles()])
      .then(([resume, mois]) => {
        setStats(resume);
        setMensuelles(mois);
      })
      .catch((e) => setErreur(String(e)));
  }, []);

  const serie = useMemo(() => {
    const debut = du.slice(0, 7);
    const fin = au.slice(0, 7);
    return mensuelles.filter(
      (point) =>
        (du === "" || point.mois >= debut) && (au === "" || point.mois <= fin),
    );
  }, [mensuelles, du, au]);

  if (erreur) return <p className="erreur">{erreur}</p>;
  if (!stats) return <p className="aide">Chargement…</p>;

  const cartes = [
    { label: "Clients", valeur: String(stats.nb_clients), ton: "neutre" },
    { label: "Factures", valeur: String(stats.nb_notes), ton: "neutre" },
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

      <div className="carte-form">
        <h3 className="form-titre">Période</h3>
        <div className="champs">
          <label>
            Du
            <input
              type="date"
              value={du}
              onChange={(e) => setDu(e.target.value)}
            />
          </label>
          <label>
            Au
            <input
              type="date"
              value={au}
              onChange={(e) => setAu(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="carte-form">
        <h3 className="form-titre">Chiffre d'affaires mensuel</h3>
        {serie.length === 0 ? (
          <p className="aide">Aucune donnée sur la période.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mois" />
              <YAxis
                width={80}
                tickFormatter={(v) => formatMontant(Number(v))}
              />
              <Tooltip formatter={(v) => formatMontant(Number(v))} />
              <Line
                type="monotone"
                dataKey="ca"
                stroke="#2563eb"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="carte-form">
        <h3 className="form-titre">Dépenses mensuelles</h3>
        {serie.length === 0 ? (
          <p className="aide">Aucune donnée sur la période.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mois" />
              <YAxis
                width={80}
                tickFormatter={(v) => formatMontant(Number(v))}
              />
              <Tooltip formatter={(v) => formatMontant(Number(v))} />
              <Line
                type="monotone"
                dataKey="depenses"
                stroke="#dc2626"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="carte-form">
        <h3 className="form-titre">Marge mensuelle</h3>
        {serie.length === 0 ? (
          <p className="aide">Aucune donnée sur la période.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mois" />
              <YAxis
                width={80}
                tickFormatter={(v) => formatMontant(Number(v))}
              />
              <Tooltip formatter={(v) => formatMontant(Number(v))} />
              <Bar dataKey="marge" fill="#15803d" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
