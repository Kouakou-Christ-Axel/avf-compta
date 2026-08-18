import { useEffect, useMemo, useState } from "react";
import {
  createDepense,
  deleteDepense,
  listAllDepenses,
  listClientsResume,
  listNotesResume,
} from "../api/client";
import { exporterDepensesCsv } from "../api/exports";
import { formatMontant, parseMontant } from "../api/money";
import type { ClientResume, DepenseLigne, NoteResume } from "../api/types";
import { BarreRecherche } from "../components/BarreRecherche";
import { useToast } from "../components/toast-context";
import { correspond } from "../utils/recherche";

/** Facture de rattachement d'une dépense, ou sa nature si elle n'en a pas. */
function libelleRattachement(d: DepenseLigne): string {
  if (d.note_id === null) return "Charge du cabinet";
  return d.note_reference ?? `#${d.note_id}`;
}

/** Date du jour au format ISO, relue à chaque appel. */
function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DepensesPage() {
  const { showToast } = useToast();
  const [depenses, setDepenses] = useState<DepenseLigne[]>([]);
  const [notes, setNotes] = useState<NoteResume[]>([]);
  const [clients, setClients] = useState<ClientResume[]>([]);
  const [noteId, setNoteId] = useState("");
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(aujourdhui);
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);

  const depensesFiltrees = useMemo(
    () =>
      depenses.filter((d) =>
        correspond(
          [d.libelle, libelleRattachement(d), d.date_depense],
          recherche,
        ),
      ),
    [depenses, recherche],
  );

  async function recharger() {
    setDepenses(await listAllDepenses());
  }

  useEffect(() => {
    Promise.all([listNotesResume(), listClientsResume(), listAllDepenses()])
      .then(([n, c, d]) => {
        setNotes(n);
        setClients(c);
        setDepenses(d);
      })
      .catch((e) => setErreur(String(e)))
      .finally(() => setChargement(false));
  }, []);

  const nomClient = new Map(clients.map((c) => [c.id, c.nom]));

  function libelleNote(n: NoteResume): string {
    return `${n.reference ?? "#" + n.id} — ${nomClient.get(n.client_id) ?? "Client"}`;
  }

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    // `noteId` vide = charge générale du cabinet (loyer, carburant…), qui
    // n'entre dans la marge d'aucun client.
    const id = noteId === "" ? null : Number(noteId);
    if (id !== null && Number.isNaN(id)) {
      setErreur("Facture invalide");
      return;
    }
    if (libelle.trim() === "") {
      setErreur("Libellé requis");
      return;
    }
    const valeur = parseMontant(montant);
    if (valeur === null || valeur <= 0) {
      setErreur("Montant invalide (ex : 5 000 ou 5.000)");
      return;
    }
    if (!date) {
      setErreur("Date requise");
      return;
    }
    setEnvoi(true);
    try {
      await createDepense({
        note_id: id,
        libelle: libelle.trim(),
        montant: valeur,
        date_depense: date,
      });
      setLibelle("");
      setMontant("");
      // La date par défaut était figée au chargement de la page : rouverte
      // le lendemain, elle datait les nouvelles dépenses de la veille.
      setDate(aujourdhui());
      await recharger();
      showToast("Dépense ajoutée");
    } catch (err) {
      setErreur(String(err));
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer(d: DepenseLigne) {
    if (!confirm(`Supprimer la dépense « ${d.libelle} » ?`)) return;
    setErreur(null);
    try {
      await deleteDepense(d.id);
      await recharger();
      showToast("Dépense supprimée");
    } catch (err) {
      setErreur(String(err));
    }
  }

  async function exporter() {
    setErreur(null);
    try {
      if (await exporterDepensesCsv()) showToast("Dépenses exportées");
    } catch (err) {
      setErreur(String(err));
    }
  }

  const total = depensesFiltrees.reduce((acc, d) => acc + d.montant, 0);

  return (
    <section className="page">
      <header className="page-tete">
        <div>
          <h2>Dépenses</h2>
          <p className="page-sous">
            {depensesFiltrees.length} dépense
            {depensesFiltrees.length > 1 ? "s" : ""}
            {recherche && ` sur ${depenses.length}`}
          </p>
        </div>
        <div className="page-actions">
          <button onClick={exporter}>Exporter (CSV)</button>
        </div>
      </header>

      {erreur && <p className="erreur">{erreur}</p>}

      <form className="carte-form" onSubmit={ajouter}>
        <div className="champs">
          <label>
            <span>Facture (facultatif)</span>
            <select value={noteId} onChange={(e) => setNoteId(e.target.value)}>
              <option value="">Charge générale du cabinet</option>
              {notes.map((n) => (
                <option key={n.id} value={n.id}>
                  {libelleNote(n)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Libellé</span>
            <input
              placeholder="Ex : Frais de déplacement"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Montant (FCFA)</span>
            <input
              inputMode="numeric"
              placeholder="Ex : 25 000"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
        </div>
        <button type="submit" className="btn-primary" disabled={envoi}>
          {envoi ? "Ajout…" : "Ajouter la dépense"}
        </button>
      </form>

      <BarreRecherche
        valeur={recherche}
        onChange={setRecherche}
        placeholder="Rechercher une dépense (libellé, facture, date)…"
      />

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Facture</th>
              <th>Libellé</th>
              <th className="col-montant">Montant</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {depensesFiltrees.map((d) => (
              <tr key={d.id}>
                <td className="cell-fort">{libelleRattachement(d)}</td>
                <td>{d.libelle}</td>
                <td className="col-montant">{formatMontant(d.montant)}</td>
                <td>{d.date_depense}</td>
                <td className="cell-actions">
                  <button className="btn-danger" onClick={() => supprimer(d)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {depensesFiltrees.length === 0 && (
              <tr>
                <td colSpan={5} className="vide">
                  {chargement
                    ? "Chargement…"
                    : depenses.length === 0
                      ? "Aucune dépense pour le moment."
                      : "Aucune dépense ne correspond à la recherche."}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="cell-fort" colSpan={2}>
                Total
              </td>
              <td className="col-montant">{formatMontant(total)}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
