import { useEffect, useState } from "react";
import { formatMontant, parseMontant } from "../../api/money";
import type {
  Client,
  NewNote,
  NewNoteLigne,
  NoteDetail,
  Prestation,
  RemiseType,
} from "../../api/types";
import { aujourdhui } from "./dates";
import { calculerRemise } from "./calculerRemise";

/** Facture chargée pour modification (`null` = création). */
export interface EditionNote {
  id: number;
  detail: NoteDetail;
}

/**
 * Formulaire de création et de modification d'une facture.
 *
 * Il porte son propre état de saisie ; la page se contente de lui fournir les
 * référentiels, de désigner la facture à modifier et de recevoir la saisie
 * validée. Le balisage est inchangé — les tests et les styles s'y appuient.
 */
export function NoteFormulaire({
  clients,
  prestations,
  prestationsActives,
  edition,
  envoi,
  onSubmit,
  onAbandon,
  onErreur,
}: {
  clients: Client[];
  /** Toutes les prestations : une facture peut porter une prestation archivée. */
  prestations: Prestation[];
  /** Seules les actives sont proposées à l'ajout. */
  prestationsActives: Prestation[];
  edition: EditionNote | null;
  envoi: boolean;
  onSubmit: (saisie: NewNote) => void;
  onAbandon: () => void;
  onErreur: (message: string | null) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [dateEmission, setDateEmission] = useState(aujourdhui());
  const [echeance, setEcheance] = useState("");
  const [lignes, setLignes] = useState<NewNoteLigne[]>([]);
  const [remiseType, setRemiseType] = useState<RemiseType | "">("");
  const [remiseValeur, setRemiseValeur] = useState("");

  const editionId = edition?.id ?? null;

  // Recopie la facture à modifier dans les champs ; un retour à `null` (fin
  // d'édition, enregistrement réussi) remet le formulaire à vide.
  useEffect(() => {
    if (!edition) {
      setClientId("");
      setDateEmission(aujourdhui());
      setEcheance("");
      setLignes([]);
      setRemiseType("");
      setRemiseValeur("");
      return;
    }
    const { note, lignes: lignesNote } = edition.detail;
    setClientId(String(note.client_id));
    setDateEmission(note.date_emission);
    setEcheance(note.echeance ?? "");
    setRemiseType(note.remise_type ?? "");
    setRemiseValeur(note.remise_type ? String(note.remise_valeur) : "");
    setLignes(
      lignesNote.map((l) => ({
        prestation_id: l.prestation_id,
        quantite: l.quantite,
      })),
    );
  }, [edition]);

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

  /** Saisie directe de la quantité (auparavant : un clic par unité). */
  function changerQuantite(prestationId: number, valeur: string) {
    const q = valeur === "" ? 0 : Number(valeur);
    if (!Number.isInteger(q) || q < 0) return;
    setLignes((ls) =>
      ls.map((l) =>
        l.prestation_id === prestationId ? { ...l, quantite: q } : l,
      ),
    );
  }

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    onErreur(null);
    if (!clientId || lignes.length === 0) {
      onErreur("Sélectionnez un client et au moins une prestation.");
      return;
    }
    if (lignes.some((l) => l.quantite <= 0)) {
      onErreur("Chaque prestation doit avoir une quantité d'au moins 1.");
      return;
    }
    if (!dateEmission) {
      onErreur("Date d'émission requise");
      return;
    }
    if (echeance && echeance < dateEmission) {
      onErreur("L'échéance ne peut pas précéder la date d'émission.");
      return;
    }
    let valeurRemise = 0;
    if (remiseType) {
      const v = parseMontant(remiseValeur);
      if (v === null || v < 0) {
        onErreur("Remise invalide");
        return;
      }
      if (remiseType === "pourcent" && v > 100) {
        onErreur("La remise ne peut pas dépasser 100 %.");
        return;
      }
      valeurRemise = v;
    }
    onSubmit({
      client_id: Number(clientId),
      date_emission: dateEmission,
      echeance: echeance || null,
      lignes,
      remise_type: remiseType || null,
      remise_valeur: valeurRemise,
    });
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

  return (
    <form className="carte-form" onSubmit={soumettre}>
      <h3 className="form-titre">
        {editionId !== null ? "Modifier la facture" : "Nouvelle facture"}
      </h3>
      {editionId !== null && (
        <p className="aide">
          Les prestations reprennent leur prix actuel ; la référence reste
          inchangée.
        </p>
      )}
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
          <span>Date d'émission</span>
          <input
            type="date"
            value={dateEmission}
            onChange={(e) => setDateEmission(e.target.value)}
            required
          />
        </label>
        <label>
          <span>Échéance (facultatif)</span>
          <input
            type="date"
            value={echeance}
            min={dateEmission || undefined}
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
        {prestationsActives.map((p) => (
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
        {prestationsActives.length === 0 && (
          <span className="aide">Aucune prestation : créez-en d'abord.</span>
        )}
      </div>

      {lignes.length > 0 && (
        <ul className="lignes">
          {lignes.map((l) => {
            const p = prestations.find((pr) => pr.id === l.prestation_id);
            return (
              <li key={l.prestation_id}>
                <span className="ligne-gauche">
                  {p?.libelle}
                  <span className="ligne-qte">
                    ×
                    <input
                      type="number"
                      min={1}
                      step={1}
                      aria-label={`Quantité pour ${p?.libelle ?? "la prestation"}`}
                      value={l.quantite === 0 ? "" : l.quantite}
                      onChange={(e) =>
                        changerQuantite(l.prestation_id, e.target.value)
                      }
                    />
                  </span>
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
        <button type="submit" className="btn-primary" disabled={envoi}>
          {envoi
            ? "Enregistrement…"
            : editionId !== null
              ? "Enregistrer les modifications"
              : "Créer la facture"}
        </button>
        {editionId !== null && (
          <button type="button" onClick={onAbandon}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
