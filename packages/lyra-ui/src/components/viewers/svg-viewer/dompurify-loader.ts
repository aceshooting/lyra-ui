import type { OptionalPeerApi } from '../../../internal/optional-peer-types.js';

let sanitizer: Promise<OptionalPeerApi | null> | undefined;

export async function loadSvgSanitizerDeps(
  importDompurify: () => Promise<{ default: OptionalPeerApi }> = () =>
    import('dompurify') as Promise<{ default: OptionalPeerApi }>,
): Promise<OptionalPeerApi | null> {
  try {
    return (await importDompurify()).default;
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
