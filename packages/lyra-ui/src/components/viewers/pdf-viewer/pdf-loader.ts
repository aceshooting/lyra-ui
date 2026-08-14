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

type WorkerModuleResolver = (specifier: string) => string | null | undefined;

function defaultWorkerModuleResolver(specifier: string): string | null {
  const resolver = (import.meta as ImportMeta & {
    resolve?: (value: string) => string;
  }).resolve;
  if (!resolver) return null;
  try {
    return resolver(specifier);
  } catch {
    return null;
  }
}

function safeWorkerModuleUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'blob:', 'file:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export async function loadPdfJsDeps(
  importPdfjs: () => Promise<unknown> = () => import('pdfjs-dist'),
  resolveWorkerModule: WorkerModuleResolver = defaultWorkerModuleResolver,
): Promise<PdfJsApi | null> {
  try {
    const module = await importPdfjs();
    const direct = isPdfJsApi(module) ? module : undefined;
    const defaultExport = unwrapOptionalPeerDefault(module);
    const pdfjsLib = direct ?? (isPdfJsApi(defaultExport) ? defaultExport : null);
    if (!pdfjsLib) return null;
    // `GlobalWorkerOptions` belongs to the consumer's singleton PDF.js module. Never overwrite a
    // worker they configured. When it is unset, resolve the peer's worker module through the
    // runtime/import-map resolver; concatenating the bare package specifier onto this library's
    // own `import.meta.url` produces a URL inside Lyra's dist tree where no worker exists.
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      const workerSrc = safeWorkerModuleUrl(
        resolveWorkerModule('pdfjs-dist/build/pdf.worker.min.mjs'),
      );
      if (workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    }
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
