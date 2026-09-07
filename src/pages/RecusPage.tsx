import { useEffect, useMemo, useState } from "react";
import {
  annulerRecu,
  getParametres,
  getRecu,
  listRecusResume,
} from "../api/client";
import { exporterRecusCsv } from "../api/exports";
import { formatMontant } from "../api/money";
import type { Parametres, RecuDetail, RecuResume } from "../api/types";
import { BarreRecherche } from "../components/BarreRecherche";
import { RecuImprimable } from "../components/RecuImprimable";
import { useActionPage } from "../hooks/useActionPage";
import { correspond } from "../utils/recherche";

export function RecusPage() {
  const [recus, setRecus] = useState<RecuResume[]>([]);
  const [params, setParams] = useState<Parametres | null>(null);
  const [apercu, setApercu] = useState<RecuDetail | null>(null);
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const executer = useActionPage(setErreur);
  const [chargement, setChargement] = useState(true);

  const recusFiltres = useMemo(
    () =>
      recus.filter((r) =>
        correspond([r.numero, r.client_nom, r.emis_le.slice(0, 10)], recherche),
      ),
    [recus, recherche],
  );

  async function recharger() {
    setRecus(await listRecusResume());
  }

  useEffect(() => {
    Promise.all([listRecusResume(), getParametres()])
      .then(([r, p]) => {
        setRecus(r);
        setParams(p);
      })
      .catch((e) => setErreur(String(e)))
      .finally(() => setChargement(false));
  }, []);

  const ouvrir = (id: number) =>
    executer(async () => setApercu(await getRecu(id)));

  const annuler = (id: number) =>
    executer(
      async () => {
        await annulerRecu(id);
        await recharger();
      },
      {
        confirmation: "Annuler ce reçu ? Le paiement lié sera annulé.",
        succes: "Reçu annulé",
      },
    );

  const exporterCsv = () =>
    executer(exporterRecusCsv, { succes: "Liste exportée" });

  return (
    <section className="page">
      <header className="page-tete">
        <div>
          <h2>Reçus</h2>
          <p className="page-sous">
            {recusFiltres.length} reçu{recusFiltres.length > 1 ? "s" : ""}
            {recherche && ` sur ${recus.length}`}
          </p>
        </div>
        <div className="page-actions">
          <button onClick={exporterCsv}>Exporter (CSV)</button>
        </div>
      </header>

      {erreur && <p className="erreur">{erreur}</p>}

      <BarreRecherche
        valeur={recherche}
        onChange={setRecherche}
        placeholder="Rechercher un reçu (numéro, client, date)…"
      />

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Client</th>
              <th>Émis le</th>
              <th className="col-montant">Montant</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recusFiltres.map((r) => (
              <tr key={r.id}>
                <td className="cell-fort">
                  {r.numero}
                  {r.annule && (
                    <span className="badge badge-retard">Annulé</span>
                  )}
                </td>
                <td>{r.client_nom}</td>
                <td>{r.emis_le.slice(0, 10)}</td>
                <td className="col-montant">{formatMontant(r.montant)}</td>
                <td className="cell-actions">
                  <button onClick={() => ouvrir(r.id)}>Voir / Imprimer</button>
                  {!r.annule && (
                    <button
                      className="btn-danger"
                      onClick={() => annuler(r.id)}
                    >
                      Annuler
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {recusFiltres.length === 0 && (
              <tr>
                <td colSpan={5} className="vide">
                  {chargement
                    ? "Chargement…"
                    : recus.length === 0
                      ? "Aucun reçu pour le moment."
                      : "Aucun reçu ne correspond à la recherche."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {apercu && (
        <RecuImprimable
          recu={apercu}
          params={params}
          onClose={() => setApercu(null)}
        />
      )}
    </section>
  );
}
