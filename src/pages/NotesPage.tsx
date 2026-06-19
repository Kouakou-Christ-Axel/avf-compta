import { useEffect, useState } from "react";
import {
  createNote,
  enregistrerPaiement,
  genererRecu,
  getNote,
  listClients,
  listNotes,
  listPaiements,
  listPrestations,
  soldeNote,
} from "../api/client";
import { formatEuros, parseEuros } from "../api/money";
import type {
  Client,
  NewNoteLigne,
  NoteDeFrais,
  NoteDetail,
  Paiement,
  Prestation,
  SoldeNote,
} from "../api/types";

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NotesPage() {
  const [notes, setNotes] = useState<NoteDeFrais[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [selection, setSelection] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Formulaire de création.
  const [clientId, setClientId] = useState("");
  const [reference, setReference] = useState("");
  const [lignes, setLignes] = useState<NewNoteLigne[]>([]);

  async function rechargerNotes() {
    setNotes(await listNotes());
  }

  useEffect(() => {
    Promise.all([listNotes(), listClients(), listPrestations()])
      .then(([n, c, p]) => {
        setNotes(n);
        setClients(c);
        setPrestations(p);
      })
      .catch((e) => setErreur(String(e)));
  }, []);

  function ajouterLigne(prestationId: number) {
    setLignes((ls) => {
      const existe = ls.find((l) => l.prestation_id === prestationId);
      if (existe) {
        return ls.map((l) =>
          l.prestation_id === prestationId
            ? { ...l, quantite: l.quantite + 1 }
            : l,
        );
      }
      return [...ls, { prestation_id: prestationId, quantite: 1 }];
    });
  }

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!clientId || lignes.length === 0) {
      setErreur("Sélectionnez un client et au moins une prestation.");
      return;
    }
    try {
      await createNote({
        client_id: Number(clientId),
        reference: reference || null,
        date_emission: aujourdhui(),
        lignes,
      });
      setClientId("");
      setReference("");
      setLignes([]);
      await rechargerNotes();
    } catch (err) {
      setErreur(String(err));
    }
  }

  const totalApercu = lignes.reduce((acc, l) => {
    const p = prestations.find((pr) => pr.id === l.prestation_id);
    return acc + (p ? p.prix_cents * l.quantite : 0);
  }, 0);

  return (
    <section>
      <h2>Notes de frais</h2>
      {erreur && <p className="erreur">{erreur}</p>}

      <form className="form-bloc" onSubmit={creer}>
        <h3>Nouvelle note</h3>
        <div className="form-inline">
          <select
            aria-label="Client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">— Client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
          <input
            aria-label="Référence"
            placeholder="Référence"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>

        <div className="form-inline">
          {prestations.map((p) => (
            <button type="button" key={p.id} onClick={() => ajouterLigne(p.id)}>
              + {p.libelle} ({formatEuros(p.prix_cents)})
            </button>
          ))}
        </div>

        {lignes.length > 0 && (
          <ul className="lignes">
            {lignes.map((l) => {
              const p = prestations.find((pr) => pr.id === l.prestation_id);
              return (
                <li key={l.prestation_id}>
                  {p?.libelle} × {l.quantite} ={" "}
                  {formatEuros((p?.prix_cents ?? 0) * l.quantite)}
                </li>
              );
            })}
          </ul>
        )}
        <p>
          <strong>Total : {formatEuros(totalApercu)}</strong>
        </p>
        <button type="submit">Créer la note</button>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>Réf.</th>
            <th>Date</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {notes.map((n) => (
            <tr key={n.id}>
              <td>{n.reference ?? `#${n.id}`}</td>
              <td>{n.date_emission}</td>
              <td>{n.statut}</td>
              <td>
                <button onClick={() => setSelection(n.id)}>Détail</button>
              </td>
            </tr>
          ))}
          {notes.length === 0 && (
            <tr>
              <td colSpan={4}>Aucune note.</td>
            </tr>
          )}
        </tbody>
      </table>

      {selection !== null && (
        <DetailNote
          noteId={selection}
          onFermer={() => setSelection(null)}
          onChangement={rechargerNotes}
        />
      )}
    </section>
  );
}

function DetailNote({
  noteId,
  onFermer,
  onChangement,
}: {
  noteId: number;
  onFermer: () => void;
  onChangement: () => void;
}) {
  const [detail, setDetail] = useState<NoteDetail | null>(null);
  const [solde, setSolde] = useState<SoldeNote | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [montant, setMontant] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  async function recharger() {
    const [d, s, p] = await Promise.all([
      getNote(noteId),
      soldeNote(noteId),
      listPaiements(noteId),
    ]);
    setDetail(d);
    setSolde(s);
    setPaiements(p);
  }

  useEffect(() => {
    recharger().catch((e) => setErreur(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  async function payer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    const cents = parseEuros(montant);
    if (cents === null || cents <= 0) {
      setErreur("Montant invalide");
      return;
    }
    try {
      await enregistrerPaiement({
        note_id: noteId,
        montant_cents: cents,
        date_paiement: aujourdhui(),
        methode: null,
      });
      setMontant("");
      await recharger();
      onChangement();
    } catch (err) {
      setErreur(String(err));
    }
  }

  async function recu(paiementId: number) {
    setErreur(null);
    try {
      const r = await genererRecu(paiementId);
      alert(`Reçu généré : ${r.numero}`);
    } catch (err) {
      setErreur(String(err));
    }
  }

  if (!detail || !solde) return null;

  return (
    <div className="detail">
      <div className="detail-entete">
        <h3>Note {detail.note.reference ?? `#${detail.note.id}`}</h3>
        <button onClick={onFermer}>Fermer</button>
      </div>
      {erreur && <p className="erreur">{erreur}</p>}

      <ul className="lignes">
        {detail.lignes.map((l) => (
          <li key={l.id}>
            {l.libelle_snapshot} × {l.quantite} ={" "}
            {formatEuros(l.prix_cents_snapshot * l.quantite)}
          </li>
        ))}
      </ul>

      <p>Total facturé : {formatEuros(solde.total_cents)}</p>
      <p>Encaissé : {formatEuros(solde.paye_cents)}</p>
      <p>
        <strong>Solde dû : {formatEuros(solde.solde_cents)}</strong>{" "}
        {solde.payee && <span className="badge">Payée</span>}
      </p>

      {!solde.payee && (
        <form className="form-inline" onSubmit={payer}>
          <input
            aria-label="Montant du paiement"
            placeholder="Montant (ex: 50,00)"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
          />
          <button type="submit">Enregistrer le paiement</button>
        </form>
      )}

      <h4>Paiements</h4>
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Montant</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {paiements.map((p) => (
            <tr key={p.id}>
              <td>{p.date_paiement}</td>
              <td>{formatEuros(p.montant_cents)}</td>
              <td>
                <button onClick={() => recu(p.id)}>Reçu</button>
              </td>
            </tr>
          ))}
          {paiements.length === 0 && (
            <tr>
              <td colSpan={3}>Aucun paiement.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
