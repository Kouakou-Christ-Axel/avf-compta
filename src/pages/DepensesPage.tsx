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

export function DepensesPage() {
  const { showToast } = useToast();
  const [depenses, setDepenses] = useState<DepenseLigne[]>([]);
  const [notes, setNotes] = useState<NoteResume[]>([]);
  const [clients, setClients] = useState<ClientResume[]>([]);
  const [noteId, setNoteId] = useState("");
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const depensesFiltrees = useMemo(
    () =>
      depenses.filter((d) =>
        correspond(
          [d.libelle, d.note_reference ?? `#${d.note_id}`, d.date_depense],
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
      .catch((e) => setErreur(String(e)));
  }, []);

  const nomClient = new Map(clients.map((c) => [c.id, c.nom]));

  function libelleNote(n: NoteResume): string {
    return `${n.reference ?? "#" + n.id} — ${nomClient.get(n.client_id) ?? "Client"}`;
  }

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    const id = Number(noteId);
    if (!noteId || Number.isNaN(id)) {
      setErreur("Sélectionnez une note");
      return;
    }
    if (libelle.trim() === "") {
      setErreur("Libellé requis");
      return;
    }
    const valeur = parseMontant(montant);
    if (valeur === null || valeur <= 0) {
      setErreur("Montant invalide");
      return;
    }
    try {
      await createDepense({
        note_id: id,
        libelle,
        montant: valeur,
        date_depense: date,
      });
      setLibelle("");
      setMontant("");
      await recharger();
      showToast("Dépense ajoutée");
    } catch (err) {
      setErreur(String(err));
    }
  }

  async function supprimer(id: number) {
    setErreur(null);
    try {
      await deleteDepense(id);
      await recharger();
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
            <span>Facture</span>
            <select
              value={noteId}
              onChange={(e) => setNoteId(e.target.value)}
              required
            >
              <option value="">— Sélectionner —</option>
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
        <button type="submit" className="btn-primary">
          Ajouter la dépense
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
                <td className="cell-fort">
                  {d.note_reference ?? `#${d.note_id}`}
                </td>
                <td>{d.libelle}</td>
                <td className="col-montant">{formatMontant(d.montant)}</td>
                <td>{d.date_depense}</td>
                <td className="cell-actions">
                  <button
                    className="btn-danger"
                    onClick={() => supprimer(d.id)}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {depensesFiltrees.length === 0 && (
              <tr>
                <td colSpan={5} className="vide">
                  {depenses.length === 0
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
