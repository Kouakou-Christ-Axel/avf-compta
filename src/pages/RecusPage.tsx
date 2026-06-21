import { useEffect, useState } from "react";
import {
  annulerRecu,
  getParametres,
  getRecu,
  listRecusResume,
} from "../api/client";
import { exporterRecusCsv } from "../api/exports";
import { formatMontant } from "../api/money";
import type { Parametres, RecuDetail, RecuResume } from "../api/types";
import { RecuImprimable } from "../components/RecuImprimable";
import { useToast } from "../components/toast-context";

export function RecusPage() {
  const { showToast } = useToast();
  const [recus, setRecus] = useState<RecuResume[]>([]);
  const [params, setParams] = useState<Parametres | null>(null);
  const [apercu, setApercu] = useState<RecuDetail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function recharger() {
    setRecus(await listRecusResume());
  }

  useEffect(() => {
    Promise.all([listRecusResume(), getParametres()])
      .then(([r, p]) => {
        setRecus(r);
        setParams(p);
      })
      .catch((e) => setErreur(String(e)));
  }, []);

  async function ouvrir(id: number) {
    setErreur(null);
    try {
      setApercu(await getRecu(id));
    } catch (e) {
      setErreur(String(e));
    }
  }

  async function annuler(id: number) {
    if (!confirm("Annuler ce reçu ? Le paiement lié sera annulé.")) return;
    setErreur(null);
    try {
      await annulerRecu(id);
      await recharger();
      showToast("Reçu annulé");
    } catch (e) {
      setErreur(String(e));
    }
  }

  async function exporterCsv() {
    setErreur(null);
    try {
      if (await exporterRecusCsv()) showToast("Liste exportée");
    } catch (e) {
      setErreur(String(e));
    }
  }

  return (
    <section className="page">
      <header className="page-tete">
        <div>
          <h2>Reçus</h2>
          <p className="page-sous">
            {recus.length} reçu{recus.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="page-actions">
          <button onClick={exporterCsv}>Exporter (CSV)</button>
        </div>
      </header>

      {erreur && <p className="erreur">{erreur}</p>}

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
            {recus.map((r) => (
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
            {recus.length === 0 && (
              <tr>
                <td colSpan={5} className="vide">
                  Aucun reçu pour le moment.
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
