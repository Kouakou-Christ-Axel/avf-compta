import { useEffect, useState } from "react";
import { createClient, deleteClient, listClients } from "../api/client";
import type { Client } from "../api/types";

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  async function recharger() {
    setClients(await listClients());
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
    <section>
      <h2>Clients</h2>
      {erreur && <p className="erreur">{erreur}</p>}

      <form className="form-inline" onSubmit={ajouter}>
        <input
          aria-label="Nom"
          placeholder="Nom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
        />
        <input
          aria-label="Email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          aria-label="Téléphone"
          placeholder="Téléphone"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
        />
        <button type="submit">Ajouter</button>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Email</th>
            <th>Téléphone</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id}>
              <td>{c.nom}</td>
              <td>{c.email ?? "—"}</td>
              <td>{c.telephone ?? "—"}</td>
              <td>
                <button onClick={() => supprimer(c.id)}>Supprimer</button>
              </td>
            </tr>
          ))}
          {clients.length === 0 && (
            <tr>
              <td colSpan={4}>Aucun client.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
