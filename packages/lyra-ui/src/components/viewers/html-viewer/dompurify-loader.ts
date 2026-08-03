import {
  isHtmlSanitizer,
  resolveOptionalPeerCapability,
  type HtmlSanitizer,
} from '../../../internal/optional-peer-capabilities.js';

let sanitizer: Promise<HtmlSanitizer | null> | undefined;

export async function loadHtmlSanitizerDeps(
  importDompurify: () => Promise<unknown> = () => import('dompurify'),
): Promise<HtmlSanitizer | null> {
  try {
    // Different bundler/interop configurations resolve a CJS-published optional peer as either
    // `{ default: X }` or the bare module namespace -- fall back to the bare shape, matching
    // docx-loader.ts/email-loader.ts's `value.default ?? value` in this same family.
    const module = await importDompurify();
    return resolveOptionalPeerCapability(module, isHtmlSanitizer);
  } catch (error) {
    console.warn(
      '<lr-html-viewer> needs the optional peer dependency `dompurify` to sanitize rendered HTML markup — install it with `pnpm add dompurify`:',
      error,
    );
    return null;
  }
}

export function loadHtmlSanitizer(): Promise<HtmlSanitizer | null> {
  if (!sanitizer) sanitizer = loadHtmlSanitizerDeps();
  return sanitizer;
}

export function clearHtmlSanitizerCache(): void {
  sanitizer = undefined;
}

/** @internal test-only hook to force a specific resolved sanitizer (e.g. simulate a missing optional peer); pass `undefined` to reset to the real loader. */
export function __setHtmlSanitizerForTesting(value: HtmlSanitizer | null | undefined): void {
  sanitizer = value === undefined ? undefined : Promise.resolve(value);
}
