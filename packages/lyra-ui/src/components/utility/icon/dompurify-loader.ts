import {
  isHtmlSanitizer,
  resolveOptionalPeerCapability,
  type HtmlSanitizer,
} from '../../../internal/optional-peer-capabilities.js';

let sanitizer: Promise<HtmlSanitizer | null> | undefined;

export async function loadIconSanitizerDeps(
  importDompurify: () => Promise<unknown> = () => import('dompurify'),
): Promise<HtmlSanitizer | null> {
  try {
    // Different bundler/interop configurations resolve a CJS-published optional peer as either
    // `{ default: X }` or the bare module namespace. Prefer the named capability on either shape
    // and reject a candidate that cannot sanitize: resolving `undefined` here would turn the one
    // barrier between fetched remote markup and the DOM into a silent no-op.
    const module = await importDompurify();
    return resolveOptionalPeerCapability(module, isHtmlSanitizer);
  } catch (error) {
    console.warn(
      '<lr-icon> needs the optional peer dependency `dompurify` to sanitize fetched SVG markup — install it with `pnpm add dompurify`:',
      error,
    );
    return null;
  }
}

/** Resolves the shared sanitizer, importing `dompurify` on first use. `importDompurify` is
 *  consulted only while the module-level cache is cold, so an application that already bundles
 *  its own DOMPurify build can supply it once before the first icon fetch. */
export function loadIconSanitizer(
  importDompurify?: () => Promise<unknown>,
): Promise<HtmlSanitizer | null> {
  if (!sanitizer) sanitizer = loadIconSanitizerDeps(importDompurify);
  return sanitizer;
}

export function clearIconSanitizerCache(): void {
  sanitizer = undefined;
}
