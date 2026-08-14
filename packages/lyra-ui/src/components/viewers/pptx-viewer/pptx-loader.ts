import { resolveOptionalPeerCapability } from '../../../internal/optional-peer-capabilities.js';

export interface PptxViewerApi extends EventTarget {
  slideCount: number;
  currentSlideIndex: number;
  goToSlide(index: number): Promise<void> | void;
  searchText(query: string, options?: { matchCase?: boolean }): PptxTextSearchResult[];
  highlightSearchResult(
    result: PptxTextSearchResult,
    options?: { scrollIntoView?: boolean | ScrollIntoViewOptions },
  ): Promise<PptxSearchHighlightHandle | null>;
  renderThumbnailToContainer(
    index: number,
    container: HTMLElement,
    options?: { width?: number },
  ): PptxThumbnailHandle | null;
  clearSearchHighlights(): void;
  destroy(): void;
}

/** Correlated, model-level events emitted by the validated PPTX adapter. */
export type PptxViewerAdapterEvent =
  | { readonly kind: 'slide-change'; readonly index: number }
  | {
      readonly kind: 'diagnostic';
      readonly code: 'pptx-slide-render-error' | 'pptx-node-render-error';
      readonly cause: unknown;
      readonly fatal: boolean;
      readonly page?: number;
      readonly nodeId?: string;
    };

/**
 * Renderer-neutral, model-first surface consumed by `<lr-pptx-viewer>`. Peer DOM windowing stays
 * behind this adapter; complete-model search, navigation, highlight handles and correlated render
 * diagnostics are the only capabilities the component observes.
 */
export interface PptxViewerAdapter {
  readonly slideCount: number;
  readonly currentSlideIndex: number;
  goToSlide(index: number): Promise<void>;
  searchText(query: string, options?: { matchCase?: boolean }): PptxTextSearchResult[];
  highlightSearchResult(
    result: PptxTextSearchResult,
    options?: { scrollIntoView?: boolean | ScrollIntoViewOptions },
  ): Promise<PptxSearchHighlightHandle | null>;
  renderThumbnailToContainer(
    index: number,
    container: HTMLElement,
    options?: { width?: number },
  ): PptxThumbnailHandle | null;
  clearSearchHighlights(): void;
  subscribe(listener: (event: PptxViewerAdapterEvent) => void): () => void;
  destroy(): void;
}

/** Stable subset of the renderer's model-level result used by Lyra's window-safe search adapter. */
export interface PptxTextSearchResult {
  readonly slideIndex: number;
  readonly nodeId: string;
  readonly matchStart: number;
  readonly matchEnd: number;
  readonly text: string;
}

/** Renderer-owned overlay handle; Lyra disposes it on navigation, clear, replacement, and detach. */
export interface PptxSearchHighlightHandle {
  dispose(): void;
}

/** Renderer-owned external slide preview; its asynchronous resources settle through `ready`. */
export interface PptxThumbnailHandle {
  readonly ready: Promise<void>;
  dispose(): void;
}

export interface PptxRendererModule {
  PptxViewer: {
    open(
      input: ArrayBuffer,
      container: HTMLElement,
      options?: Record<string, unknown>,
    ): Promise<PptxViewerApi>;
  };
  RECOMMENDED_ZIP_LIMITS: Readonly<PptxZipLimits>;
}

export interface PptxZipLimits {
  maxEntries: number;
  maxEntryUncompressedBytes: number;
  maxTotalUncompressedBytes: number;
  maxMediaBytes: number;
  maxConcurrency: number;
}

const MAX_SAFE_PPTX_ZIP_LIMITS: Readonly<PptxZipLimits> = {
  maxEntries: 4_000,
  maxEntryUncompressedBytes: 32 * 1024 * 1024,
  maxTotalUncompressedBytes: 256 * 1024 * 1024,
  maxMediaBytes: 192 * 1024 * 1024,
  maxConcurrency: 8,
};

let modulePromise: Promise<PptxRendererModule | null> | undefined;

function hasPptxOpenCapability(value: unknown): value is PptxRendererModule {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return false;
  const viewer = (value as { PptxViewer?: unknown }).PptxViewer;
  if ((typeof viewer !== 'object' && typeof viewer !== 'function') || viewer === null) return false;
  if (typeof (viewer as { open?: unknown }).open !== 'function') return false;
  const limits = (value as { RECOMMENDED_ZIP_LIMITS?: unknown }).RECOMMENDED_ZIP_LIMITS;
  if (typeof limits !== 'object' || limits === null) return false;
  return (Object.keys(MAX_SAFE_PPTX_ZIP_LIMITS) as Array<keyof PptxZipLimits>).every((key) => {
    const candidate = (limits as Partial<PptxZipLimits>)[key];
    return Number.isSafeInteger(candidate) && candidate! > 0 && candidate! <= MAX_SAFE_PPTX_ZIP_LIMITS[key];
  });
}

