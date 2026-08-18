import { useEffect, useMemo, useRef, useState } from "react";
import {
  annulerNote,
  annulerPaiement,
  createDepense,
  createNote,
  deleteDepense,
  enregistrerPaiement,
  genererRecu,
  getNote,
  getParametres,
  getRecu,
  listClients,
  listModesPaiement,
  listNotesResume,
  listPaiements,
  listPrestationsActives,
  soldeNote,
} from "../api/client";
import { formatMontant, parseMontant } from "../api/money";
import { exporterNotesCsv } from "../api/exports";
import type {
  Client,
  ModePaiement,
  NewNoteLigne,
  NoteDetail,
  NoteResume,
  Paiement,
  Parametres,
  Prestation,
  RecuDetail,
  RemiseType,
  SoldeNote,
} from "../api/types";
import { RecuImprimable } from "../components/RecuImprimable";
import { NoteImprimable } from "../components/NoteImprimable";
import { BarreRecherche } from "../components/BarreRecherche";
import { useToast } from "../components/toast-context";
import { correspond } from "../utils/recherche";

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Montant de remise appliqué, miroir de la vue SQL `note_totaux` : arrondi au
 * franc le plus proche et borné à [0, brut]. Sert uniquement à l'aperçu ; le
 * montant qui fait foi est calculé côté base.
 */
function calculerRemise(
  brut: number,
  type: RemiseType | null,
  valeur: number,
): number {
  if (!type || valeur <= 0) return 0;
  const brute =
    type === "pourcent" ? Math.floor((brut * valeur + 50) / 100) : valeur;
  return Math.min(Math.max(brute, 0), brut);
}

function estEnRetard(n: NoteResume): boolean {
  return n.echeance !== null && n.echeance < aujourdhui() && n.solde > 0;
}

function estEcheanceProche(n: NoteResume): boolean {
  if (n.echeance === null || n.solde <= 0) return false;
  const dans7Jours = new Date();
  dans7Jours.setDate(dans7Jours.getDate() + 7);
  const limite = dans7Jours.toISOString().slice(0, 10);
  return n.echeance >= aujourdhui() && n.echeance <= limite;
}

async function notifierRetards(nb: number) {
  try {
    const { isPermissionGranted, requestPermission, sendNotification } =
      await import("@tauri-apps/plugin-notification");
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (granted) {
      sendNotification({
        title: "avf-compta",
        body: `${nb} note(s) en retard de paiement`,
      });
    }
  } catch {
    /* ignore (dev/web) */
  }
}

function libelleStatut(statut: string): string {
  if (statut === "annulee") return "Annulée";
  return statut === "payee" ? "Payée" : "En attente";
}

function badgeStatut(statut: string) {
  if (statut === "annulee") {
    return <span className="badge badge-retard">Annulée</span>;
  }
  const payee = statut === "payee";
  return (
    <span className={payee ? "badge badge-ok" : "badge badge-attente"}>
      {payee ? "Payée" : "En attente"}
    </span>
  );
}

