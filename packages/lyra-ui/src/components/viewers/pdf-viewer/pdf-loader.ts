import { unwrapOptionalPeerDefault } from '../../../internal/optional-peer-capabilities.js';

export interface PdfRenderTaskApi {
  promise: Promise<void>;
  cancel(): void;
}

export interface PdfViewportApi {
  width: number;
  height: number;
}

export interface PdfPageApi {
  getViewport(options: { scale: number }): PdfViewportApi;
  getTextContent(): Promise<{ items: unknown[] }>;
  streamTextContent?(): unknown;
  render(options: Record<string, unknown>): PdfRenderTaskApi;
}

export interface PdfOutlineEntryApi {
  title?: string;
  dest?: unknown;
  items?: PdfOutlineEntryApi[];
}

export interface PdfDocumentApi {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageApi>;
  getOutline?(): Promise<PdfOutlineEntryApi[] | null>;
  getDestination(name: string): Promise<unknown>;
  getPageIndex(reference: unknown): Promise<number>;
  destroy?(): Promise<void> | void;
}

export interface PdfTextLayerApi {
  render(): Promise<void>;
  cancel(): void;
}

/** Structural pdfjs-dist capability kept optional for core-package consumers. */
export interface PdfJsApi {
  getDocument(options: { data: ArrayBuffer }): { promise: Promise<PdfDocumentApi> };
  GlobalWorkerOptions: { workerSrc: string };
  TextLayer?: new (options: {
    textContentSource: unknown;
    container: HTMLElement;
    viewport: PdfViewportApi;
  }) => PdfTextLayerApi;
}

function isPdfJsApi(value: unknown): value is PdfJsApi {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'getDocument' in value &&
    typeof value.getDocument === 'function' &&
    'GlobalWorkerOptions' in value &&
    (typeof value.GlobalWorkerOptions === 'object' ||
      typeof value.GlobalWorkerOptions === 'function') &&
    value.GlobalWorkerOptions !== null
  );
}

let pdfjs: Promise<PdfJsApi | null> | undefined;

export async function loadPdfJsDeps(
  importPdfjs: () => Promise<unknown> = () => import('pdfjs-dist'),
): Promise<PdfJsApi | null> {
  try {
    const module = await importPdfjs();
    const direct = isPdfJsApi(module) ? module : undefined;
    const defaultExport = unwrapOptionalPeerDefault(module);
    const pdfjsLib = direct ?? (isPdfJsApi(defaultExport) ? defaultExport : null);
    if (!pdfjsLib) return null;
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
