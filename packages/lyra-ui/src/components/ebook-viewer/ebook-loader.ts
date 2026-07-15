import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';

export type EpubFactory = OptionalPeerApi;
export type EpubBook = OptionalPeerApi;
export type EpubRendition = OptionalPeerApi;

let epubModule: Promise<EpubFactory | null> | undefined;

export async function loadEpubJs(
  importEpub: () => Promise<{ default: EpubFactory } | EpubFactory> = () =>
    import('epubjs') as Promise<{ default: EpubFactory }>,
): Promise<EpubFactory | null> {
  try {
    const mod = await importEpub();
    return ('default' in mod ? mod.default : mod) as EpubFactory;
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
