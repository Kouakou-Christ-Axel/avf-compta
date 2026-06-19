import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import { formatMontant } from "./money";
import type { NoteDetail, Parametres, RecuDetail, SoldeNote } from "./types";

const COULEUR = "#1d4ed8";

/** En-tête « cabinet » (logo + nom + coordonnées) à gauche du document. */
function enteteCabinet(params?: Parametres | null): Content {
  const nom = params?.cabinet_nom || "avf-compta";
  const lignes: Content[] = [
    { text: nom, style: "marque" },
    { text: "Cabinet comptable", color: "#64748b" },
  ];
  if (params?.telephone) lignes.push({ text: params.telephone, fontSize: 9 });
  if (params?.email) lignes.push({ text: params.email, fontSize: 9 });

  const colonne: Content = { stack: lignes };
  if (params?.logo) {
    return {
      columns: [{ image: params.logo, width: 56, fit: [56, 56] }, colonne],
      columnGap: 12,
    };
  }
  return colonne;
}

/** Bloc des coordonnées de paiement, en pied de document. */
function piedPaiement(params?: Parametres | null): Content[] {
  if (!params?.coordonnees_paiement) return [];
  return [
    {
      margin: [0, 18, 0, 0],
      text: "Coordonnées de paiement",
      style: "section",
    },
    { text: params.coordonnees_paiement, fontSize: 10 },
  ];
}

/** Définition pdfmake d'une note de frais (fonction pure, testable). */
export function noteDocDefinition(
  detail: NoteDetail,
  clientNom: string,
  solde?: SoldeNote | null,
  params?: Parametres | null,
): TDocumentDefinitions {
  const ref = detail.note.reference ?? `#${detail.note.id}`;
  const corps: TableCell[][] = detail.lignes.map((l) => [
    l.libelle_snapshot,
    { text: String(l.quantite), alignment: "center" },
    { text: formatMontant(l.prix_snapshot), alignment: "right" },
    { text: formatMontant(l.prix_snapshot * l.quantite), alignment: "right" },
  ]);

  const soldeBloc: Content[] = solde
    ? [
        {
          margin: [0, 14, 0, 0],
          columns: [
            { text: "" },
            {
              width: "auto",
              table: {
                body: [
                  ["Payé", formatMontant(solde.paye)],
                  [
                    { text: "Reste à payer", bold: true },
                    { text: formatMontant(solde.solde), bold: true },
                  ],
                ],
              },
              layout: "noBorders",
              fontSize: 10,
            },
          ],
        },
      ]
    : [];

  return {
    info: { title: `Note ${ref}` },
    content: [
      {
        columns: [
          enteteCabinet(params),
          [
            { text: "NOTE DE FRAIS", style: "titre", alignment: "right" },
            { text: ref, alignment: "right", color: COULEUR, bold: true },
            {
              text: `Émise le ${detail.note.date_emission}`,
              alignment: "right",
              color: "#64748b",
              fontSize: 10,
            },
          ],
        ],
      },
      { text: "Client", style: "section", margin: [0, 18, 0, 2] },
      { text: clientNom, bold: true },
      {
        margin: [0, 16, 0, 0],
        table: {
          headerRows: 1,
          widths: ["*", "auto", "auto", "auto"],
          body: [
            [
              { text: "Désignation", style: "th" },
              { text: "Qté", style: "th", alignment: "center" },
              { text: "P.U.", style: "th", alignment: "right" },
              { text: "Montant", style: "th", alignment: "right" },
            ],
            ...corps,
          ],
        },
        layout: "lightHorizontalLines",
      },
      {
        margin: [0, 12, 0, 0],
        columns: [
          { text: "" },
          {
            width: "auto",
            text: `Total : ${formatMontant(detail.total)}`,
            bold: true,
            fontSize: 13,
            color: COULEUR,
          },
        ],
      },
      ...soldeBloc,
      ...piedPaiement(params),
    ],
    styles: {
      marque: { fontSize: 18, bold: true },
      titre: { fontSize: 14, bold: true },
      section: {
        fontSize: 9,
        bold: true,
        color: "#64748b",
        characterSpacing: 1,
      },
      th: { bold: true, fontSize: 10, color: "#334155" },
    },
    defaultStyle: { fontSize: 11 },
  };
}

