import type { RemiseType } from "../../api/types";

/**
 * Montant de remise appliqué, miroir de la vue SQL `note_totaux` : arrondi au
 * franc le plus proche (le XOF n'a pas de centime) et borné à `[0, brut]`.
 *
 * Sert uniquement à l'aperçu pendant la saisie — le montant qui fait foi est
 * calculé par la base. Les deux implémentations doivent rester d'accord :
 * `calculerRemise.test.ts` rejoue les cas des tests Rust.
 */
export function calculerRemise(
  brut: number,
  type: RemiseType | null,
  valeur: number,
): number {
  if (!type || valeur <= 0) return 0;
  const brute =
    type === "pourcent" ? Math.floor((brut * valeur + 50) / 100) : valeur;
  return Math.min(Math.max(brute, 0), brut);
}
