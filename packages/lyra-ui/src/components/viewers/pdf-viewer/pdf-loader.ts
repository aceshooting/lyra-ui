import type { OptionalPeerApi } from '../../../internal/optional-peer-types.js';

/** Opaque pdfjs-dist surface kept optional for core-package consumers. */
export type PdfJsApi = OptionalPeerApi;

let pdfjs: Promise<PdfJsApi | null> | undefined;

export async function loadPdfJsDeps(
  importPdfjs: () => Promise<PdfJsApi> = () => import('pdfjs-dist') as Promise<PdfJsApi>,
): Promise<PdfJsApi | null> {
  try {
    const pdfjsLib = await importPdfjs();
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    return pdfjsLib;
  } catch (error) {
    console.warn(
      '<lr-pdf-viewer> needs the optional peer dependency `pdfjs-dist` to render PDF documents — install it with `pnpm add pdfjs-dist`:',
      error,
    );
    return null;
  }
}

export function loadPdfJs(): Promise<PdfJsApi | null> {
  if (!pdfjs) pdfjs = loadPdfJsDeps();
  return pdfjs;
}

/** @internal Test-only cache reset. */
export function clearPdfJsCache(): void {
  pdfjs = undefined;
}
