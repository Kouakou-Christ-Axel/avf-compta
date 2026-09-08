import { formatMontant } from "../../api/money";
import type { NoteResume } from "../../api/types";
import { BarreRecherche } from "../../components/BarreRecherche";
import { badgeStatut, estEnRetard } from "./statut";

/**
 * Tableau des factures et sa recherche. Purement présentationnel : la page
 * garde l'état et fournit les actions, ce qui laisse le balisage — et donc les
 * règles CSS et les tests — inchangés.
 */
export function NotesListe({
  notes,
  notesFiltrees,
  recherche,
  onRecherche,
  chargement,
  onDetail,
  onModifier,
  onImprimer,
  onAnnuler,
}: {
  notes: NoteResume[];
  notesFiltrees: NoteResume[];
  recherche: string;
  onRecherche: (valeur: string) => void;
  chargement: boolean;
  onDetail: (note: NoteResume) => void;
  onModifier: (note: NoteResume) => void;
  onImprimer: (note: NoteResume) => void;
  onAnnuler: (note: NoteResume) => void;
}) {
  return (
    <>
      <BarreRecherche
        valeur={recherche}
        onChange={onRecherche}
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
                  <button onClick={() => onDetail(n)}>Détail</button>
                  {/* Une facture encaissée est verrouillée : un reçu déjà
                      remis atteste d'un montant qui ne doit plus changer. */}
                  {n.statut !== "annulee" && n.paye === 0 && (
                    <button onClick={() => onModifier(n)}>Modifier</button>
                  )}
                  <button onClick={() => onImprimer(n)}>Imprimer</button>
                  {n.statut !== "annulee" && (
                    <button className="btn-danger" onClick={() => onAnnuler(n)}>
                      Annuler
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {notesFiltrees.length === 0 && (
              <tr>
                <td colSpan={9} className="vide">
                  {chargement
                    ? "Chargement…"
                    : notes.length === 0
                      ? "Aucune facture pour le moment."
                      : "Aucune facture ne correspond à la recherche."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
