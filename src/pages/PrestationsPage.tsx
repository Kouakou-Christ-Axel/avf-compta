import { useEffect, useState } from "react";
import {
  createPrestation,
  deletePrestation,
  listPrestations,
} from "../api/client";
import { formatMontant, parseMontant } from "../api/money";
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
    const montant = parseMontant(prix);
    if (montant === null || montant < 0) {
      setErreur("Prix invalide");
      return;
    }
    try {
      await createPrestation({ libelle, prix: montant });
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
    <section className="page">
      <header className="page-tete">
        <div>
          <h2>Prestations</h2>
          <p className="page-sous">
            {prestations.length} prestation{prestations.length > 1 ? "s" : ""}
          </p>
        </div>
      </header>

      {erreur && <p className="erreur">{erreur}</p>}

      <form className="carte-form" onSubmit={ajouter}>
        <div className="champs">
          <label>
            <span>Libellé</span>
            <input
              placeholder="Ex : Bilan annuel"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Prix (FCFA)</span>
            <input
              inputMode="numeric"
              placeholder="Ex : 150 000"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              required
            />
          </label>
        </div>
        <button type="submit" className="btn-primary">
          Ajouter la prestation
        </button>
      </form>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Libellé</th>
              <th className="col-montant">Prix</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {prestations.map((p) => (
              <tr key={p.id}>
                <td className="cell-fort">{p.libelle}</td>
                <td className="col-montant">{formatMontant(p.prix)}</td>
                <td className="cell-actions">
                  <button
                    className="btn-danger"
                    onClick={() => supprimer(p.id)}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {prestations.length === 0 && (
              <tr>
                <td colSpan={3} className="vide">
                  Aucune prestation pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
