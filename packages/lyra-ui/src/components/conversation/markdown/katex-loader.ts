import { createOptionalPeerLoader, hasPeerMethods } from '../../../internal/optional-peer-capabilities.js';

/** Re-exported under a component-scoped name -- what `<lr-markdown>`'s `math` option needs from
 *  the optional `katex` peer (`renderToString(tex, options)`). */
export interface KatexApi {
  renderToString(tex: string, options?: Record<string, unknown>): string;
}

function isKatexApi(value: unknown): value is KatexApi {
  return hasPeerMethods(value, 'renderToString');
}

const katex = /* @__PURE__ */ createOptionalPeerLoader<KatexApi>({
  cache: 'generation',
  load: () => import('katex'),
  isCapability: isKatexApi,
  warningKey: 'lyra-markdown-katex-unavailable',
  warning:
    '<lr-markdown>/<lr-markdown-core>: The optional KaTeX peer could not be resolved to a math renderer. TeX is rendered as literal text.',
  failedWarning:
    '<lr-markdown>/<lr-markdown-core>: Math rendering is unavailable because the optional KaTeX peer could not load. TeX is rendered as literal text.',
});

let configuredImporter: (() => Promise<unknown>) | undefined;
let cacheGeneration: unknown;
const KATEX_CACHE_GENERATION = Symbol.for('@aceshooting/lyra-ui/markdown-katex-cache-generation');

/**
 * Loads the optional peer dependency `katex`, used by `<lr-markdown>`'s `math` property to
 * render `$...$`/`$$...$$` TeX as MathML. Resolves `null` with a one-time development diagnostic
 * if the peer isn't installed -- rendering falls back to the literal, unparsed TeX source in that
 * case, a fully supported default rather than a degraded mode. Shares one import per generation,
 * retrying a rejected chunk on the next request.
 */
export function getKatex(importKatex?: () => Promise<unknown>): Promise<KatexApi | null> {
  const generation = Reflect.get(globalThis, KATEX_CACHE_GENERATION);
  if (generation !== cacheGeneration || (importKatex && importKatex !== configuredImporter)) {
    cacheGeneration = generation;
    configuredImporter = importKatex;
    katex.override(importKatex);
  }
  return katex.load();
}
