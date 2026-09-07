import { useEffect, useState } from "react";
import {
  annulerPaiement,
  createDepense,
  deleteDepense,
  enregistrerPaiement,
  genererRecu,
  getNote,
  getRecu,
  listPaiements,
  soldeNote,
} from "../../api/client";
import { formatMontant, parseMontant } from "../../api/money";
import type {
  ModePaiement,
  NoteDetail,
  Paiement,
  RecuDetail,
  SoldeNote,
} from "../../api/types";
import { useToast } from "../../components/toast-context";
import { aujourdhui } from "./dates";

/**
 * Détail d'une facture : lignes, solde, encaissements et reçus, dépenses
 * rattachées et marge. Extrait de `NotesPage` sans changement de balisage —
 * les règles d'impression de `App.css` et les tests s'y appuient.
 */
export function DetailNote({
  noteId,
  modes,
  onFermer,
  onChangement,
  onRecu,
  onImprimer,
}: {
  noteId: number;
  modes: ModePaiement[];
  onFermer: () => void;
  onChangement: () => void;
  onRecu: (recu: RecuDetail) => void;
  onImprimer: (detail: NoteDetail, solde: SoldeNote) => void;
}) {
  const { showToast } = useToast();
  const [detail, setDetail] = useState<NoteDetail | null>(null);
  const [solde, setSolde] = useState<SoldeNote | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [montant, setMontant] = useState("");
  const [methode, setMethode] = useState("");
  const [datePaiement, setDatePaiement] = useState(aujourdhui());
  const [depLibelle, setDepLibelle] = useState("");
  const [depMontant, setDepMontant] = useState("");
  const [depDate, setDepDate] = useState(aujourdhui());
  const [depEnvoi, setDepEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurDepense, setErreurDepense] = useState<string | null>(null);
  const [recuEnCours, setRecuEnCours] = useState<number | null>(null);

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

  function imprimerNote() {
    if (detail && solde) onImprimer(detail, solde);
  }

  /**
   * Ouvre le reçu du paiement. La commande est idempotente côté Rust : si un
   * reçu existe déjà, c'est lui qui revient — prévisualiser ne crée plus de
   * doublon. Le bouton est verrouillé le temps de l'appel pour éviter le
   * double-clic.
   */
  async function ouvrirRecu(paiement: Paiement) {
    if (recuEnCours !== null) return;
    setErreur(null);
    setRecuEnCours(paiement.id);
    try {
      const recu = await genererRecu(paiement.id);
      const detailRecu = await getRecu(recu.id);
      onRecu(detailRecu);
      if (paiement.recu_id === null) showToast(`Reçu ${recu.numero} généré`);
      await recharger();
    } catch (err) {
      setErreur(String(err));
    } finally {
      setRecuEnCours(null);
    }
  }

  async function annulerLePaiement(paiement: Paiement) {
    const avecRecu = paiement.recu_numero
      ? ` Le reçu ${paiement.recu_numero} sera annulé.`
      : "";
    if (
      !confirm(
        `Annuler le paiement de ${formatMontant(paiement.montant)} ?${avecRecu}`,
      )
    )
      return;
    setErreur(null);
    try {
      await annulerPaiement(paiement.id);
      await recharger();
      onChangement();
      showToast("Paiement annulé");
    } catch (err) {
      setErreur(String(err));
    }
  }

  async function ajouterDepense(e: React.FormEvent) {
    e.preventDefault();
    // L'erreur est affichée sous le formulaire : le bandeau en haut du modal
    // est hors écran quand on saisit une dépense, et les rejets passaient
    // inaperçus (la dépense semblait enregistrée alors qu'elle ne l'était pas).
    setErreurDepense(null);
    const m = parseMontant(depMontant);
    if (!depLibelle.trim()) {
      setErreurDepense("Libellé de dépense requis");
      return;
    }
    if (m === null || m <= 0) {
      setErreurDepense("Montant de dépense invalide (ex : 5 000 ou 5.000)");
      return;
    }
    if (!depDate) {
      setErreurDepense("Date de dépense requise");
      return;
    }
    setDepEnvoi(true);
    try {
      await createDepense({
        note_id: noteId,
        libelle: depLibelle.trim(),
        montant: m,
        date_depense: depDate,
      });
      setDepLibelle("");
      setDepMontant("");
      setDepDate(aujourdhui());
      await recharger();
      onChangement();
      showToast("Dépense ajoutée");
    } catch (err) {
      setErreurDepense(String(err));
    } finally {
      setDepEnvoi(false);
    }
  }

  async function supprimerDepense(id: number) {
    if (!confirm("Supprimer cette dépense ?")) return;
    setErreurDepense(null);
    try {
      await deleteDepense(id);
      await recharger();
      onChangement();
      showToast("Dépense supprimée");
    } catch (err) {
      setErreurDepense(String(err));
    }
  }

  // Avant : `return null` masquait l'erreur de chargement rendue plus bas, et
  // le bouton « Détail » semblait ne rien faire du tout.
  if (!detail || !solde) {
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true">
        <div className="modal">
          <div className="modal-tete">
            <h3>Facture</h3>
            <button className="x" onClick={onFermer} aria-label="Fermer">
              ✕
            </button>
          </div>
          {erreur ? (
            <p className="erreur">{erreur}</p>
          ) : (
            <p className="aide">Chargement…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-tete">
          <h3>Facture {detail.note.reference ?? `#${detail.note.id}`}</h3>
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
          <button onClick={imprimerNote}>Imprimer la note</button>
        </div>

        {!solde.payee ? (
          <form className="paiement-form" onSubmit={payer}>
            <input
              inputMode="numeric"
              aria-label="Montant du paiement (FCFA)"
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
            <select
              aria-label="Mode de paiement"
              value={methode}
              onChange={(e) => setMethode(e.target.value)}
            >
              <option value="">— Mode —</option>
              {modes.map((m) => (
                <option key={m.id} value={m.libelle}>
                  {m.libelle}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary">
              Encaisser
            </button>
          </form>
        ) : (
          <p className="paye-info">
            <span className="badge badge-ok">Payée</span> Cette facture est
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
                    {p.annule ? (
                      <span className="badge badge-retard">Annulé</span>
                    ) : (
                      <>
                        <button
                          onClick={() => ouvrirRecu(p)}
                          disabled={recuEnCours !== null}
                        >
                          {p.recu_numero
                            ? `Voir ${p.recu_numero}`
                            : "Générer le reçu"}
                        </button>
                        <button
                          className="btn-danger"
                          onClick={() => annulerLePaiement(p)}
                        >
                          Annuler
                        </button>
                      </>
                    )}
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

        <h4 className="sous-titre">Dépenses</h4>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Libellé</th>
                <th className="col-montant">Montant</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {detail.depenses.map((d) => (
                <tr key={d.id}>
                  <td>{d.date_depense}</td>
                  <td>{d.libelle}</td>
                  <td className="col-montant">{formatMontant(d.montant)}</td>
                  <td className="cell-actions">
                    <button
                      className="btn-danger"
                      onClick={() => supprimerDepense(d.id)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
              {detail.depenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="vide">
                    Aucune dépense.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form className="depenses-form" onSubmit={ajouterDepense}>
          <input
            aria-label="Libellé de la dépense"
            placeholder="Libellé"
            value={depLibelle}
            onChange={(e) => setDepLibelle(e.target.value)}
          />
          <input
            inputMode="numeric"
            aria-label="Montant de la dépense (FCFA)"
            placeholder="Montant (FCFA)"
            value={depMontant}
            onChange={(e) => setDepMontant(e.target.value)}
          />
          <input
            type="date"
            aria-label="Date de la dépense"
            value={depDate}
            onChange={(e) => setDepDate(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={depEnvoi}>
            {depEnvoi ? "Ajout…" : "Ajouter"}
          </button>
        </form>
        {erreurDepense && <p className="erreur">{erreurDepense}</p>}

        <div className="marge-box">
          <div>
            <span>Dépenses</span>
            <strong>{formatMontant(detail.depenses_total)}</strong>
          </div>
          <div>
            <span>Marge</span>
            <strong
              className={
                detail.marge >= 0 ? "marge-positive" : "marge-negative"
              }
            >
              {formatMontant(detail.marge)}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
