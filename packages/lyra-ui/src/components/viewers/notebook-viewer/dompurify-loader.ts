import { clearDompurifyCache, loadDompurify } from '../../../internal/dompurify-loader.js';
import type { HtmlSanitizer } from '../../../internal/optional-peer-capabilities.js';

let override: Promise<HtmlSanitizer | null> | undefined;

export function loadNotebookSanitizerDeps(
  importDompurify: () => Promise<unknown> = () => import('dompurify'),
): Promise<HtmlSanitizer | null> {
  return loadDompurify(importDompurify);
}

export function loadNotebookSanitizer(): Promise<HtmlSanitizer | null> {
  return override ?? loadDompurify();
}

export function clearNotebookSanitizerCache(): void {
  override = undefined;
  clearDompurifyCache();
}

/** @internal test-only hook to force a specific resolved sanitizer (e.g. simulate a missing optional peer); pass `undefined` to reset to the real loader. */
export function __setNotebookSanitizerForTesting(
  value: HtmlSanitizer | Promise<HtmlSanitizer | null> | null | undefined,
): void {
  override = value === undefined ? undefined : Promise.resolve(value);
}
