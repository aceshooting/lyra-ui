import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';

/**
 * The two optional peers `<lr-markdown>` needs, loaded independently (see
 * `loadMarkdownAndSanitizer()`). Either half can be `undefined` on its own —
 * a consumer who only installs `marked` (having explicitly opted out of
 * sanitization via `sanitize="false"`) is a valid, supported combination.
 */
export interface MarkdownDeps {
  marked: OptionalPeerApi | undefined;
  DOMPurify: OptionalPeerApi | undefined;
}

let deps: Promise<MarkdownDeps> | undefined;

// Populated the instant `deps` settles (inside `loadMarkdownDeps()` below) so
// `getMarkdownDepsIfLoaded()` can hand one back synchronously -- the whole
// point of that function, since `deps` itself is a Promise and awaiting it
// always costs at least one microtask, even once already resolved.
let resolvedDeps: MarkdownDeps | undefined;

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
  importMarked: () => Promise<OptionalPeerApi> = () => import('marked') as Promise<OptionalPeerApi>,
  importDompurify: () => Promise<{ default: OptionalPeerApi }> = () =>
    import('dompurify') as Promise<{ default: OptionalPeerApi }>,
): Promise<MarkdownDeps> {
  let marked: OptionalPeerApi | undefined;
  try {
    marked = await importMarked();
  } catch (err) {
    console.warn(
      '<lr-markdown> needs the optional peer dependency `marked` to parse Markdown — install it with `pnpm add marked`:',
      err,
    );
  }

  let DOMPurify: OptionalPeerApi | undefined;
  try {
    DOMPurify = (await importDompurify()).default;
  } catch (err) {
    console.warn(
      '<lr-markdown> needs the optional peer dependency `dompurify` to sanitize rendered HTML — install it ' +
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
 * cache their promise, so every `<lr-markdown>` instance on a page shares
 * one load.
 *
 * The dynamic `import()` inside `loadMarkdownAndSanitizer()` is always
 * asynchronous — even when both peers are already installed and resolve
 * without error — so every `<lr-markdown>` that calls this from
 * `connectedCallback()` paints its plain-text fallback (`data-fallback` on
 * the `content` part) for at least one microtask before the real rendered
 * output replaces it. That window is unconditional, not just a failure
 * path: it ends only once this promise settles. A consumer that wants to
 * skip it can set `eager-load` on `<lr-markdown>`, which calls
 * `getMarkdownDepsIfLoaded()` below instead of awaiting this function —
 * see that property's doc for what "already warm" means in practice.
 */
export function loadMarkdownDeps(): Promise<MarkdownDeps> {
  if (!deps) {
    deps = loadMarkdownAndSanitizer().then((resolved) => {
      resolvedDeps = resolved;
      return resolved;
    });
  }
  return deps;
}

/**
 * Synchronous companion to `loadMarkdownDeps()`: returns the same
 * module-level cached `MarkdownDeps` if some earlier call to
 * `loadMarkdownDeps()` — from any `<lr-markdown>` instance on the page, or
 * a consumer priming it directly at startup — has already settled by the
 * time this is called, or `undefined` if the cache isn't warm yet (nothing
 * has called `loadMarkdownDeps()` before, or it's still in flight). Used by
 * `eager-load` to skip the dynamic `import()`'s async hop in the common case
 * where the peers are already loaded; it cannot make the *very first*
 * `<lr-markdown>` on a page synchronous, since that first call is what
 * populates the cache in the first place.
 */
export function getMarkdownDepsIfLoaded(): MarkdownDeps | undefined {
  return resolvedDeps;
}
