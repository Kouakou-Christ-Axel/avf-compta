import { describe, it, expect } from "vitest";
import { toCsv, parseCsv } from "./csv";

describe("toCsv", () => {
  it("échappe les séparateurs, guillemets et retours à la ligne", () => {
    const csv = toCsv(
      ["nom", "adresse"],
      [
        ["Dupont", "Cocody; Angré"],
        ['Guy "Le Bref"', "Ligne 1\nLigne 2"],
      ],
    );
    // BOM en tête pour qu'Excel lise les accents.
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Cocody; Angré"');
    expect(csv).toContain('"Guy ""Le Bref"""');
  });
});

describe("parseCsv", () => {
  it("lit le format produit par l'application (point-virgule)", () => {
    expect(parseCsv("nom;montant\nDupont;5000")).toEqual([
      ["nom", "montant"],
      ["Dupont", "5000"],
    ]);
  });

  // Le séparateur se décidait sur la présence d'un « ; » n'importe où dans le
  // fichier : une seule adresse en contenant un faisait basculer tout un CSV
  // en virgules et décalait silencieusement les colonnes.
  it("garde la virgule quand un point-virgule n'apparaît que dans une cellule", () => {
    const csv = 'nom,adresse\n"Dupont","Cocody; Angré"\nMartin,Plateau';
    expect(parseCsv(csv)).toEqual([
      ["nom", "adresse"],
      ["Dupont", "Cocody; Angré"],
      ["Martin", "Plateau"],
    ]);
  });

  it("ignore la marque d'ordre des octets en tête de fichier", () => {
    expect(parseCsv("﻿nom;ville\nDupont;Abidjan")).toEqual([
      ["nom", "ville"],
      ["Dupont", "Abidjan"],
    ]);
  });

  it("conserve les valeurs à l'aller-retour", () => {
    const lignes = [
      ["Dupont", "Cocody; Angré"],
      ['Guy "Le Bref"', "Plateau, Abidjan"],
      ["Sans adresse", ""],
    ];
    expect(parseCsv(toCsv(["nom", "adresse"], lignes))).toEqual([
      ["nom", "adresse"],
      ...lignes,
    ]);
  });
});
