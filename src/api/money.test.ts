import { describe, it, expect } from "vitest";
import { formatMontant, parseMontant } from "./money";

describe("formatMontant", () => {
  it("formate en FCFA à la française", () => {
    expect(formatMontant(150000)).toBe("150 000 FCFA");
    expect(formatMontant(0)).toBe("0 FCFA");
    expect(formatMontant(500)).toBe("500 FCFA");
    expect(formatMontant(1000)).toBe("1 000 FCFA");
    expect(formatMontant(12345678)).toBe("12 345 678 FCFA");
  });

  it("gère les montants négatifs", () => {
    expect(formatMontant(-150000)).toBe("-150 000 FCFA");
  });
});

describe("parseMontant", () => {
  it("accepte les formats groupés et simples", () => {
    expect(parseMontant("150 000")).toBe(150000);
    expect(parseMontant("150000")).toBe(150000);
    expect(parseMontant("500")).toBe(500);
  });

  // « 5.000 » et « 5,000 » sont des saisies courantes ; elles étaient rejetées
  // et le montant n'était alors enregistré nulle part.
  it("accepte le point et la virgule comme séparateurs de milliers", () => {
    expect(parseMontant("5.000")).toBe(5000);
    expect(parseMontant("5,000")).toBe(5000);
    expect(parseMontant("1.250.000")).toBe(1250000);
    expect(parseMontant("1,250,000")).toBe(1250000);
    expect(parseMontant("-2.500")).toBe(-2500);
  });

  it("rejette les décimales et les saisies invalides", () => {
    expect(parseMontant("")).toBeNull();
    expect(parseMontant("abc")).toBeNull();
    expect(parseMontant("1,50")).toBeNull();
    expect(parseMontant("1.5")).toBeNull();
    expect(parseMontant("5,50")).toBeNull();
    expect(parseMontant("1.2345")).toBeNull();
    expect(parseMontant("1.250,000")).toBeNull();
    expect(parseMontant(".500")).toBeNull();
    expect(parseMontant("1234.567")).toBeNull();
  });
});
