import { formatMontant } from "../api/money";
import type { NoteDetail, Parametres, SoldeNote } from "../api/types";

/** Aperçu imprimable d'une note de frais (window.print → choix format/PDF). */
export function NoteImprimable({
  detail,
  clientNom,
  solde,
  params,
  onClose,
}: {
  detail: NoteDetail;
  clientNom: string;
  solde?: SoldeNote | null;
  params?: Parametres | null;
  onClose: () => void;
}) {
  const cabinet = params?.cabinet_nom || "avf-compta";
  const note = detail.note;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="recu-print">
          <header className="recu-tete">
            <div className="recu-cabinet-bloc">
              {params?.logo && (
                <img className="recu-logo" src={params.logo} alt="Logo" />
              )}
              <div>
                <h2 className="recu-cabinet">{cabinet}</h2>
                {params?.sous_titre && (
                  <p className="recu-sous">{params.sous_titre}</p>
                )}
                {params?.telephone && (
                  <p className="recu-coord">{params.telephone}</p>
                )}
                {params?.email && <p className="recu-coord">{params.email}</p>}
              </div>
            </div>
            <div className="recu-meta">
              <div className="recu-titre">FACTURE</div>
              <div className="recu-numero">
                {note.reference ?? `#${note.id}`}
              </div>
              <div className="recu-date">Émise le {note.date_emission}</div>
              {note.echeance && (
                <div className="recu-date">Échéance {note.echeance}</div>
              )}
            </div>
          </header>

          <section className="recu-bloc">
            <h3>Client</h3>
            <p className="recu-client-nom">{clientNom}</p>
          </section>

          <section className="recu-bloc">
            <h3>Prestations</h3>
            {detail.lignes.map((l) => (
              <div className="recu-ligne" key={l.id}>
                <span>
                  {l.libelle_snapshot} × {l.quantite}
                </span>
                <span>{formatMontant(l.prix_snapshot * l.quantite)}</span>
              </div>
            ))}
          </section>

          <section className="recu-montant">
            <span>Total</span>
            <strong>{formatMontant(detail.total)}</strong>
          </section>

          {solde && (
            <section className="recu-bloc">
              <div className="recu-ligne">
                <span>Payé</span>
                <span>{formatMontant(solde.paye)}</span>
              </div>
              <div className="recu-ligne">
                <span>Reste à payer</span>
                <span>{formatMontant(solde.solde)}</span>
              </div>
            </section>
          )}

          {params?.coordonnees_paiement && (
            <section className="recu-bloc">
              <h3>Coordonnées de paiement</h3>
              <p className="recu-paiement">{params.coordonnees_paiement}</p>
            </section>
          )}
        </div>

        <div className="modal-actions no-print">
          <button className="btn-primary" onClick={() => window.print()}>
            Imprimer
          </button>
          <button onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
