import { resolveOptionalPeerCapability } from '../../../internal/optional-peer-capabilities.js';

export interface ArchiveStreamApi {
  on(type: 'data', callback: (chunk: Uint8Array) => void): ArchiveStreamApi;
  on(type: 'error', callback: (error: unknown) => void): ArchiveStreamApi;
  on(type: 'end', callback: () => void): ArchiveStreamApi;
  pause?(): void;
  resume(): void;
}

export interface ArchiveFileApi {
  name: string;
  dir: boolean;
  _data?: { uncompressedSize?: number };
  internalStream?: (type: 'uint8array') => ArchiveStreamApi;
}

export interface ArchiveApi {
  forEach(callback: (path: string, file: ArchiveFileApi) => void): void;
}

export interface ArchiveLibraryApi {
  loadAsync(input: ArrayBuffer): Promise<ArchiveApi>;
}

function isArchiveLibraryApi(value: unknown): value is ArchiveLibraryApi {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'loadAsync' in value &&
    typeof value.loadAsync === 'function'
  );
}
let cached: Promise<ArchiveLibraryApi | null> | undefined;

export async function loadArchiveLibrary(
  importJSZip: () => Promise<unknown> = () => import('jszip'),
): Promise<ArchiveLibraryApi | null> {
  try {
    const module = await importJSZip();
    return resolveOptionalPeerCapability(module, isArchiveLibraryApi);
  } catch (error) {
    console.warn('<lr-archive-viewer> needs the optional peer dependency `jszip` to read .zip archives — install it with `pnpm add jszip`:', error);
    return null;
  }
}

export function loadArchiveLibraryCached(): Promise<ArchiveLibraryApi | null> {
  if (!cached) cached = loadArchiveLibrary();
  return cached;
}

export function clearArchiveLibraryCache(): void { cached = undefined; }
