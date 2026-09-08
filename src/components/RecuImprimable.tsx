import { formatMontant } from "../api/money";
import type { Parametres, RecuDetail } from "../api/types";
import { ApercuImprimable, EnTeteCabinet } from "./ApercuImprimable";

/** Aperçu d'un reçu, imprimable (window.print → choix du format/PDF). */
export function RecuImprimable({
  recu,
  params,
  onClose,
}: {
  recu: RecuDetail;
  params?: Parametres | null;
  onClose: () => void;
}) {
  return (
    <ApercuImprimable
      filigrane={recu.annule ? "ANNULÉ" : undefined}
      onClose={onClose}
    >
      <header className="recu-tete">
        <EnTeteCabinet params={params} />
        <div className="recu-meta">
          <div className="recu-titre">REÇU DE PAIEMENT</div>
          <div className="recu-numero">{recu.numero}</div>
          <div className="recu-date">Émis le {recu.emis_le.slice(0, 10)}</div>
        </div>
      </header>

      <section className="recu-bloc">
        <h3>Client</h3>
        <p className="recu-client-nom">{recu.client_nom}</p>
        {recu.client_email && <p>{recu.client_email}</p>}
        {recu.client_telephone && <p>{recu.client_telephone}</p>}
      </section>

      <section className="recu-bloc">
        <div className="recu-ligne">
          <span>Facture</span>
          <span>{recu.note_reference ?? `#${recu.note_id}`}</span>
        </div>
        <div className="recu-ligne">
          <span>Date du paiement</span>
          <span>{recu.date_paiement.slice(0, 10)}</span>
        </div>
        {recu.methode && (
          <div className="recu-ligne">
            <span>Mode de règlement</span>
            <span>{recu.methode}</span>
          </div>
        )}
      </section>

      {recu.lignes.length > 0 && (
        <section className="recu-bloc">
          <h3>Prestations</h3>
          {recu.lignes.map((l) => (
            <div className="recu-ligne" key={l.id}>
              <span>
                {l.libelle_snapshot} × {l.quantite}
              </span>
              <span>{formatMontant(l.prix_snapshot * l.quantite)}</span>
            </div>
          ))}
        </section>
      )}

      <section className="recu-montant">
        <span>Montant réglé</span>
        <strong>{formatMontant(recu.montant)}</strong>
      </section>

      <section className="recu-bloc">
        <div className="recu-ligne">
          <span>Total de la note</span>
          <span>{formatMontant(recu.note_total)}</span>
        </div>
        <div className="recu-ligne">
          <span>Reste à payer</span>
          <span>{formatMontant(recu.note_solde)}</span>
        </div>
      </section>

      <footer className="recu-pied">
        Reçu pour le montant indiqué. Merci de votre confiance.
      </footer>
    </ApercuImprimable>
  );
}
