import { useEffect, useState } from "react";
import { createClient, deleteClient, listClientsResume } from "../api/client";
import type { ClientResume } from "../api/types";
import { formatMontant } from "../api/money";
import { CopyText } from "../components/CopyText";

export function ClientsPage() {
  const [clients, setClients] = useState<ClientResume[]>([]);
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  async function recharger() {
    setClients(await listClientsResume());
  }

  useEffect(() => {
    recharger().catch((e) => setErreur(String(e)));
  }, []);

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    try {
      await createClient({
        nom,
        email: email || null,
        telephone: telephone || null,
        adresse: null,
      });
      setNom("");
      setEmail("");
      setTelephone("");
      await recharger();
    } catch (err) {
      setErreur(String(err));
    }
  }

  async function supprimer(id: number) {
    setErreur(null);
    try {
      await deleteClient(id);
      await recharger();
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
            {clients.length} client{clients.length > 1 ? "s" : ""}
          </p>
        </div>
      </header>

      {erreur && <p className="erreur">{erreur}</p>}

      <form className="carte-form" onSubmit={ajouter}>
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
        <button type="submit" className="btn-primary">
          Ajouter le client
        </button>
      </form>

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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td className="cell-fort">{c.nom}</td>
                <td>{c.email ? <CopyText value={c.email} /> : "—"}</td>
                <td>{c.telephone ? <CopyText value={c.telephone} /> : "—"}</td>
                <td className="col-montant">
                  {formatMontant(c.total_facture)}
                </td>
                <td className="col-montant">{formatMontant(c.total_paye)}</td>
                <td className="col-montant">{formatMontant(c.solde)}</td>
                <td className="cell-actions">
                  <button
                    className="btn-danger"
                    onClick={() => supprimer(c.id)}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={7} className="vide">
                  Aucun client pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
