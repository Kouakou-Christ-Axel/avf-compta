import { formatMontant } from "../api/money";
import type { RecuDetail } from "../api/types";

/** Aperçu d'un reçu, imprimable via le bouton (window.print + CSS @media print). */
export function RecuImprimable({
  recu,
  onClose,
}: {
  recu: RecuDetail;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="recu-print">
          <header className="recu-tete">
            <div>
              <h2 className="recu-cabinet">avf-compta</h2>
              <p className="recu-sous">Cabinet comptable</p>
            </div>
            <div className="recu-meta">
              <div className="recu-titre">REÇU DE PAIEMENT</div>
              <div className="recu-numero">{recu.numero}</div>
              <div className="recu-date">
                Émis le {recu.emis_le.slice(0, 10)}
              </div>
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
              <span>Note de frais</span>
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

          <section className="recu-montant">
            <span>Montant réglé</span>
            <strong>{formatMontant(recu.montant)}</strong>
          </section>

          <footer className="recu-pied">
            Reçu pour solde de tout compte du montant indiqué. Merci de votre
            confiance.
          </footer>
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
