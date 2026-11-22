/**
 * Validation for sprite-sheet icon libraries (`registerIconLibrary(name, { spriteSheet: true })`).
 *
 * A sprite sheet is referenced, never fetched or sanitized, so the only thing standing between a
 * resolver result and `<use href>` is this check: an `http(s)` URL (or a relative one) that
 * resolves to the document's own origin and names a non-empty fragment.
 */

import { safeFetchUrl } from '../../../internal/safe-url.js';

/** Returns the absolute same-origin `sheet.svg#id` URL for `source`, or `null` when it must not be
 *  rendered. `blob:` and `data:` URLs, other origins, and fragment-less URLs are all rejected. */
export function resolveSpriteSheetHref(source: unknown, baseUrl: string): string | null {
  const safe = safeFetchUrl(source);
  if (!safe) return null;
  let url: URL;
  let base: URL;
  try {
    base = new URL(baseUrl);
    url = new URL(safe, base);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.origin !== base.origin) return null;
  if (url.hash.length < 2) return null;
  return url.href;
}
