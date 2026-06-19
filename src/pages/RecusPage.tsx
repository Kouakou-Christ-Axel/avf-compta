import { useEffect, useState } from "react";
import { getParametres, getRecu, listRecus } from "../api/client";
import { exportRecuPdf, type FormatPage } from "../api/pdf";
import type { Parametres, Recu, RecuDetail } from "../api/types";
import { RecuImprimable } from "../components/RecuImprimable";
import { useToast } from "../components/toast-context";

export function RecusPage() {
  const { showToast } = useToast();
  const [recus, setRecus] = useState<Recu[]>([]);
  const [params, setParams] = useState<Parametres | null>(null);
  const [apercu, setApercu] = useState<RecuDetail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listRecus(), getParametres()])
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

  async function exporter(id: number, format: FormatPage) {
    setErreur(null);
    try {
      const detail = await getRecu(id);
      const ok = await exportRecuPdf(detail, params, format);
      if (ok) showToast(`PDF (${format}) enregistré`);
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
      </header>

      {erreur && <p className="erreur">{erreur}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Émis le</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recus.map((r) => (
              <tr key={r.id}>
                <td className="cell-fort">{r.numero}</td>
                <td>{r.emis_le.slice(0, 10)}</td>
                <td className="cell-actions">
                  <button onClick={() => ouvrir(r.id)}>Voir</button>
                  <button onClick={() => exporter(r.id, "A4")}>PDF A4</button>
                  <button onClick={() => exporter(r.id, "A5")}>PDF A5</button>
                </td>
              </tr>
            ))}
            {recus.length === 0 && (
              <tr>
                <td colSpan={3} className="vide">
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