export function NotesPage() {
  const { showToast } = useToast();
  const [notes, setNotes] = useState<NoteResume[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [params, setParams] = useState<Parametres | null>(null);
  const [modes, setModes] = useState<ModePaiement[]>([]);
  const [selection, setSelection] = useState<number | null>(null);
  const [recherche, setRecherche] = useState("");
  const [recuAImprimer, setRecuAImprimer] = useState<RecuDetail | null>(null);
  const [noteAImprimer, setNoteAImprimer] = useState<{
    detail: NoteDetail;
    solde: SoldeNote;
    clientNom: string;
  } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Formulaire de création.
  const [clientId, setClientId] = useState("");
  const [echeance, setEcheance] = useState("");
  const [lignes, setLignes] = useState<NewNoteLigne[]>([]);
  const [remiseType, setRemiseType] = useState<RemiseType | "">("");
  const [remiseValeur, setRemiseValeur] = useState("");

  const rappelEnvoye = useRef(false);

  async function rechargerNotes() {
    setNotes(await listNotesResume());
  }

  useEffect(() => {
    Promise.all([
      listNotesResume(),
      listClients(),
      listPrestationsActives(),
      getParametres(),
      listModesPaiement(),
    ])
      .then(([n, c, p, par, m]) => {
        setNotes(n);
        setClients(c);
        setPrestations(p);
        setParams(par);
        setModes(m);
        const nbRetard = n.filter(estEnRetard).length;
        if (nbRetard > 0 && !rappelEnvoye.current) {
          rappelEnvoye.current = true;
          notifierRetards(nbRetard);
        }
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
    let valeurRemise = 0;
    if (remiseType) {
      const v = parseMontant(remiseValeur);
      if (v === null || v < 0) {
        setErreur("Remise invalide");
        return;
      }
      if (remiseType === "pourcent" && v > 100) {
        setErreur("La remise ne peut pas dépasser 100 %.");
        return;
      }
      valeurRemise = v;
    }
    try {
      await createNote({
        client_id: Number(clientId),
        date_emission: aujourdhui(),
        echeance: echeance || null,
        lignes,
        remise_type: remiseType || null,
        remise_valeur: valeurRemise,
      });
      setClientId("");
      setEcheance("");
      setLignes([]);
      setRemiseType("");
      setRemiseValeur("");
      await rechargerNotes();
      showToast("Facture créée");
    } catch (err) {
      setErreur(String(err));
    }
  }

  const brutApercu = lignes.reduce((acc, l) => {
    const p = prestations.find((pr) => pr.id === l.prestation_id);
    return acc + (p ? p.prix * l.quantite : 0);
  }, 0);
  // Même règle que la vue SQL `note_totaux` : arrondi au franc, borné au brut.
  const remiseApercu = calculerRemise(
    brutApercu,
    remiseType || null,
    parseMontant(remiseValeur) ?? 0,
  );
  const totalApercu = brutApercu - remiseApercu;

  const nbRetard = notes.filter(estEnRetard).length;
  const nbProche = notes.filter(estEcheanceProche).length;

  const notesFiltrees = useMemo(
    () =>
      notes.filter((n) =>
        correspond(
          [
            n.reference ?? `#${n.id}`,
            n.client_nom,
            n.date_emission,
            n.echeance,
            libelleStatut(n.statut),
          ],
          recherche,
        ),
      ),
    [notes, recherche],
  );

  const noteSelectionnee = notes.find((n) => n.id === selection);
  const clientSelectionne =
    clients.find((c) => c.id === noteSelectionnee?.client_id)?.nom ?? "Client";

  async function imprimerNoteListe(n: NoteResume) {
    setErreur(null);
    try {
      const nom = clients.find((c) => c.id === n.client_id)?.nom ?? "Client";
      const [detail, solde] = await Promise.all([
        getNote(n.id),
        soldeNote(n.id),
      ]);
      setNoteAImprimer({ detail, solde, clientNom: nom });
    } catch (err) {
      setErreur(String(err));
    }
  }

  async function annulerNoteListe(n: NoteResume) {
    if (!confirm("Annuler cette facture ? Elle sera exclue des totaux."))
      return;
    setErreur(null);
    try {
      await annulerNote(n.id);
      await rechargerNotes();
      showToast("Facture annulée");
    } catch (err) {
      setErreur(String(err));
    }
  }

  async function exporterNotesListeCsv() {
    setErreur(null);
    try {
      if (await exporterNotesCsv()) showToast("Notes exportées");
    } catch (err) {
      setErreur(String(err));
    }
  }

  return (
    <section className="page">
      <header className="page-tete">
        <div>
          <h2>Factures</h2>
          <p className="page-sous">
            {notesFiltrees.length} facture{notesFiltrees.length > 1 ? "s" : ""}
            {recherche && ` sur ${notes.length}`}
          </p>
        </div>
        <div className="page-actions">
          <button onClick={exporterNotesListeCsv}>Exporter (CSV)</button>
        </div>
      </header>

      {(nbRetard > 0 || nbProche > 0) && (
        <div className="rappel-banner" role="status">
          ⚠️ {nbRetard > 0 && <>{nbRetard} facture(s) en retard</>}
          {nbRetard > 0 && nbProche > 0 && ", "}
          {nbProche > 0 && <>{nbProche} à échéance proche</>}.
        </div>
      )}

      {erreur && <p className="erreur">{erreur}</p>}

      <form className="carte-form" onSubmit={creer}>
        <h3 className="form-titre">Nouvelle facture</h3>
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
          <label>
            <span>Échéance (facultatif)</span>
            <input
              type="date"
              value={echeance}
              onChange={(e) => setEcheance(e.target.value)}
            />
          </label>
          <label>
            <span>Remise (facultatif)</span>
            <div className="remise-champ">
              <select
                aria-label="Type de remise"
                value={remiseType}
                onChange={(e) => {
                  const v = e.target.value as RemiseType | "";
                  setRemiseType(v);
                  if (!v) setRemiseValeur("");
                }}
              >
                <option value="">Aucune</option>
                <option value="montant">En FCFA</option>
                <option value="pourcent">En %</option>
              </select>
              {remiseType && (
                <input
                  inputMode="numeric"
                  aria-label="Valeur de la remise"
                  placeholder={remiseType === "pourcent" ? "10" : "5 000"}
                  value={remiseValeur}
                  onChange={(e) => setRemiseValeur(e.target.value)}
                />
              )}
            </div>
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
            {remiseApercu > 0 && (
              <span className="total-detail">
                Sous-total {formatMontant(brutApercu)} − remise{" "}
                {formatMontant(remiseApercu)} ={" "}
              </span>
            )}
            Total : <strong>{formatMontant(totalApercu)}</strong>
          </span>
          <button type="submit" className="btn-primary">
            Créer la facture
          </button>
        </div>
      </form>

      <BarreRecherche
        valeur={recherche}
        onChange={setRecherche}
        placeholder="Rechercher une facture (réf., client, statut, date)…"
      />

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Réf.</th>
              <th>Client</th>
              <th>Date</th>
              <th>Statut</th>
              <th>Échéance</th>
              <th className="col-montant">Montant</th>
              <th className="col-montant">Payé</th>
              <th className="col-montant">Restant</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {notesFiltrees.map((n) => (
              <tr key={n.id}>
                <td className="cell-fort">{n.reference ?? `#${n.id}`}</td>
                <td>{n.client_nom}</td>
                <td>{n.date_emission}</td>
                <td>{badgeStatut(n.statut)}</td>
                <td>
                  {n.echeance ?? "—"}
                  {estEnRetard(n) && (
                    <span className="badge badge-retard">En retard</span>
                  )}
                </td>
                <td className="col-montant">{formatMontant(n.total)}</td>
                <td className="col-montant">{formatMontant(n.paye)}</td>
                <td className="col-montant">{formatMontant(n.solde)}</td>
                <td className="cell-actions">
                  <button onClick={() => setSelection(n.id)}>Détail</button>
                  <button onClick={() => imprimerNoteListe(n)}>Imprimer</button>
                  {n.statut !== "annulee" && (
                    <button
                      className="btn-danger"
                      onClick={() => annulerNoteListe(n)}
                    >
                      Annuler
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {notesFiltrees.length === 0 && (
              <tr>
                <td colSpan={9} className="vide">
                  {notes.length === 0
                    ? "Aucune facture pour le moment."
                    : "Aucune facture ne correspond à la recherche."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selection !== null && (
        <DetailNote
          noteId={selection}
          modes={modes}
          onFermer={() => setSelection(null)}
          onChangement={rechargerNotes}
          onRecu={setRecuAImprimer}
          onImprimer={(detail, solde) =>
            setNoteAImprimer({ detail, solde, clientNom: clientSelectionne })
          }
        />
      )}

      {recuAImprimer && (
        <RecuImprimable
          recu={recuAImprimer}
          params={params}
          onClose={() => setRecuAImprimer(null)}
        />
      )}

      {noteAImprimer && (
        <NoteImprimable
          detail={noteAImprimer.detail}
          clientNom={noteAImprimer.clientNom}
          solde={noteAImprimer.solde}
          params={params}
          onClose={() => setNoteAImprimer(null)}
        />
      )}
    </section>
  );
}

function DetailNote({
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
            placeholder="Libellé"
            value={depLibelle}
            onChange={(e) => setDepLibelle(e.target.value)}
          />
          <input
            inputMode="numeric"
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
