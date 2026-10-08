import {
  createOptionalPeerLoader,
  isHtmlSanitizer,
  type HtmlSanitizer,
} from './optional-peer-capabilities.js';

const dompurify = /* @__PURE__ */ createOptionalPeerLoader<HtmlSanitizer>({
  load: () => import('dompurify'),
  isCapability: isHtmlSanitizer,
  warningKey: 'lyra-dompurify-unavailable',
  warning: 'A lyra-ui component could not load its optional dompurify peer.',
});

/**
 * The shared DOMPurify sanitizer for every component that renders remote or authored markup. Without
 * `importer`, one cached `import('dompurify')` serves all callers (a failed load is retried by the
 * next call); with `importer` (tests, or an application that bundles its own DOMPurify build) the
 * load is uncached. Resolves `null` when the peer is missing or is not a sanitizer, so callers fail
 * closed rather than rendering unsanitized markup.
 */
export function loadDompurify(importer?: () => Promise<unknown>): Promise<HtmlSanitizer | null> {
  return importer ? dompurify.loadWith(importer) : dompurify.get();
}

/** Forgets the shared load (tests, or after an application swaps its DOMPurify build). */
export function clearDompurifyCache(): void {
  dompurify.clear();
}

/** Test seam, stripped from the published build: makes the shared DOMPurify import fail (or resolve) like a missing peer. */
export function __setDompurifyImporterForTesting(importer?: () => Promise<unknown>): void {
  dompurify.override(importer);
}
