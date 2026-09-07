import type { NoteResume, StatutNote } from "../../api/types";
import { aujourdhui } from "./dates";

/** Une facture échue et non soldée. Une facture annulée a un solde nul. */
export function estEnRetard(n: NoteResume): boolean {
  return n.echeance !== null && n.echeance < aujourdhui() && n.solde > 0;
}

/** Échéance dans les sept jours à venir, facture encore due. */
export function estEcheanceProche(n: NoteResume): boolean {
  if (n.echeance === null || n.solde <= 0) return false;
  const dans7Jours = new Date();
  dans7Jours.setDate(dans7Jours.getDate() + 7);
  const limite = dans7Jours.toISOString().slice(0, 10);
  return n.echeance >= aujourdhui() && n.echeance <= limite;
}

/** Libellé du statut, pour la recherche et l'export CSV. */
export function libelleStatut(statut: StatutNote): string {
  if (statut === "annulee") return "Annulée";
  return statut === "payee" ? "Payée" : "En attente";
}

/** Même libellé, présenté en pastille colorée. */
export function badgeStatut(statut: StatutNote) {
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
