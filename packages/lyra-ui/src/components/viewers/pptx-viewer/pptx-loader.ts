import type { OptionalPeerApi } from '../../../internal/optional-peer-types.js';

export type PptxRendererModule = OptionalPeerApi;

let modulePromise: Promise<PptxRendererModule | null> | undefined;

export async function loadPptxRenderer(
  importer: () => Promise<PptxRendererModule> = () => import('@aiden0z/pptx-renderer') as Promise<PptxRendererModule>,
): Promise<PptxRendererModule | null> {
  try {
    return await importer();
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
