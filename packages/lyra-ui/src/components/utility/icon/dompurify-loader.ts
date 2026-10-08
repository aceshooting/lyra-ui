import { clearDompurifyCache, loadDompurify } from '../../../internal/dompurify-loader.js';
import type { HtmlSanitizer } from '../../../internal/optional-peer-capabilities.js';

export function loadIconSanitizerDeps(
  importDompurify: () => Promise<unknown> = () => import('dompurify'),
): Promise<HtmlSanitizer | null> {
  return loadDompurify(importDompurify);
}

/** Resolves the shared sanitizer; an `importer` (an application's own DOMPurify build) is consulted per call, uncached. */
export function loadIconSanitizer(importer?: () => Promise<unknown>): Promise<HtmlSanitizer | null> {
  return loadDompurify(importer);
}

export function clearIconSanitizerCache(): void {
  clearDompurifyCache();
}
