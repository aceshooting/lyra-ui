import {
  isHtmlSanitizer,
  resolveOptionalPeerCapability,
  type HtmlSanitizer,
} from '../../../internal/optional-peer-capabilities.js';

export interface MammothApi {
  convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{
    value: string;
    messages: unknown[];
  }>;
}

export interface DocxDeps {
  mammoth: MammothApi | undefined;
  DOMPurify: HtmlSanitizer | undefined;
}

let depsPromise: Promise<DocxDeps> | undefined;
let resolvedDeps: DocxDeps | undefined;

function isMammothApi(value: unknown): value is MammothApi {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'convertToHtml' in value &&
    typeof value.convertToHtml === 'function'
  );
}

export async function loadMammothAndSanitizer(
  importMammoth: () => Promise<unknown> = () => import('mammoth/mammoth.browser.js'),
  importDompurify: () => Promise<unknown> = () => import('dompurify'),
): Promise<DocxDeps> {
  let mammoth: MammothApi | undefined;
  try {
    mammoth = resolveOptionalPeerCapability(await importMammoth(), isMammothApi) ?? undefined;
  } catch (error) {
    console.warn(
      '<lr-docx-viewer> needs the optional peer dependency `mammoth` to convert DOCX documents — install it with `pnpm add mammoth`:',
      error,
    );
  }

  let DOMPurify: HtmlSanitizer | undefined;
  try {
    DOMPurify = resolveOptionalPeerCapability(await importDompurify(), isHtmlSanitizer) ?? undefined;
  } catch (error) {
    console.warn(
      '<lr-docx-viewer> needs the optional peer dependency `dompurify` to sanitize converted HTML — install it with `pnpm add dompurify`:',
      error,
    );
  }

  return { mammoth, DOMPurify };
}

export function loadDocxDeps(): Promise<DocxDeps> {
  if (!depsPromise) {
    depsPromise = loadMammothAndSanitizer().then((resolved) => {
      resolvedDeps = resolved;
      return resolved;
    });
  }
  return depsPromise;
}

export function getDocxDepsIfLoaded(): DocxDeps | undefined {
  return resolvedDeps;
}

export function clearDocxDepsCache(): void {
  depsPromise = undefined;
  resolvedDeps = undefined;
}
