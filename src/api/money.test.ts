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

  it("rejette les décimales et les saisies invalides", () => {
    expect(parseMontant("")).toBeNull();
    expect(parseMontant("abc")).toBeNull();
    expect(parseMontant("1,50")).toBeNull();
    expect(parseMontant("1.5")).toBeNull();
  });
});
