import type { OptionalPeerApi } from '../../../internal/optional-peer-types.js';

export type PptxRendererModule = OptionalPeerApi;

let modulePromise: Promise<PptxRendererModule | null> | undefined;

function hasPptxOpenCapability(value: unknown): value is PptxRendererModule {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return false;
  const viewer = (value as { PptxViewer?: unknown }).PptxViewer;
  if ((typeof viewer !== 'object' && typeof viewer !== 'function') || viewer === null) return false;
  return typeof (viewer as { open?: unknown }).open === 'function';
}

export async function loadPptxRenderer(
  importer: () => Promise<PptxRendererModule> = () => import('@aiden0z/pptx-renderer') as Promise<PptxRendererModule>,
): Promise<PptxRendererModule | null> {
  try {
    const module = await importer();
    if (hasPptxOpenCapability(module)) return module;
    const defaultExport = (module as { default?: unknown } | null)?.default;
    return hasPptxOpenCapability(defaultExport) ? defaultExport : null;
  } catch (error) {
    console.warn('The optional `@aiden0z/pptx-renderer` peer is required to render PPTX files.', error);
    return null;
  }
}

export function getPptxRenderer(): Promise<PptxRendererModule | null> {
  if (!modulePromise) modulePromise = loadPptxRenderer();
  return modulePromise;
}

/** @internal */
export function __setPptxRendererForTesting(module: PptxRendererModule | null | undefined): void {
  modulePromise = module === undefined ? undefined : Promise.resolve(module);
}
