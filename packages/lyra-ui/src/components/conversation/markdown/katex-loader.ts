import type { OptionalPeerApi } from '../../../internal/optional-peer-types.js';

/** Re-exported under a component-scoped name -- what `<lr-markdown>`'s `math` option needs from
 *  the optional `katex` peer (`renderToString(tex, options)`). */
export type KatexApi = OptionalPeerApi;

let cached: Promise<KatexApi | null> | undefined;

/**
 * Loads the optional peer dependency `katex`, used by `<lr-markdown>`'s `math` property to
 * render `$...$`/`$$...$$` TeX as MathML. Resolves `null` (with a one-time `console.warn`) if the
 * peer isn't installed -- rendering falls back to the literal, unparsed TeX source in that case,
 * a fully supported default rather than a degraded mode. Mirrors `dompurify-loader.ts`'s single-
 * optional-peer shape.
 */
export async function loadKatex(
  importKatex: () => Promise<{ default: KatexApi } | KatexApi> = () =>
    import('katex') as Promise<{ default: KatexApi }>,
): Promise<KatexApi | null> {
  try {
    const mod = await importKatex();
    return ('default' in mod ? mod.default : mod) as KatexApi;
  } catch (error) {
    console.warn(
      '<lr-markdown> needs the optional peer dependency `katex` to render math (the `math` property is set) — install it with `pnpm add katex`:',
      error,
    );
    return null;
  }
}

/**
 * Lazily loads `katex` once per page, caching the resolved module (or `null`) across every
 * `<lr-markdown>` instance -- mirrors `markdown-loader.ts`'s `loadMarkdownDeps()`/
 * `getMarkdownDepsIfLoaded()` cached-promise shape for a single optional peer.
 */
export function getKatex(importKatex?: () => Promise<{ default: KatexApi } | KatexApi>): Promise<KatexApi | null> {
  if (!cached) cached = loadKatex(importKatex);
  return cached;
}

/** @internal Test-only cache reset. */
export function clearKatexCache(): void {
  cached = undefined;
}
