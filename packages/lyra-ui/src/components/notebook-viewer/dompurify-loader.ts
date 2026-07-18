import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';

let sanitizer: Promise<OptionalPeerApi | null> | undefined;

export async function loadNotebookSanitizerDeps(
  importDompurify: () => Promise<{ default: OptionalPeerApi }> = () =>
    import('dompurify') as Promise<{ default: OptionalPeerApi }>,
): Promise<OptionalPeerApi | null> {
  try {
    return (await importDompurify()).default;
  } catch (error) {
    console.warn(
      '<lr-notebook-viewer> needs the optional peer dependency `dompurify` to render raw HTML/SVG cell outputs — install it with `pnpm add dompurify`:',
      error,
    );
    return null;
  }
}

export function loadNotebookSanitizer(): Promise<OptionalPeerApi | null> {
  if (!sanitizer) sanitizer = loadNotebookSanitizerDeps();
  return sanitizer;
}

export function clearNotebookSanitizerCache(): void {
  sanitizer = undefined;
}

/** @internal test-only hook to force a specific resolved sanitizer (e.g. simulate a missing optional peer); pass `undefined` to reset to the real loader. */
export function __setNotebookSanitizerForTesting(value: OptionalPeerApi | null | undefined): void {
  sanitizer = value === undefined ? undefined : Promise.resolve(value);
}
