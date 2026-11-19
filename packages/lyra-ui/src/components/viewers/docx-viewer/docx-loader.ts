import { loadDompurify } from '../../../internal/dompurify-loader.js';
import { createOptionalPeerLoader, type HtmlSanitizer } from '../../../internal/optional-peer-capabilities.js';

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

let resolvedDeps: DocxDeps | undefined;

function isMammothApi(value: unknown): value is MammothApi {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'convertToHtml' in value &&
    typeof value.convertToHtml === 'function'
  );
}

const mammothLoader = /* @__PURE__ */ createOptionalPeerLoader<MammothApi>({
  load: () => import('mammoth/mammoth.browser.js'),
  isCapability: isMammothApi,
  warningKey: 'lyra-docx-viewer-mammoth-unavailable',
  warning: '<lr-docx-viewer> could not load its optional mammoth peer.',
});

export async function loadMammothAndSanitizer(
  importMammoth?: () => Promise<unknown>,
  importDompurify?: () => Promise<unknown>,
): Promise<DocxDeps> {
  const [mammoth, DOMPurify] = await Promise.all([
    importMammoth ? mammothLoader.loadWith(importMammoth) : mammothLoader.get(),
    loadDompurify(importDompurify),
  ]);
  return { mammoth: mammoth ?? undefined, DOMPurify: DOMPurify ?? undefined };
}

/** Both peers come from shared loaders that cache a success and retry a failure, so only the complete pair is memoized here. */
export async function loadDocxDeps(): Promise<DocxDeps> {
  if (resolvedDeps) return resolvedDeps;
  const deps = await loadMammothAndSanitizer();
  if (deps.mammoth && deps.DOMPurify) resolvedDeps ??= deps;
  return resolvedDeps ?? deps;
}

export function getDocxDepsIfLoaded(): DocxDeps | undefined {
  return resolvedDeps;
}

export function clearDocxDepsCache(): void {
  resolvedDeps = undefined;
  mammothLoader.clear();
}
