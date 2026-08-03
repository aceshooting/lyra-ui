import {
  isHtmlSanitizer,
  resolveOptionalPeerCapability,
  type HtmlSanitizer,
} from '../../../internal/optional-peer-capabilities.js';

let sanitizer: Promise<HtmlSanitizer | null> | undefined;

export async function loadSvgSanitizerDeps(
  importDompurify: () => Promise<unknown> = () => import('dompurify'),
): Promise<HtmlSanitizer | null> {
  try {
    // Tolerates either a `{ default }` ESM interop shape or the module itself already being the
    // API -- different bundler/interop configurations resolve DOMPurify's CJS package either way
    // (matches archive-loader.ts/spreadsheet-loader.ts's identical dual-shape tolerance).
    const module = await importDompurify();
    return resolveOptionalPeerCapability(module, isHtmlSanitizer);
  } catch (error) {
    console.warn(
      '<lr-svg-viewer> needs the optional peer dependency `dompurify` to sanitize rendered SVG markup — install it with `pnpm add dompurify`:',
      error,
    );
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
