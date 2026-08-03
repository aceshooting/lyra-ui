import { resolveOptionalPeerCapability } from '../../../internal/optional-peer-capabilities.js';

export interface EpubNavigationItem {
  id?: string;
  href: string;
  label?: string;
  subitems?: EpubNavigationItem[];
}

export interface EpubSearchResult {
  cfi: string;
  excerpt?: string;
}

export interface EpubSpineItem {
  load(request?: unknown): Promise<unknown> | unknown;
  find(query: string): Promise<EpubSearchResult[]> | EpubSearchResult[];
  unload(): void;
}

export interface EpubContents {
  window?: Window;
}

export interface EpubLocation {
  start?: { cfi?: string; href?: string };
}

export interface EpubAnnotations {
  highlight(
    cfi: string,
    data: Record<string, unknown>,
    callback?: (() => void) | undefined,
    className?: string,
    styles?: Record<string, unknown>,
  ): unknown;
  remove(cfi: string, type: string): void;
}

export interface EpubRendition {
  annotations: EpubAnnotations;
  display(target?: string): Promise<void>;
  prev(): Promise<void>;
  next(): Promise<void>;
  on(type: 'relocated', callback: (location: EpubLocation) => void): void;
  on(type: 'selected', callback: (cfiRange: string, contents: EpubContents) => void): void;
}

export interface EpubBook {
  ready: Promise<void>;
  navigation?: { toc?: EpubNavigationItem[] };
  spine?: { spineItems?: EpubSpineItem[] };
  load(...args: unknown[]): Promise<unknown>;
  renderTo(element: Element, options?: Record<string, unknown>): EpubRendition;
  destroy(): void;
}

export type EpubFactory = (data: ArrayBuffer) => EpubBook;

function isEpubFactory(value: unknown): value is EpubFactory {
  return typeof value === 'function';
}

let epubModule: Promise<EpubFactory | null> | undefined;

export async function loadEpubJs(
  importEpub: () => Promise<unknown> = () => import('epubjs'),
): Promise<EpubFactory | null> {
  try {
    return resolveOptionalPeerCapability(await importEpub(), isEpubFactory);
  } catch (error) {
    console.warn('The optional `epubjs` peer is required to render EPUB files.', error);
    return null;
  }
}

export function getEpubJs(): Promise<EpubFactory | null> {
  if (!epubModule) epubModule = loadEpubJs();
  return epubModule;
}

/** @internal */
export function __setEpubJsForTesting(factory: EpubFactory | null | undefined): void {
  epubModule = factory === undefined ? undefined : Promise.resolve(factory);
}
