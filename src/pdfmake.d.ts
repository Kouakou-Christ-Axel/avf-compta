// Les sous-chemins « build » de pdfmake ne sont pas typés par @types/pdfmake.
declare module "pdfmake/build/pdfmake" {
  import type { TDocumentDefinitions } from "pdfmake/interfaces";
  interface PdfDoc {
    download(defaultFileName?: string): void;
    print(): void;
    getBlob(cb: (blob: Blob) => void): void;
  }
  const pdfMake: {
    vfs: Record<string, string>;
    addVirtualFileSystem(vfs: Record<string, string>): void;
    createPdf(documentDefinition: TDocumentDefinitions): PdfDoc;
  };
  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts" {
  const vfs: Record<string, string>;
  export default vfs;
}
