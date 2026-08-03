import { resolveOptionalPeerCapability } from '../../../internal/optional-peer-capabilities.js';

export interface PptxViewerApi extends EventTarget {
  slideCount: number;
  currentSlideIndex: number;
  goToSlide(index: number): Promise<void> | void;
  destroy(): void;
}

export interface PptxRendererModule {
  PptxViewer: {
    open(
      input: ArrayBuffer,
      container: HTMLElement,
      options?: Record<string, unknown>,
    ): Promise<PptxViewerApi>;
  };
  RECOMMENDED_ZIP_LIMITS: Readonly<PptxZipLimits>;
}

export interface PptxZipLimits {
  maxEntries: number;
  maxEntryUncompressedBytes: number;
  maxTotalUncompressedBytes: number;
  maxMediaBytes: number;
  maxConcurrency: number;
}

const MAX_SAFE_PPTX_ZIP_LIMITS: Readonly<PptxZipLimits> = {
  maxEntries: 4_000,
  maxEntryUncompressedBytes: 32 * 1024 * 1024,
  maxTotalUncompressedBytes: 256 * 1024 * 1024,
  maxMediaBytes: 192 * 1024 * 1024,
  maxConcurrency: 8,
};

let modulePromise: Promise<PptxRendererModule | null> | undefined;

function hasPptxOpenCapability(value: unknown): value is PptxRendererModule {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return false;
  const viewer = (value as { PptxViewer?: unknown }).PptxViewer;
  if ((typeof viewer !== 'object' && typeof viewer !== 'function') || viewer === null) return false;
  if (typeof (viewer as { open?: unknown }).open !== 'function') return false;
  const limits = (value as { RECOMMENDED_ZIP_LIMITS?: unknown }).RECOMMENDED_ZIP_LIMITS;
  if (typeof limits !== 'object' || limits === null) return false;
  return (Object.keys(MAX_SAFE_PPTX_ZIP_LIMITS) as Array<keyof PptxZipLimits>).every((key) => {
    const candidate = (limits as Partial<PptxZipLimits>)[key];
    return Number.isSafeInteger(candidate) && candidate! > 0 && candidate! <= MAX_SAFE_PPTX_ZIP_LIMITS[key];
  });
}

export async function loadPptxRenderer(
  importer: () => Promise<unknown> = () => import('@aiden0z/pptx-renderer'),
): Promise<PptxRendererModule | null> {
  try {
    const module = await importer();
    return resolveOptionalPeerCapability(module, hasPptxOpenCapability);
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
