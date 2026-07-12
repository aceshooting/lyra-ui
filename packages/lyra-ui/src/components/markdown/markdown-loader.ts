import type * as MarkedModule from 'marked';
import type DOMPurifyApi from 'dompurify';

/**
 * The two optional peers `<lyra-markdown>` needs, loaded independently (see
 * `loadMarkdownAndSanitizer()`). Either half can be `undefined` on its own —
 * a consumer who only installs `marked` (having explicitly opted out of
 * sanitization via `sanitize="false"`) is a valid, supported combination.
 */
export interface MarkdownDeps {
  marked: typeof MarkedModule | undefined;
  DOMPurify: typeof DOMPurifyApi | undefined;
}

let deps: Promise<MarkdownDeps> | undefined;

/**
 * Independently loads the optional peer dependencies `marked` (Markdown
 * parsing) and `dompurify` (HTML sanitizing), mirroring `chart-loader.ts`'s
 * `loadChartAndZoom()` shape for two independent optional peers. A partial
 * install — most usefully `marked` alone, for a consumer who has explicitly
 * set `sanitize="false"` and doesn't need `dompurify` at all — degrades to
 * "that one half is missing" rather than failing outright. Exported (in
 * addition to the cached `loadMarkdownDeps()` below) so both failure paths —
 * and the real caught error each one logs — are directly testable without
 * needing to actually uninstall either package.
 */
export async function loadMarkdownAndSanitizer(
  importMarked: () => Promise<typeof MarkedModule> = () => import('marked'),
  importDompurify: () => Promise<{ default: typeof DOMPurifyApi }> = () => import('dompurify'),
): Promise<MarkdownDeps> {
  let marked: typeof MarkedModule | undefined;
  try {
    marked = await importMarked();
  } catch (err) {
    console.warn(
      '<lyra-markdown> needs the optional peer dependency `marked` to parse Markdown — install it with `pnpm add marked`:',
      err,
    );
  }

  let DOMPurify: typeof DOMPurifyApi | undefined;
  try {
    DOMPurify = (await importDompurify()).default;
  } catch (err) {
    console.warn(
      '<lyra-markdown> needs the optional peer dependency `dompurify` to sanitize rendered HTML — install it ' +
        'with `pnpm add dompurify`. Until then, content only renders when `sanitize="false"` is explicitly set:',
      err,
    );
  }

  return { marked, DOMPurify };
}

/**
 * Lazily loads `marked` + `dompurify` once per page (see
 * `loadMarkdownAndSanitizer()` for why each is loaded and caught
 * independently). Cached the same way `chart-loader.ts`/`map-loader.ts`
 * cache their promise, so every `<lyra-markdown>` instance on a page shares
 * one load.
 */
export function loadMarkdownDeps(): Promise<MarkdownDeps> {
  if (!deps) {
    deps = loadMarkdownAndSanitizer();
  }
  return deps;
}
