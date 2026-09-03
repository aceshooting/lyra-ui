import {
  isHtmlSanitizer,
  resolveOptionalPeerCapability,
  type HtmlSanitizer,
} from '../../../internal/optional-peer-capabilities.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';

const SVG_SANITIZER_WARNING_KEY = 'lyra-svg-viewer-sanitizer-unavailable';
const SVG_SANITIZER_WARNING = '<lr-svg-viewer> could not load its optional dompurify peer.';

let sanitizer: Promise<HtmlSanitizer | null> | undefined;

export async function loadSvgSanitizerDeps(
  importDompurify: () => Promise<unknown> = () => import('dompurify'),
): Promise<HtmlSanitizer | null> {
  try {
    // Tolerates either a `{ default }` ESM interop shape or the module itself already being the
    // API -- different bundler/interop configurations resolve DOMPurify's CJS package either way
    // (matches docx-loader.ts/spreadsheet-loader.ts's identical dual-shape tolerance).
    const module = await importDompurify();
    return resolveOptionalPeerCapability(module, isHtmlSanitizer);
  } catch {
    devWarnOnce(SVG_SANITIZER_WARNING_KEY, SVG_SANITIZER_WARNING);
    return null;
  }
}

export function loadSvgSanitizer(): Promise<HtmlSanitizer | null> {
  if (!sanitizer) sanitizer = loadSvgSanitizerDeps();
  return sanitizer;
}

export function clearSvgSanitizerCache(): void {
  sanitizer = undefined;
}
