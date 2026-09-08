import { describe, it, expect } from "vitest";
import { calculerRemise } from "./calculerRemise";

/**
 * Ces cas rejouent ceux des tests Rust de `notes_service` : l'aperçu affiché
 * pendant la saisie doit annoncer exactement ce que la base facturera.
 */
describe("calculerRemise — parité avec la vue SQL note_totaux", () => {
  it("arrondit le pourcentage au franc, à partir d'un demi", () => {
    // Miroir de remise_pourcent_arrondie_au_franc : 1005 × 50 % = 502,5 → 503.
    expect(calculerRemise(1005, "pourcent", 50)).toBe(503);
  });

  it("applique un pourcentage exact", () => {
    // Miroir de remise_coherente_partout : 30 000 − 10 % = 27 000.
    expect(calculerRemise(30000, "pourcent", 10)).toBe(3000);
  });

  it("plafonne la remise en montant au brut", () => {
    // Miroir de remise_en_montant_et_plafonnement : le total ne devient jamais
    // négatif.
    expect(calculerRemise(10000, "montant", 99000)).toBe(10000);
    expect(calculerRemise(10000, "montant", 2500)).toBe(2500);
  });

  it("solde entièrement une facture remisée à 100 %", () => {
    expect(calculerRemise(30000, "pourcent", 100)).toBe(30000);
  });

  it("ne déduit rien sans type de remise ni valeur utile", () => {
    expect(calculerRemise(10000, null, 5000)).toBe(0);
    expect(calculerRemise(10000, "montant", 0)).toBe(0);
    expect(calculerRemise(10000, "pourcent", -10)).toBe(0);
  });
});
