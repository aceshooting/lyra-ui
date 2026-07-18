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
      '<lr-html-viewer> needs the optional peer dependency `dompurify` to sanitize rendered HTML markup — install it with `pnpm add dompurify`:',
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

/** @internal test-only hook to force a specific resolved sanitizer (e.g. simulate a missing optional peer); pass `undefined` to reset to the real loader. */
export function __setHtmlSanitizerForTesting(value: OptionalPeerApi | null | undefined): void {
  sanitizer = value === undefined ? undefined : Promise.resolve(value);
}
