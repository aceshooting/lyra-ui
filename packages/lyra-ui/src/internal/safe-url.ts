// URL safety is sink-specific. A `data:` URL is inert when used as media or
// fetched as data, but navigating an anchor to `data:text/html,...` creates an
// active document. Keep the anchor allowlists deliberately narrower.
//
// The two anchor allowlists differ on `mailto:` because they answer different
// questions. A navigation anchor asks "may the user go here?" -- handing off to
// the mail client is a legitimate destination. A download anchor asks "does this
// name a retrievable resource?" -- `mailto:` names no bytes, so a `download`
// attribute pointed at one is meaningless and the affordance should degrade to
// its inert state instead. Download is therefore a strict subset of resource,
// which is what lets a media component treat "failed the media-src check" as
// "necessarily fails the download-href check too".
const SAFE_RESOURCE_SCHEMES = new Set(['http:', 'https:', 'blob:', 'data:']);
const SAFE_DOWNLOAD_SCHEMES = new Set(['http:', 'https:', 'blob:']);
const SAFE_LINK_SCHEMES = new Set(['http:', 'https:', 'blob:', 'mailto:']);

// A fixed web base makes relative and scheme-relative inputs parse through the
// same WHATWG URL algorithm as absolute inputs. This also means malformed
// absolute URLs are rejected instead of being mistaken for relative paths.
const PARSE_BASE = 'https://lyra.invalid/';

function safeUrlOrNull(
  url: unknown,
  allowedSchemes: ReadonlySet<string>,
  URLCtor: typeof URL,
): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed === '') return null;

  try {
    const protocol = new URLCtor(trimmed, PARSE_BASE).protocol;
    return allowedSchemes.has(protocol) ? trimmed : null;
  } catch {
    return null;
  }
}

/** Returns a trimmed URL safe for an `<img>`/`<video>` `src`, or `null`.
 * Relative URLs and `http:`, `https:`, `blob:`, and `data:` are allowed. The
 * platform parser performs the same control-character normalization as DOM
 * URL sinks, preventing obfuscated schemes such as `java\tscript:`. */
export function safeMediaSrc(url: unknown, URLCtor: typeof URL = URL): string | null {
  return safeUrlOrNull(url, SAFE_RESOURCE_SCHEMES, URLCtor);
}

/** Returns a trimmed URL safe to pass to `fetch()`, or `null`. This shares the
 * resource allowlist with media sources so text/image `data:` URLs remain
 * usable, while navigation-only and executable schemes are rejected. */
export function safeFetchUrl(url: unknown, URLCtor: typeof URL = URL): string | null {
  return safeUrlOrNull(url, SAFE_RESOURCE_SCHEMES, URLCtor);
}

/** Returns a trimmed URL safe for a *navigation* `<a href>`, or `null`.
 * `http:`, `https:`, `blob:`, `mailto:`, and relative URLs are allowed.
 * `data:` is intentionally excluded because following it can open an active
 * document; `mailto:` is allowed because it hands off to the mail client
 * rather than navigating a document. Use `safeDownloadHref()` instead for an
 * anchor that retrieves a resource (one carrying a `download` attribute). */
export function safeLinkHref(url: unknown, URLCtor: typeof URL = URL): string | null {
  return safeUrlOrNull(url, SAFE_LINK_SCHEMES, URLCtor);
}

/** Returns a trimmed URL safe for a *download/open* `<a href>` pointing at a
 * resource, or `null`. `http:`, `https:`, `blob:`, and relative URLs are
 * allowed. This is `safeLinkHref()` minus `mailto:`: a mail handoff names no
 * retrievable bytes, so pairing it with a `download` attribute is meaningless.
 * The allowlist is a strict subset of `safeMediaSrc()`'s, so a URL that fails
 * the media-src check necessarily fails this one too. */
export function safeDownloadHref(url: unknown, URLCtor: typeof URL = URL): string | null {
  return safeUrlOrNull(url, SAFE_DOWNLOAD_SCHEMES, URLCtor);
}

// An action link is an anchor the page author writes on a button-like control (`lr-button`,
// `lr-icon-button`), never one projected from rendered content. Besides `safeLinkHref()`'s schemes
// it may hand off to the phone dialer (`tel:`) or the messaging app (`sms:`): like `mailto:`, both
// leave the page for a system handler, name no web origin and execute nothing. They stay out of
// `SAFE_LINK_SCHEMES` because that allowlist also guards untrusted rendered content (Markdown
// links), where admitting a new handoff scheme would change what such content can produce.
const SAFE_ACTION_LINK_SCHEMES = new Set([...SAFE_LINK_SCHEMES, 'tel:', 'sms:']);

