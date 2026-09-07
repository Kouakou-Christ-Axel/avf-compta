import type { ReactNode } from "react";
import type { Parametres } from "../api/types";

/**
 * En-tête du cabinet (logo, nom, sous-titre, coordonnées), commun à la facture
 * et au reçu.
 *
 * Le balisage et les classes sont figés : `App.css` s'en sert pour la mise en
 * page à l'écran **et** dans ses règles `@media print`.
 */
export function EnTeteCabinet({
  params,
}: {
  params: Parametres | null | undefined;
}) {
  return (
    <div className="recu-cabinet-bloc">
      {params?.logo && (
        <img className="recu-logo" src={params.logo} alt="Logo" />
      )}
      <div>
        <h2 className="recu-cabinet">{params?.cabinet_nom || "avf-compta"}</h2>
        {params?.sous_titre && <p className="recu-sous">{params.sous_titre}</p>}
        {params?.telephone && <p className="recu-coord">{params.telephone}</p>}
        {params?.email && <p className="recu-coord">{params.email}</p>}
      </div>
    </div>
  );
}

/**
 * Coque des aperçus avant impression : la fenêtre modale, la zone imprimable,
 * le filigrane éventuel et les boutons — eux exclus de l'impression par
 * `no-print`.
 */
export function ApercuImprimable({
  filigrane,
  onClose,
  children,
}: {
  /** Mention barrée en fond (« ANNULÉ », « ANNULÉE »), absente si non fournie. */
  filigrane?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="recu-print">
          {filigrane && (
            <div className="filigrane-annule" aria-hidden="true">
              {filigrane}
            </div>
          )}
          {children}
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
