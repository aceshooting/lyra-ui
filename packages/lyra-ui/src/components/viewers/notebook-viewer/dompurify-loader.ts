import {
  isHtmlSanitizer,
  resolveOptionalPeerCapability,
  type HtmlSanitizer,
} from '../../../internal/optional-peer-capabilities.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';

const NOTEBOOK_SANITIZER_WARNING_KEY = 'lyra-notebook-viewer-sanitizer-unavailable';
const NOTEBOOK_SANITIZER_WARNING = '<lr-notebook-viewer> could not load its optional dompurify peer.';

let sanitizer: Promise<HtmlSanitizer | null> | undefined;

export async function loadNotebookSanitizerDeps(
  importDompurify: () => Promise<unknown> = () => import('dompurify'),
): Promise<HtmlSanitizer | null> {
  try {
    // Different bundler/interop configurations resolve a CJS-published optional peer as either
    // `{ default: X }` or the bare module namespace -- trusting `.default` unconditionally would
    // silently substitute `undefined` for the real sanitizer under the other resolution, same
    // dual-shape tolerance spreadsheet-loader.ts/qr-code-loader.ts already apply.
    const module = await importDompurify();
    return resolveOptionalPeerCapability(module, isHtmlSanitizer);
  } catch {
    devWarnOnce(NOTEBOOK_SANITIZER_WARNING_KEY, NOTEBOOK_SANITIZER_WARNING);
    return null;
  }
}

export function loadNotebookSanitizer(): Promise<HtmlSanitizer | null> {
  if (!sanitizer) sanitizer = loadNotebookSanitizerDeps();
  return sanitizer;
}

export function clearNotebookSanitizerCache(): void {
  sanitizer = undefined;
}

/** @internal test-only hook to force a specific resolved sanitizer (e.g. simulate a missing optional peer); pass `undefined` to reset to the real loader. */
export function __setNotebookSanitizerForTesting(
  value: HtmlSanitizer | Promise<HtmlSanitizer | null> | null | undefined,
): void {
  sanitizer = value === undefined ? undefined : Promise.resolve(value);
}