/** Returns a trimmed URL safe for an author-written action anchor (a link styled as a button), or
 * `null`. This is `safeLinkHref()` plus the `tel:` and `sms:` handoff schemes. Use it only for an
 * `href` the page author sets directly on a control; content-derived links keep `safeLinkHref()`.
 * A `download` anchor keeps `safeDownloadHref()`, which names neither scheme. */
export function safeActionLinkHref(url: unknown, URLCtor: typeof URL = URL): string | null {
  return safeUrlOrNull(url, SAFE_ACTION_LINK_SCHEMES, URLCtor);
}

// A document-navigation sink (an `<iframe src>`, a full page navigation) becomes an active,
// executable document once loaded, unlike a resource sink that only ever renders/fetches bytes.
// `data:` and `blob:` are therefore excluded even though both are allowed for `safeMediaSrc()`/
// `safeFetchUrl()`: either can carry a complete attacker-controlled HTML document just as readily
// as `data:text/html,...` can. `mailto:` is also excluded, unlike `safeLinkHref()`: it hands off
// to the mail client instead of loading a document, so it names no navigable target here.
const SAFE_DOCUMENT_NAVIGATION_SCHEMES = new Set(['http:', 'https:']);

/** Returns a trimmed URL safe to navigate an active document to -- an `<iframe src>` or a full
 * page navigation -- or `null`. Only `http:`, `https:`, and relative URLs are allowed; this is
 * the narrowest allowlist in this module; see the scheme-set comment above for why `data:`,
 * `blob:`, and `mailto:` are each excluded here even though one or more of the other sinks in
 * this module allow them. */
export function safeDocumentNavigationUrl(url: unknown, URLCtor: typeof URL = URL): string | null {
  return safeUrlOrNull(url, SAFE_DOCUMENT_NAVIGATION_SCHEMES, URLCtor);
}

/** Returns a trimmed URL safe for an `<iframe src>`, or `null`. An alias of
 * `safeDocumentNavigationUrl()` named for its most common caller (`<lr-mcp-app>`'s sandboxed
 * frame); the two names share one implementation because the underlying question -- "may this
 * become an actively-navigated document?" -- is identical for both callers. */
export function safeFrameSrc(url: unknown, URLCtor: typeof URL = URL): string | null {
  return safeDocumentNavigationUrl(url, URLCtor);
}

/** Token that admits URLs without their own scheme in a `parseLinkSchemes()` set. */
const RELATIVE_LINK_TOKEN = 'relative';

/** Parses a space- or comma-separated scheme list (`'https mailto'`, `'https: relative'`) into an
 * allowlist for `safeLinkHrefWithin()`. Tokens are case-insensitive and may end in `:`. Only
 * `safeLinkHref()`'s own schemes and `relative` are kept; any other token (`data`, `javascript`,
 * a typo) is ignored, so the result can only narrow the default allowlist, never widen it.
 * `null`/`undefined` means "not configured" and returns `null`; any string, including an empty
 * one or one with no recognised token, returns a set, which may be empty and then admits no URL. */
export function parseLinkSchemes(value: unknown): ReadonlySet<string> | null {
  if (value === null || value === undefined) return null;
  const allowed = new Set<string>();
  for (const raw of String(value).split(/[\s,]+/)) {
    const token = raw.trim().toLowerCase().replace(/:$/, '');
    if (token === RELATIVE_LINK_TOKEN) allowed.add(RELATIVE_LINK_TOKEN);
    else if (token !== '' && SAFE_LINK_SCHEMES.has(`${token}:`)) allowed.add(`${token}:`);
  }
  return allowed;
}

/** Returns a trimmed URL safe for a navigation `<a href>` under a narrowed allowlist from
 * `parseLinkSchemes()`, or `null`. The URL must first pass `safeLinkHref()`; then an absolute URL
 * must use a listed scheme, and a URL with no scheme of its own (a path, query, fragment or
 * scheme-relative `//host` URL, all of which inherit the document's scheme) needs `relative`. */
export function safeLinkHrefWithin(
  url: unknown,
  allowed: ReadonlySet<string>,
  URLCtor: typeof URL = URL,
): string | null {
  const safe = safeUrlOrNull(url, SAFE_LINK_SCHEMES, URLCtor);
  if (safe === null) return null;
  let protocol: string | null;
  try {
    protocol = new URLCtor(safe).protocol;
  } catch {
    protocol = null;
  }
  if (protocol === null) return allowed.has(RELATIVE_LINK_TOKEN) ? safe : null;
  return allowed.has(protocol) ? safe : null;
}
