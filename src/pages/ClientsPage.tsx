import { useEffect, useMemo, useState } from "react";
import {
  createClient,
  deleteClient,
  getClient,
  listClientsResume,
  updateClient,
} from "../api/client";
import {
  exporterClientsCsv,
  importerClientsCsv,
  telechargerModeleClients,
} from "../api/exports";
import type { Client, ClientResume } from "../api/types";
import { formatMontant } from "../api/money";
import { CopyText } from "../components/CopyText";
import { BarreRecherche } from "../components/BarreRecherche";
import { useToast } from "../components/toast-context";
import { correspond } from "../utils/recherche";

export function ClientsPage() {
  const { showToast } = useToast();
  const [clients, setClients] = useState<ClientResume[]>([]);
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  // Client en cours de modification (null = formulaire d'ajout).
  const [edition, setEdition] = useState<Client | null>(null);

  const clientsFiltres = useMemo(
    () =>
      clients.filter((c) =>
        correspond([c.nom, c.email, c.telephone], recherche),
      ),
    [clients, recherche],
  );

  async function recharger() {
    setClients(await listClientsResume());
  }

  useEffect(() => {
    recharger()
      .catch((e) => setErreur(String(e)))
      .finally(() => setChargement(false));
  }, []);

  function reinitialiser() {
    setEdition(null);
    setNom("");
    setEmail("");
    setTelephone("");
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!nom.trim()) {
      setErreur("Le nom du client est requis.");
      return;
    }
    setEnvoi(true);
    try {
      if (edition) {
        // `adresse` n'est pas exposée par la liste : on repart de la fiche
        // complète pour ne pas l'effacer au passage.
        await updateClient({
          ...edition,
          nom: nom.trim(),
          email: email || null,
          telephone: telephone || null,
        });
        showToast("Client modifié");
      } else {
        await createClient({
          nom: nom.trim(),
          email: email || null,
          telephone: telephone || null,
          adresse: null,
        });
        showToast("Client ajouté");
      }
      reinitialiser();
      await recharger();
    } catch (err) {
      setErreur(String(err));
    } finally {
      setEnvoi(false);
    }
  }

  async function modifier(c: ClientResume) {
    setErreur(null);
    try {
      const fiche = await getClient(c.id);
      setEdition(fiche);
      setNom(fiche.nom);
      setEmail(fiche.email ?? "");
      setTelephone(fiche.telephone ?? "");
    } catch (err) {
      setErreur(String(err));
    }
  }

  async function supprimer(c: ClientResume) {
    if (!confirm(`Supprimer définitivement « ${c.nom} » ?`)) return;
    setErreur(null);
    try {
      await deleteClient(c.id);
      if (edition?.id === c.id) reinitialiser();
      await recharger();
      showToast("Client supprimé");
    } catch (err) {
      setErreur(String(err));
    }
  }

  async function importer() {
    setErreur(null);
    try {
      const n = await importerClientsCsv();
      if (n !== null) {
        await recharger();
        showToast(`${n} client(s) importé(s)`);
      }
    } catch (err) {
      setErreur(String(err));
    }
  }

  async function exporter() {
    setErreur(null);
    try {
      if (await exporterClientsCsv()) showToast("Liste exportée");
    } catch (err) {
      setErreur(String(err));
    }
  }

  async function modele() {
    setErreur(null);
    try {
      if (await telechargerModeleClients()) showToast("Modèle enregistré");
    } catch (err) {
      setErreur(String(err));
    }
  }

  return (
    <section className="page">
      <header className="page-tete">
        <div>
          <h2>Clients</h2>
          <p className="page-sous">
            {clientsFiltres.length} client{clientsFiltres.length > 1 ? "s" : ""}
            {recherche && ` sur ${clients.length}`}
          </p>
        </div>
        <div className="page-actions">
          <button onClick={importer}>Importer (CSV)</button>
          <button onClick={modele}>Modèle</button>
          <button onClick={exporter}>Exporter (CSV)</button>
        </div>
      </header>

      {erreur && <p className="erreur">{erreur}</p>}

      <form className="carte-form" onSubmit={enregistrer}>
        <h3 className="form-titre">
          {edition ? `Modifier « ${edition.nom} »` : "Nouveau client"}
        </h3>
        <div className="champs">
          <label>
            <span>Nom</span>
            <input
              placeholder="Nom du client"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              placeholder="email@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            <span>Téléphone</span>
            <input
              placeholder="01 02 03 04 05"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
            />
          </label>
        </div>
        <div className="form-pied">
          <button type="submit" className="btn-primary" disabled={envoi}>
            {envoi
              ? "Enregistrement…"
              : edition
                ? "Enregistrer les modifications"
                : "Ajouter le client"}
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
        placeholder="Rechercher un client (nom, email, téléphone)…"
      />

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th className="col-montant">Montant</th>
              <th className="col-montant">Payé</th>
              <th className="col-montant">Restant</th>
              <th className="col-montant">Marge</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clientsFiltres.map((c) => (
              <tr key={c.id}>
                <td className="cell-fort">{c.nom}</td>
                <td>{c.email ? <CopyText value={c.email} /> : "—"}</td>
                <td>{c.telephone ? <CopyText value={c.telephone} /> : "—"}</td>
                <td className="col-montant">
                  {formatMontant(c.total_facture)}
                </td>
                <td className="col-montant">{formatMontant(c.total_paye)}</td>
                <td className="col-montant">{formatMontant(c.solde)}</td>
                <td className="col-montant">{formatMontant(c.marge)}</td>
                <td className="cell-actions">
                  <button onClick={() => modifier(c)}>Modifier</button>
                  <button className="btn-danger" onClick={() => supprimer(c)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {clientsFiltres.length === 0 && (
              <tr>
                <td colSpan={8} className="vide">
                  {chargement
                    ? "Chargement…"
                    : clients.length === 0
                      ? "Aucun client pour le moment."
                      : "Aucun client ne correspond à la recherche."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
