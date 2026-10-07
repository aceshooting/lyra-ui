import { clearDompurifyCache, loadDompurify } from '../../../internal/dompurify-loader.js';
import type { HtmlSanitizer } from '../../../internal/optional-peer-capabilities.js';

export function loadSvgSanitizerDeps(
  importDompurify: () => Promise<unknown> = () => import('dompurify'),
): Promise<HtmlSanitizer | null> {
  return loadDompurify(importDompurify);
}

export function loadSvgSanitizer(): Promise<HtmlSanitizer | null> {
  return loadDompurify();
}

export function clearSvgSanitizerCache(): void {
  clearDompurifyCache();
}
