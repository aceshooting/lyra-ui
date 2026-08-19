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

const PDF_WORKER_MODULE_SPECIFIER = 'pdfjs-dist/build/pdf.worker.min.mjs';
const ALLOWED_WORKER_PROTOCOLS = ['http:', 'https:', 'blob:', 'file:'];

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
    return ALLOWED_WORKER_PROTOCOLS.includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/** Resolves a worker URL written by the consuming application. Unlike the peer-module resolver's
 *  output this is routinely document-relative -- a bundler emits something like
 *  `/assets/pdf.worker-<hash>.mjs` -- so it resolves against the document base before passing
 *  through the same scheme allow-list. A bare package specifier still fails closed: it resolves
 *  against the document, which is a real (if wrong) URL rather than active content, and never
 *  reaches a `javascript:`/`data:` worker. */
function safeAuthoredWorkerUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, typeof document === 'undefined' ? undefined : document.baseURI);
    return ALLOWED_WORKER_PROTOCOLS.includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Points the consumer's PDF.js singleton at a worker, if and only if it does not already have one.
 *
 * `GlobalWorkerOptions` belongs to the consumer's singleton PDF.js module, so a worker they
 * configured themselves is never overwritten -- that check comes first, and short-circuits the
 * resolver entirely. When it is unset, an application-supplied URL wins over the peer's own worker
 * module resolved through the runtime/import-map resolver, because the former is a deliberate
 * statement about where that application actually shipped the worker chunk. Concatenating the bare
 * package specifier onto this library's own `import.meta.url` is never an option: it produces a URL
 * inside Lyra's dist tree where no worker exists.
 */
function configurePdfJsWorker(
  pdfjsLib: PdfJsApi,
  authoredWorkerSrc: string | null | undefined,
  resolveWorkerModule: WorkerModuleResolver,
): void {
  if (pdfjsLib.GlobalWorkerOptions.workerSrc) return;
  const workerSrc = safeAuthoredWorkerUrl(authoredWorkerSrc)
    ?? safeWorkerModuleUrl(resolveWorkerModule(PDF_WORKER_MODULE_SPECIFIER));
  if (workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

export async function loadPdfJsDeps(
  importPdfjs: () => Promise<unknown> = () => import('pdfjs-dist'),
  resolveWorkerModule: WorkerModuleResolver = defaultWorkerModuleResolver,
  workerSrc?: string | null,
): Promise<PdfJsApi | null> {
  try {
    const module = await importPdfjs();
    const direct = isPdfJsApi(module) ? module : undefined;
    const defaultExport = unwrapOptionalPeerDefault(module);
    const pdfjsLib = direct ?? (isPdfJsApi(defaultExport) ? defaultExport : null);
    if (!pdfjsLib) return null;
    configurePdfJsWorker(pdfjsLib, workerSrc, resolveWorkerModule);
    return pdfjsLib;
  } catch (error) {
    console.warn(
      '<lr-pdf-viewer> needs the optional peer dependency `pdfjs-dist` to render PDF documents — install it with `pnpm add pdfjs-dist`:',
      error,
    );
    return null;
  }
}

/**
 * Resolves the shared PDF.js module, optionally supplying the worker URL the consuming application
 * bundled for it.
 *
 * The module promise is memoized, so the first caller decides which module instance every viewer on
 * the page uses. A `workerSrc` handed to a later call is not therefore ignored: the worker
 * configuration is re-attempted against the already-resolved module, which still leaves an
 * already-configured `GlobalWorkerOptions.workerSrc` untouched. The net effect is that whichever
 * viewer loads first configures the worker for the whole page, and a later or newly-assigned
 * `workerSrc` only takes effect while the singleton is still unconfigured.
 */
export function loadPdfJs(workerSrc?: string | null): Promise<PdfJsApi | null> {
  if (!pdfjs) {
    pdfjs = loadPdfJsDeps(undefined, undefined, workerSrc);
    return pdfjs;
  }
  return pdfjs.then((pdfjsLib) => {
    if (pdfjsLib) configurePdfJsWorker(pdfjsLib, workerSrc, defaultWorkerModuleResolver);
    return pdfjsLib;
  });
}

/** @internal Test-only cache reset. */
export function clearPdfJsCache(): void {
  pdfjs = undefined;
}
