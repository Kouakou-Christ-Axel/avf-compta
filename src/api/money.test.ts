import { describe, it, expect } from "vitest";
import { formatEuros, parseEuros } from "./money";

describe("formatEuros", () => {
  it("formate à la française", () => {
    expect(formatEuros(123456)).toBe("1 234,56 €");
    expect(formatEuros(0)).toBe("0,00 €");
    expect(formatEuros(5)).toBe("0,05 €");
    expect(formatEuros(100)).toBe("1,00 €");
    expect(formatEuros(1000000)).toBe("10 000,00 €");
  });

  it("gère les montants négatifs", () => {
    expect(formatEuros(-123456)).toBe("-1 234,56 €");
  });
});

describe("parseEuros", () => {
  it("accepte les formats français et simples", () => {
    expect(parseEuros("1 234,56")).toBe(123456);
    expect(parseEuros("1234.56")).toBe(123456);
    expect(parseEuros("12")).toBe(1200);
    expect(parseEuros("0,05")).toBe(5);
  });

  it("arrondit au centime le plus proche", () => {
    expect(parseEuros("1,005")).toBe(101);
    expect(parseEuros("1,004")).toBe(100);
  });

  it("rejette les saisies invalides", () => {
    expect(parseEuros("")).toBeNull();
    expect(parseEuros("abc")).toBeNull();
    expect(parseEuros("1.2.3")).toBeNull();
  });
});
