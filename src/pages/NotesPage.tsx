import { useEffect, useMemo, useState } from "react";
import {
  annulerNote,
  createNote,
  getNote,
  getParametres,
  listClients,
  listModesPaiement,
  listNotesResume,
  listPrestations,
  listPrestationsActives,
  soldeNote,
  updateNote,
} from "../api/client";
import { exporterNotesCsv } from "../api/exports";
import type {
  Client,
  NewNote,
  ModePaiement,
  NoteDetail,
  NoteResume,
  Parametres,
  Prestation,
  RecuDetail,
  SoldeNote,
} from "../api/types";
import { RecuImprimable } from "../components/RecuImprimable";
import { NoteImprimable } from "../components/NoteImprimable";
import { useToast } from "../components/toast-context";
import { correspond } from "../utils/recherche";
import { DetailNote } from "./notes/DetailNote";
import { NotesListe } from "./notes/NotesListe";
import { NoteFormulaire, type EditionNote } from "./notes/NoteFormulaire";
import { estEcheanceProche, estEnRetard, libelleStatut } from "./notes/statut";

/**
 * Un seul rappel des factures en retard par lancement de l'application.
 *
 * Hors du composant volontairement : `App` démonte la page à chaque changement
 * d'onglet, donc un état interne repartait à zéro et la notification système
 * était renvoyée à chaque retour sur « Factures ».
 */
let rappelRetardEnvoye = false;

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

export function NotesPage() {
  const { showToast } = useToast();
  const [notes, setNotes] = useState<NoteResume[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  // Toutes les prestations, archivées comprises : une facture existante peut
  // porter une prestation archivée depuis, et il faut pouvoir afficher son
  // libellé et son prix. Seules les actives sont proposées à l'ajout.
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [prestationsActives, setPrestationsActives] = useState<Prestation[]>(
    [],
  );
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

  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  // Facture en cours de modification (null = formulaire de création).
  const [edition, setEdition] = useState<EditionNote | null>(null);

  async function rechargerNotes() {
    setNotes(await listNotesResume());
  }

  useEffect(() => {
    Promise.all([
      listNotesResume(),
      listClients(),
      listPrestations(),
      listPrestationsActives(),
      getParametres(),
      listModesPaiement(),
    ])
      .then(([n, c, p, pa, par, m]) => {
        setNotes(n);
        setClients(c);
        setPrestations(p);
        setPrestationsActives(pa);
        setParams(par);
        setModes(m);
        const nbRetard = n.filter(estEnRetard).length;
        if (nbRetard > 0 && !rappelRetardEnvoye) {
          rappelRetardEnvoye = true;
          notifierRetards(nbRetard);
        }
      })
      .catch((e) => setErreur(String(e)))
      .finally(() => setChargement(false));
  }, []);

  /** Charge une facture dans le formulaire pour la modifier. */
  async function modifierFacture(n: NoteResume) {
    setErreur(null);
    try {
      setEdition({ id: n.id, detail: await getNote(n.id) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErreur(String(err));
    }
  }

  /** Enregistre la saisie validée par le formulaire (création ou édition). */
  async function enregistrerSaisie(saisie: NewNote) {
    setErreur(null);
    setEnvoi(true);
    try {
      if (edition !== null) {
        await updateNote(edition.id, saisie);
        showToast("Facture modifiée");
      } else {
        await createNote(saisie);
        showToast("Facture créée");
      }
      setEdition(null);
      await rechargerNotes();
    } catch (err) {
      setErreur(String(err));
    } finally {
      setEnvoi(false);
    }
  }

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

      <NoteFormulaire
        clients={clients}
        prestations={prestations}
        prestationsActives={prestationsActives}
        edition={edition}
        envoi={envoi}
        onSubmit={enregistrerSaisie}
        onAbandon={() => setEdition(null)}
        onErreur={setErreur}
      />

      <NotesListe
        notes={notes}
        notesFiltrees={notesFiltrees}
        recherche={recherche}
        onRecherche={setRecherche}
        chargement={chargement}
        onDetail={(n) => setSelection(n.id)}
        onModifier={modifierFacture}
        onImprimer={imprimerNoteListe}
        onAnnuler={annulerNoteListe}
      />

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
