// URL safety is sink-specific. A `data:` URL is inert when used as media or
// fetched as data, but navigating an anchor to `data:text/html,...` creates an
// active document. Keep the link allowlist deliberately narrower.
const SAFE_RESOURCE_SCHEMES = new Set(['http:', 'https:', 'blob:', 'data:']);
const SAFE_LINK_SCHEMES = new Set(['http:', 'https:', 'blob:', 'mailto:']);

// A fixed web base makes relative and scheme-relative inputs parse through the
// same WHATWG URL algorithm as absolute inputs. This also means malformed
// absolute URLs are rejected instead of being mistaken for relative paths.
const PARSE_BASE = 'https://lyra.invalid/';

function safeUrlOrNull(url: unknown, allowedSchemes: ReadonlySet<string>): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed === '') return null;

  try {
    const protocol = new URL(trimmed, PARSE_BASE).protocol;
    return allowedSchemes.has(protocol) ? trimmed : null;
  } catch {
    return null;
  }
}

/** Returns a trimmed URL safe for an `<img>`/`<video>` `src`, or `null`.
 * Relative URLs and `http:`, `https:`, `blob:`, and `data:` are allowed. The
 * platform parser performs the same control-character normalization as DOM
 * URL sinks, preventing obfuscated schemes such as `java\tscript:`. */
export function safeMediaSrc(url: unknown): string | null {
  return safeUrlOrNull(url, SAFE_RESOURCE_SCHEMES);
}

/** Returns a trimmed URL safe to pass to `fetch()`, or `null`. This shares the
 * resource allowlist with media sources so text/image `data:` URLs remain
 * usable, while navigation-only and executable schemes are rejected. */
export function safeFetchUrl(url: unknown): string | null {
  return safeUrlOrNull(url, SAFE_RESOURCE_SCHEMES);
}

/** Returns a trimmed URL safe for an `<a href>`, or `null`. `http:`, `https:`,
 * `blob:`, `mailto:`, and relative URLs are allowed. `data:` is intentionally
 * excluded because following it can open an active document; `mailto:` is
 * allowed because it hands off to the mail client rather than navigating a
 * document. */
export function safeLinkHref(url: unknown): string | null {
  return safeUrlOrNull(url, SAFE_LINK_SCHEMES);
}
