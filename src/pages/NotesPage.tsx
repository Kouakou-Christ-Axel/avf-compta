import { useEffect, useState } from "react";
import {
  createNote,
  enregistrerPaiement,
  genererRecu,
  getNote,
  getParametres,
  getRecu,
  listClients,
  listNotesResume,
  listPaiements,
  listPrestations,
  soldeNote,
} from "../api/client";
import { formatMontant, parseMontant } from "../api/money";
import { exportNotePdf } from "../api/pdf";
import type {
  Client,
  NewNoteLigne,
  NoteDetail,
  NoteResume,
  Paiement,
  Parametres,
  Prestation,
  RecuDetail,
  SoldeNote,
} from "../api/types";
import { RecuImprimable } from "../components/RecuImprimable";
import { useToast } from "../components/toast-context";

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

function badgeStatut(statut: string) {
  const payee = statut === "payee";
  return (
    <span className={payee ? "badge badge-ok" : "badge badge-attente"}>
      {payee ? "Payée" : "En attente"}
    </span>
  );
}

export function NotesPage() {
  const [notes, setNotes] = useState<NoteResume[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [params, setParams] = useState<Parametres | null>(null);
  const [selection, setSelection] = useState<number | null>(null);
  const [recuAImprimer, setRecuAImprimer] = useState<RecuDetail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Formulaire de création.
  const [clientId, setClientId] = useState("");
  const [lignes, setLignes] = useState<NewNoteLigne[]>([]);

  async function rechargerNotes() {
    setNotes(await listNotesResume());
  }

  useEffect(() => {
    Promise.all([
      listNotesResume(),
      listClients(),
      listPrestations(),
      getParametres(),
    ])
      .then(([n, c, p, par]) => {
        setNotes(n);
        setClients(c);
        setPrestations(p);
        setParams(par);
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

  function retirerLigne(prestationId: number) {
    setLignes((ls) => ls.filter((l) => l.prestation_id !== prestationId));
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
        date_emission: aujourdhui(),
        lignes,
      });
      setClientId("");
      setLignes([]);
      await rechargerNotes();
    } catch (err) {
      setErreur(String(err));
    }
  }

  const totalApercu = lignes.reduce((acc, l) => {
    const p = prestations.find((pr) => pr.id === l.prestation_id);
    return acc + (p ? p.prix * l.quantite : 0);
  }, 0);

  const noteSelectionnee = notes.find((n) => n.id === selection);
  const clientSelectionne =
    clients.find((c) => c.id === noteSelectionnee?.client_id)?.nom ?? "Client";

  return (
    <section className="page">
      <header className="page-tete">
        <div>
          <h2>Notes de frais</h2>
          <p className="page-sous">
            {notes.length} note{notes.length > 1 ? "s" : ""}
          </p>
        </div>
      </header>

      {erreur && <p className="erreur">{erreur}</p>}

      <form className="carte-form" onSubmit={creer}>
        <h3 className="form-titre">Nouvelle note</h3>
        <div className="champs">
          <label>
            <span>Client</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">— Sélectionner —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </label>
          <span className="aide ref-auto">
            La référence est générée automatiquement (AA-MM-NNNN).
          </span>
        </div>

        <p className="aide">Cliquez sur une prestation pour l'ajouter :</p>
        <div className="puces">
          {prestations.map((p) => (
            <button
              type="button"
              key={p.id}
              className="puce"
              onClick={() => ajouterLigne(p.id)}
            >
              + {p.libelle}
              <span className="puce-prix">{formatMontant(p.prix)}</span>
            </button>
          ))}
          {prestations.length === 0 && (
            <span className="aide">Aucune prestation : créez-en d'abord.</span>
          )}
        </div>

        {lignes.length > 0 && (
          <ul className="lignes">
            {lignes.map((l) => {
              const p = prestations.find((pr) => pr.id === l.prestation_id);
              return (
                <li key={l.prestation_id}>
                  <span>
                    {p?.libelle} × {l.quantite}
                  </span>
                  <span className="ligne-droite">
                    {formatMontant((p?.prix ?? 0) * l.quantite)}
                    <button
                      type="button"
                      className="x"
                      onClick={() => retirerLigne(l.prestation_id)}
                      aria-label="Retirer"
                    >
                      ✕
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="form-pied">
          <span className="total-apercu">
            Total : <strong>{formatMontant(totalApercu)}</strong>
          </span>
          <button type="submit" className="btn-primary">
            Créer la note
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Réf.</th>
              <th>Date</th>
              <th>Statut</th>
              <th className="col-montant">Montant</th>
              <th className="col-montant">Payé</th>
              <th className="col-montant">Restant</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {notes.map((n) => (
              <tr key={n.id}>
                <td className="cell-fort">{n.reference ?? `#${n.id}`}</td>
                <td>{n.date_emission}</td>
                <td>{badgeStatut(n.statut)}</td>
                <td className="col-montant">{formatMontant(n.total)}</td>
                <td className="col-montant">{formatMontant(n.paye)}</td>
                <td className="col-montant">{formatMontant(n.solde)}</td>
                <td className="cell-actions">
                  <button onClick={() => setSelection(n.id)}>Détail</button>
                </td>
              </tr>
            ))}
            {notes.length === 0 && (
              <tr>
                <td colSpan={7} className="vide">
                  Aucune note pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selection !== null && (
        <DetailNote
          noteId={selection}
          clientNom={clientSelectionne}
          params={params}
          onFermer={() => setSelection(null)}
          onChangement={rechargerNotes}
          onRecu={setRecuAImprimer}
        />
      )}

      {recuAImprimer && (
        <RecuImprimable
          recu={recuAImprimer}
          params={params}
          onClose={() => setRecuAImprimer(null)}
        />
      )}
    </section>
  );
}

function DetailNote({
  noteId,
  clientNom,
  params,
  onFermer,
  onChangement,
  onRecu,
}: {
  noteId: number;
  clientNom: string;
  params: Parametres | null;
  onFermer: () => void;
  onChangement: () => void;
  onRecu: (recu: RecuDetail) => void;
}) {
  const { showToast } = useToast();
  const [detail, setDetail] = useState<NoteDetail | null>(null);
  const [solde, setSolde] = useState<SoldeNote | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [montant, setMontant] = useState("");
  const [methode, setMethode] = useState("");
  const [datePaiement, setDatePaiement] = useState(aujourdhui());
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
    const m = parseMontant(montant);
    if (m === null || m <= 0) {
      setErreur("Montant invalide");
      return;
    }
    if (!datePaiement) {
      setErreur("Date de paiement requise");
      return;
    }
    try {
      await enregistrerPaiement({
        note_id: noteId,
        montant: m,
        date_paiement: datePaiement,
        methode: methode || null,
      });
      setMontant("");
      setMethode("");
      setDatePaiement(aujourdhui());
      await recharger();
      onChangement();
      showToast("Paiement enregistré");
    } catch (err) {
      setErreur(String(err));
    }
  }

  async function exporterNote() {
    if (!detail) return;
    try {
      await exportNotePdf(detail, clientNom, solde, params);
      showToast("PDF généré");
    } catch (err) {
      setErreur(String(err));
    }
  }

  async function imprimerRecu(paiementId: number) {
    setErreur(null);
    try {
      const recu = await genererRecu(paiementId);
      const detailRecu = await getRecu(recu.id);
      onRecu(detailRecu);
      showToast(`Reçu ${recu.numero} généré`);
    } catch (err) {
      setErreur(String(err));
    }
  }

  if (!detail || !solde) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-tete">
          <h3>Note {detail.note.reference ?? `#${detail.note.id}`}</h3>
          <button className="x" onClick={onFermer} aria-label="Fermer">
            ✕
          </button>
        </div>
        {erreur && <p className="erreur">{erreur}</p>}

        <ul className="lignes">
          {detail.lignes.map((l) => (
            <li key={l.id}>
              <span>
                {l.libelle_snapshot} × {l.quantite}
              </span>
              <span>{formatMontant(l.prix_snapshot * l.quantite)}</span>
            </li>
          ))}
        </ul>

        <div className="solde">
          <div>
            <span>Facturé</span>
            <strong>{formatMontant(solde.total)}</strong>
          </div>
          <div>
            <span>Encaissé</span>
            <strong>{formatMontant(solde.paye)}</strong>
          </div>
          <div className="solde-du">
            <span>Reste à payer</span>
            <strong>{formatMontant(solde.solde)}</strong>
          </div>
        </div>

        <div className="detail-actions">
          <button onClick={exporterNote}>Exporter la note en PDF</button>
        </div>

        {!solde.payee ? (
          <form className="paiement-form" onSubmit={payer}>
            <input
              inputMode="numeric"
              placeholder="Montant (FCFA)"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
            />
            <input
              type="date"
              aria-label="Date du paiement"
              value={datePaiement}
              onChange={(e) => setDatePaiement(e.target.value)}
            />
            <input
              placeholder="Mode (espèces, virement…)"
              value={methode}
              onChange={(e) => setMethode(e.target.value)}
            />
            <button type="submit" className="btn-primary">
              Encaisser
            </button>
          </form>
        ) : (
          <p className="paye-info">
            <span className="badge badge-ok">Payée</span> Cette note est
            entièrement réglée.
          </p>
        )}

        <h4 className="sous-titre">Paiements</h4>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="col-montant">Montant</th>
                <th>Mode</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paiements.map((p) => (
                <tr key={p.id}>
                  <td>{p.date_paiement}</td>
                  <td className="col-montant">{formatMontant(p.montant)}</td>
                  <td>{p.methode ?? "—"}</td>
                  <td className="cell-actions">
                    <button onClick={() => imprimerRecu(p.id)}>Reçu</button>
                  </td>
                </tr>
              ))}
              {paiements.length === 0 && (
                <tr>
                  <td colSpan={4} className="vide">
                    Aucun paiement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
