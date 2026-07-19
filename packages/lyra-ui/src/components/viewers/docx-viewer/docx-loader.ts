import type { OptionalPeerApi } from '../../../internal/optional-peer-types.js';

export type MammothApi = OptionalPeerApi;

export interface DocxDeps {
  mammoth: MammothApi | undefined;
  DOMPurify: OptionalPeerApi | undefined;
}

let depsPromise: Promise<DocxDeps> | undefined;
let resolvedDeps: DocxDeps | undefined;

function unwrapDefault(value: OptionalPeerApi): OptionalPeerApi {
  return value.default ?? value;
}

export async function loadMammothAndSanitizer(
  importMammoth: () => Promise<OptionalPeerApi> = () =>
    import('mammoth/mammoth.browser.js') as Promise<OptionalPeerApi>,
  importDompurify: () => Promise<OptionalPeerApi> = () =>
    import('dompurify') as Promise<OptionalPeerApi>,
): Promise<DocxDeps> {
  let mammoth: MammothApi | undefined;
  try {
    mammoth = unwrapDefault(await importMammoth());
  } catch (error) {
    console.warn(
      '<lr-docx-viewer> needs the optional peer dependency `mammoth` to convert DOCX documents — install it with `pnpm add mammoth`:',
      error,
    );
  }

  let DOMPurify: OptionalPeerApi | undefined;
  try {
    DOMPurify = unwrapDefault(await importDompurify());
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
