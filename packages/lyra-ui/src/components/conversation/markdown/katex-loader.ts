import { createOptionalPeerLoader } from '../../../internal/optional-peer-capabilities.js';

/** Re-exported under a component-scoped name -- what `<lr-markdown>`'s `math` option needs from
 *  the optional `katex` peer (`renderToString(tex, options)`). */
export interface KatexApi {
  renderToString(tex: string, options?: Record<string, unknown>): string;
}

function isKatexApi(value: unknown): value is KatexApi {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'renderToString' in value &&
    typeof value.renderToString === 'function'
  );
}

const katex = /* @__PURE__ */ createOptionalPeerLoader<KatexApi>({
  load: () => import('katex'),
  isCapability: isKatexApi,
  warningKey: 'lyra-markdown-katex-unavailable',
  warning:
    '<lr-markdown>/<lr-markdown-core>: Math rendering is unavailable because the optional KaTeX peer could not load. TeX is rendered as literal text.',
});

let cached: Promise<KatexApi | null> | undefined;
let cacheGeneration: unknown;
const KATEX_CACHE_GENERATION = Symbol.for('@aceshooting/lyra-ui/markdown-katex-cache-generation');

/**
 * Loads the optional peer dependency `katex`, used by `<lr-markdown>`'s `math` property to
 * render `$...$`/`$$...$$` TeX as MathML. Resolves `null` with a one-time development diagnostic
 * if the peer isn't installed -- rendering falls back to the literal, unparsed TeX source in that
 * case, a fully supported default rather than a degraded mode.
 */
export function loadKatex(importKatex?: () => Promise<unknown>): Promise<KatexApi | null> {
  return katex.loadWith(importKatex);
}

/**
 * Lazily loads `katex` once per page, caching the resolved module (or `null`) across every
 * `<lr-markdown>` instance -- mirrors `markdown-loader.ts`'s `loadMarkdownDeps()`/
 * `getMarkdownDepsIfLoaded()` cached-promise shape for a single optional peer.
 */
export function getKatex(importKatex?: () => Promise<unknown>): Promise<KatexApi | null> {
  const generation = Reflect.get(globalThis, KATEX_CACHE_GENERATION);
  if (generation !== cacheGeneration) {
    cached = undefined;
    cacheGeneration = generation;
  }
  if (!cached) cached = loadKatex(importKatex);
  return cached;
}
