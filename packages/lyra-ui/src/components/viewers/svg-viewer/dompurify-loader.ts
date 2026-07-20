import type { OptionalPeerApi } from '../../../internal/optional-peer-types.js';

let sanitizer: Promise<OptionalPeerApi | null> | undefined;

export async function loadSvgSanitizerDeps(
  importDompurify: () => Promise<OptionalPeerApi | { default: OptionalPeerApi }> = () =>
    import('dompurify') as Promise<{ default: OptionalPeerApi }>,
): Promise<OptionalPeerApi | null> {
  try {
    // Tolerates either a `{ default }` ESM interop shape or the module itself already being the
    // API -- different bundler/interop configurations resolve DOMPurify's CJS package either way
    // (matches archive-loader.ts/spreadsheet-loader.ts's identical dual-shape tolerance).
    const module = await importDompurify();
    const candidate = (module as { default?: OptionalPeerApi }).default;
    return candidate && typeof candidate.sanitize === 'function' ? candidate : (module as OptionalPeerApi);
  } catch (error) {
    console.warn(
      '<lr-svg-viewer> needs the optional peer dependency `dompurify` to sanitize rendered SVG markup — install it with `pnpm add dompurify`:',
      error,
    );
    return null;
  }
}

export function loadSvgSanitizer(): Promise<OptionalPeerApi | null> {
  if (!sanitizer) sanitizer = loadSvgSanitizerDeps();
  return sanitizer;
}

export function clearSvgSanitizerCache(): void {
  sanitizer = undefined;
}
