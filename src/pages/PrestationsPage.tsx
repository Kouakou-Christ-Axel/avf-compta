import { useEffect, useState } from "react";
import {
  createPrestation,
  deletePrestation,
  listPrestations,
} from "../api/client";
import { formatEuros, parseEuros } from "../api/money";
import type { Prestation } from "../api/types";

export function PrestationsPage() {
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [libelle, setLibelle] = useState("");
  const [prix, setPrix] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  async function recharger() {
    setPrestations(await listPrestations());
  }

  useEffect(() => {
    recharger().catch((e) => setErreur(String(e)));
  }, []);

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    const cents = parseEuros(prix);
    if (cents === null || cents < 0) {
      setErreur("Prix invalide");
      return;
    }
    try {
      await createPrestation({ libelle, prix_cents: cents });
      setLibelle("");
      setPrix("");
      await recharger();
    } catch (err) {
      setErreur(String(err));
    }
  }

  async function supprimer(id: number) {
    setErreur(null);
    try {
      await deletePrestation(id);
      await recharger();
    } catch (err) {
      setErreur(String(err));
    }
  }

  return (
    <section>
      <h2>Prestations</h2>
      {erreur && <p className="erreur">{erreur}</p>}

      <form className="form-inline" onSubmit={ajouter}>
        <input
          aria-label="Libellé"
          placeholder="Libellé"
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          required
        />
        <input
          aria-label="Prix"
          placeholder="Prix (ex: 150,00)"
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
          required
        />
        <button type="submit">Ajouter</button>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>Libellé</th>
            <th>Prix</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {prestations.map((p) => (
            <tr key={p.id}>
              <td>{p.libelle}</td>
              <td>{formatEuros(p.prix_cents)}</td>
              <td>
                <button onClick={() => supprimer(p.id)}>Supprimer</button>
              </td>
            </tr>
          ))}
          {prestations.length === 0 && (
            <tr>
              <td colSpan={3}>Aucune prestation.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
