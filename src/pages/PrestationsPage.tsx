import { useEffect, useMemo, useState } from "react";
import {
  archiverPrestation,
  createPrestation,
  deletePrestation,
  listPrestations,
} from "../api/client";
import { formatMontant, parseMontant } from "../api/money";
import type { Prestation } from "../api/types";
import { BarreRecherche } from "../components/BarreRecherche";
import { useToast } from "../components/toast-context";
import { correspond } from "../utils/recherche";

export function PrestationsPage() {
  const { showToast } = useToast();
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [libelle, setLibelle] = useState("");
  const [prix, setPrix] = useState("");
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const prestationsFiltrees = useMemo(
    () => prestations.filter((p) => correspond([p.libelle], recherche)),
    [prestations, recherche],
  );

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
      showToast("Prestation ajoutée");
    } catch (err) {
      setErreur(String(err));
    }
  }

  async function supprimer(p: Prestation) {
    if (!confirm(`Supprimer définitivement « ${p.libelle} » ?`)) return;
    setErreur(null);
    try {
      await deletePrestation(p.id);
      await recharger();
      showToast("Prestation supprimée");
    } catch (err) {
      setErreur(String(err));
    }
  }

  /**
   * Archiver retire la prestation des nouvelles factures sans toucher aux
   * factures passées (leur libellé et leur prix y sont figés). C'est la voie à
   * suivre pour une prestation déjà facturée, que la suppression refuse.
   */
  async function basculerArchive(p: Prestation) {
    setErreur(null);
    try {
      await archiverPrestation(p.id, !p.actif);
      await recharger();
      showToast(p.actif ? "Prestation archivée" : "Prestation réactivée");
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
            {prestationsFiltrees.length} prestation
            {prestationsFiltrees.length > 1 ? "s" : ""}
            {recherche && ` sur ${prestations.length}`}
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

      <BarreRecherche
        valeur={recherche}
        onChange={setRecherche}
        placeholder="Rechercher une prestation…"
      />

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
            {prestationsFiltrees.map((p) => (
              <tr key={p.id} className={p.actif ? undefined : "ligne-archivee"}>
                <td className="cell-fort">
                  {p.libelle}
                  {!p.actif && (
                    <span className="badge badge-archive">Archivée</span>
                  )}
                </td>
                <td className="col-montant">{formatMontant(p.prix)}</td>
                <td className="cell-actions">
                  <button onClick={() => basculerArchive(p)}>
                    {p.actif ? "Archiver" : "Réactiver"}
                  </button>
                  <button className="btn-danger" onClick={() => supprimer(p)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {prestationsFiltrees.length === 0 && (
              <tr>
                <td colSpan={3} className="vide">
                  {prestations.length === 0
                    ? "Aucune prestation pour le moment."
                    : "Aucune prestation ne correspond à la recherche."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
