import { useEffect, useMemo, useState } from "react";
import {
  archiverPrestation,
  createPrestation,
  deletePrestation,
  listPrestations,
  updatePrestation,
} from "../api/client";
import { formatMontant, parseMontant } from "../api/money";
import type { Prestation } from "../api/types";
import { BarreRecherche } from "../components/BarreRecherche";
import { useToast } from "../components/toast-context";
import { useActionPage } from "../hooks/useActionPage";
import { correspond } from "../utils/recherche";

export function PrestationsPage() {
  const { showToast } = useToast();
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [libelle, setLibelle] = useState("");
  const [prix, setPrix] = useState("");
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const executer = useActionPage(setErreur);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  // Prestation en cours de modification (null = formulaire d'ajout).
  const [edition, setEdition] = useState<Prestation | null>(null);

  const prestationsFiltrees = useMemo(
    () => prestations.filter((p) => correspond([p.libelle], recherche)),
    [prestations, recherche],
  );

  async function recharger() {
    setPrestations(await listPrestations());
  }

  useEffect(() => {
    recharger()
      .catch((e) => setErreur(String(e)))
      .finally(() => setChargement(false));
  }, []);

  function reinitialiser() {
    setEdition(null);
    setLibelle("");
    setPrix("");
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!libelle.trim()) {
      setErreur("Le libellé est requis.");
      return;
    }
    const montant = parseMontant(prix);
    if (montant === null || montant < 0) {
      setErreur("Prix invalide (ex : 50 000 ou 50.000)");
      return;
    }
    setEnvoi(true);
    try {
      if (edition) {
        // Les factures déjà émises ne bougent pas : leur libellé et leur prix
        // y sont figés (snapshot). Seules les futures factures suivent.
        await updatePrestation({
          ...edition,
          libelle: libelle.trim(),
          prix: montant,
        });
        showToast("Prestation modifiée");
      } else {
        await createPrestation({ libelle: libelle.trim(), prix: montant });
        showToast("Prestation ajoutée");
      }
      reinitialiser();
      await recharger();
    } catch (err) {
      setErreur(String(err));
    } finally {
      setEnvoi(false);
    }
  }

  function modifier(p: Prestation) {
    setErreur(null);
    setEdition(p);
    setLibelle(p.libelle);
    setPrix(String(p.prix));
  }

  const supprimer = (p: Prestation) =>
    executer(
      async () => {
        await deletePrestation(p.id);
        if (edition?.id === p.id) reinitialiser();
        await recharger();
      },
      {
        confirmation: `Supprimer définitivement « ${p.libelle} » ?`,
        succes: "Prestation supprimée",
      },
    );

  /**
   * Archiver retire la prestation des nouvelles factures sans toucher aux
   * factures passées (leur libellé et leur prix y sont figés). C'est la voie à
   * suivre pour une prestation déjà facturée, que la suppression refuse.
   */
  const basculerArchive = (p: Prestation) =>
    executer(
      async () => {
        await archiverPrestation(p.id, !p.actif);
        await recharger();
      },
      { succes: p.actif ? "Prestation archivée" : "Prestation réactivée" },
    );

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

      <form className="carte-form" onSubmit={enregistrer}>
        <h3 className="form-titre">
          {edition ? `Modifier « ${edition.libelle} »` : "Nouvelle prestation"}
        </h3>
        {edition && (
          <p className="aide">
            Le nouveau prix ne s'applique qu'aux prochaines factures : celles
            déjà émises conservent le prix figé à leur création.
          </p>
        )}
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
        <div className="form-pied">
          <button type="submit" className="btn-primary" disabled={envoi}>
            {envoi
              ? "Enregistrement…"
              : edition
                ? "Enregistrer les modifications"
                : "Ajouter la prestation"}
          </button>
          {edition && (
            <button type="button" onClick={reinitialiser}>
              Annuler
            </button>
          )}
        </div>
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
                  <button onClick={() => modifier(p)}>Modifier</button>
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
                  {chargement
                    ? "Chargement…"
                    : prestations.length === 0
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