/** Définition pdfmake d'un reçu de paiement. */
export function recuDocDefinition(
  recu: RecuDetail,
  params?: Parametres | null,
): TDocumentDefinitions {
  return {
    info: { title: `Reçu ${recu.numero}` },
    content: [
      {
        columns: [
          enteteCabinet(params),
          [
            { text: "REÇU DE PAIEMENT", style: "titre", alignment: "right" },
            {
              text: recu.numero,
              alignment: "right",
              color: COULEUR,
              bold: true,
            },
            {
              text: `Émis le ${recu.emis_le.slice(0, 10)}`,
              alignment: "right",
              color: "#64748b",
              fontSize: 10,
            },
          ],
        ],
      },
      { text: "Client", style: "section", margin: [0, 18, 0, 2] },
      { text: recu.client_nom, bold: true },
      ...(recu.client_email ? [{ text: recu.client_email }] : []),
      ...(recu.client_telephone ? [{ text: recu.client_telephone }] : []),
      {
        margin: [0, 16, 0, 0],
        table: {
          widths: ["*", "auto"],
          body: [
            ["Note de frais", recu.note_reference ?? `#${recu.note_id}`],
            ["Date du paiement", recu.date_paiement.slice(0, 10)],
            ...(recu.methode ? [["Mode de règlement", recu.methode]] : []),
          ],
        },
        layout: "lightHorizontalLines",
      },
      {
        margin: [0, 18, 0, 0],
        table: {
          widths: ["*", "auto"],
          body: [
            [
              { text: "Montant réglé", bold: true, fontSize: 13 },
              {
                text: formatMontant(recu.montant),
                bold: true,
                fontSize: 15,
                color: COULEUR,
                alignment: "right",
              },
            ],
          ],
        },
        layout: "noBorders",
      },
      {
        text: "Reçu pour le montant indiqué. Merci de votre confiance.",
        margin: [0, 18, 0, 0],
        fontSize: 9,
        color: "#64748b",
      },
    ],
    styles: {
      marque: { fontSize: 18, bold: true },
      titre: { fontSize: 14, bold: true },
      section: {
        fontSize: 9,
        bold: true,
        color: "#64748b",
        characterSpacing: 1,
      },
    },
    defaultStyle: { fontSize: 11 },
  };
}

/** Charge pdfmake (et ses polices) à la demande, puis télécharge le PDF. */
async function telecharger(def: TDocumentDefinitions, fichier: string) {
  const [{ default: pdfMake }, fonts] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  // pdfmake 0.3 expose la vfs comme export par défaut et l'enregistre via
  // addVirtualFileSystem (et non plus pdfMake.vfs).
  const vfs =
    (fonts as { default?: Record<string, string> }).default ??
    (fonts as unknown as Record<string, string>);
  if (vfs) {
    if (typeof pdfMake.addVirtualFileSystem === "function") {
      pdfMake.addVirtualFileSystem(vfs);
    } else {
      pdfMake.vfs = vfs;
    }
  }
  pdfMake.createPdf(def).download(fichier);
}

export function exportNotePdf(
  detail: NoteDetail,
  clientNom: string,
  solde?: SoldeNote | null,
  params?: Parametres | null,
) {
  const ref = detail.note.reference ?? `note-${detail.note.id}`;
  return telecharger(
    noteDocDefinition(detail, clientNom, solde, params),
    `${ref}.pdf`,
  );
}

export function exportRecuPdf(recu: RecuDetail, params?: Parametres | null) {
  return telecharger(recuDocDefinition(recu, params), `${recu.numero}.pdf`);
}
