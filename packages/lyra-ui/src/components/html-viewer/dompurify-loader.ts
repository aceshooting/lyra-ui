import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';

let sanitizer: Promise<OptionalPeerApi | null> | undefined;

export async function loadHtmlSanitizerDeps(
  importDompurify: () => Promise<{ default: OptionalPeerApi }> = () =>
    import('dompurify') as Promise<{ default: OptionalPeerApi }>,
): Promise<OptionalPeerApi | null> {
  try {
    return (await importDompurify()).default;
  } catch (error) {
    console.warn(
      '<lyra-html-viewer> needs the optional peer dependency `dompurify` to sanitize rendered HTML markup — install it with `pnpm add dompurify`:',
      error,
    );
    return null;
  }
}

export function loadHtmlSanitizer(): Promise<OptionalPeerApi | null> {
  if (!sanitizer) sanitizer = loadHtmlSanitizerDeps();
  return sanitizer;
}

export function clearHtmlSanitizerCache(): void {
  sanitizer = undefined;
}
