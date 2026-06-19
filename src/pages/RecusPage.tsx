import { useEffect, useState } from "react";
import { listRecus } from "../api/client";
import type { Recu } from "../api/types";

export function RecusPage() {
  const [recus, setRecus] = useState<Recu[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    listRecus()
      .then(setRecus)
      .catch((e) => setErreur(String(e)));
  }, []);

  return (
    <section>
      <h2>Reçus</h2>
      {erreur && <p className="erreur">{erreur}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Numéro</th>
            <th>Émis le</th>
          </tr>
        </thead>
        <tbody>
          {recus.map((r) => (
            <tr key={r.id}>
              <td>{r.numero}</td>
              <td>{r.emis_le.slice(0, 10)}</td>
            </tr>
          ))}
          {recus.length === 0 && (
            <tr>
              <td colSpan={2}>Aucun reçu.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