/** Validates and isolates the instance capabilities Lyra relies on after `open()`. */
export function adaptPptxViewer(value: unknown): PptxViewerAdapter | null {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return null;
  const candidate = value as Partial<PptxViewerApi>;
  if (
    !Number.isSafeInteger(candidate.slideCount)
    || candidate.slideCount! < 0
    || !Number.isSafeInteger(candidate.currentSlideIndex)
    || typeof candidate.goToSlide !== 'function'
    || typeof candidate.searchText !== 'function'
    || typeof candidate.highlightSearchResult !== 'function'
    || typeof candidate.renderThumbnailToContainer !== 'function'
    || typeof candidate.clearSearchHighlights !== 'function'
    || typeof candidate.destroy !== 'function'
    || typeof candidate.addEventListener !== 'function'
    || typeof candidate.removeEventListener !== 'function'
  ) return null;
  const viewer = candidate as PptxViewerApi;
  const listeners = new Set<(event: PptxViewerAdapterEvent) => void>();
  let destroyed = false;
  const emit = (event: PptxViewerAdapterEvent): void => {
    for (const listener of listeners) listener(event);
  };
  const onSlideChange = (event: Event): void => {
    const index = (event as CustomEvent<{ index?: unknown }>).detail?.index;
    if (typeof index === 'number' && Number.isSafeInteger(index) && index >= 0 && index < viewer.slideCount) {
      emit(Object.freeze({ kind: 'slide-change', index }));
    }
  };
  const onSlideError = (event: Event): void => {
    const detail = (event as CustomEvent<{
      index?: unknown;
      error?: unknown;
      fatal?: unknown;
    }>).detail;
    const page = typeof detail?.index === 'number'
      && Number.isSafeInteger(detail.index)
      && detail.index >= 0
      && detail.index < viewer.slideCount
      ? detail.index + 1
      : undefined;
    const normalized: PptxViewerAdapterEvent = {
      kind: 'diagnostic',
      code: 'pptx-slide-render-error',
      cause: detail?.error,
      fatal: detail?.fatal === true,
      ...(page === undefined ? {} : { page }),
    };
    emit(Object.freeze(normalized));
  };
  const onNodeError = (event: Event): void => {
    const detail = (event as CustomEvent<{
      nodeId?: unknown;
      error?: unknown;
      fatal?: unknown;
    }>).detail;
    const nodeId = typeof detail?.nodeId === 'string' && detail.nodeId.length <= 1_024
      ? detail.nodeId
      : undefined;
    const normalized: PptxViewerAdapterEvent = {
      kind: 'diagnostic',
      code: 'pptx-node-render-error',
      cause: detail?.error,
      fatal: detail?.fatal === true,
      ...(nodeId === undefined ? {} : { nodeId }),
    };
    emit(Object.freeze(normalized));
  };
  viewer.addEventListener('slidechange', onSlideChange);
  viewer.addEventListener('slideerror', onSlideError);
  viewer.addEventListener('nodeerror', onNodeError);

  return Object.freeze({
    get slideCount() { return viewer.slideCount; },
    get currentSlideIndex() { return viewer.currentSlideIndex; },
    goToSlide: async (index: number) => { await viewer.goToSlide(index); },
    searchText: (query: string, options?: { matchCase?: boolean }) => viewer.searchText(query, options),
    highlightSearchResult: async (
      result: PptxTextSearchResult,
      options?: { scrollIntoView?: boolean | ScrollIntoViewOptions },
    ) => viewer.highlightSearchResult(result, options),
    renderThumbnailToContainer(
      index: number,
      container: HTMLElement,
      options?: { width?: number },
    ): PptxThumbnailHandle | null {
      if (!Number.isSafeInteger(index) || index < 0 || index >= viewer.slideCount) return null;
      const width = options?.width;
      if (width !== undefined && (!Number.isFinite(width) || width <= 0)) return null;
      const raw = viewer.renderThumbnailToContainer(index, container, options);
      if (!raw || typeof raw.dispose !== 'function' || typeof raw.ready?.then !== 'function') return null;
      let disposed = false;
      return Object.freeze({
        ready: Promise.resolve(raw.ready),
        dispose() {
          if (disposed) return;
          disposed = true;
          raw.dispose();
        },
      });
    },
    clearSearchHighlights: () => viewer.clearSearchHighlights(),
    subscribe(listener: (event: PptxViewerAdapterEvent) => void) {
      if (destroyed) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      viewer.removeEventListener('slidechange', onSlideChange);
      viewer.removeEventListener('slideerror', onSlideError);
      viewer.removeEventListener('nodeerror', onNodeError);
      listeners.clear();
      viewer.destroy();
    },
  });
}

export async function loadPptxRenderer(
  importer: () => Promise<unknown> = () => import('@aiden0z/pptx-renderer'),
): Promise<PptxRendererModule | null> {
  try {
    const module = await importer();
    return resolveOptionalPeerCapability(module, hasPptxOpenCapability);
  } catch (error) {
    console.warn('The optional `@aiden0z/pptx-renderer` peer is required to render PPTX files.', error);
    return null;
  }
}

export function getPptxRenderer(): Promise<PptxRendererModule | null> {
  if (!modulePromise) modulePromise = loadPptxRenderer();
  return modulePromise;
}

/** @internal */
export function __setPptxRendererForTesting(module: PptxRendererModule | null | undefined): void {
  modulePromise = module === undefined ? undefined : Promise.resolve(module);
}
