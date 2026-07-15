import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';

export type ArchiveLibraryApi = OptionalPeerApi;
let cached: Promise<ArchiveLibraryApi | null> | undefined;

export async function loadArchiveLibrary(
  importJSZip: () => Promise<ArchiveLibraryApi | { default: ArchiveLibraryApi }> = () => import('jszip'),
): Promise<ArchiveLibraryApi | null> {
  try {
    const module = await importJSZip();
    const candidate = (module as { default?: ArchiveLibraryApi }).default;
    return candidate && typeof candidate.loadAsync === 'function' ? candidate : (module as ArchiveLibraryApi);
  } catch (error) {
    console.warn('<lyra-archive-viewer> needs the optional peer dependency `jszip` to read .zip archives — install it with `pnpm add jszip`:', error);
    return null;
  }
}

export function loadArchiveLibraryCached(): Promise<ArchiveLibraryApi | null> {
  if (!cached) cached = loadArchiveLibrary();
  return cached;
}

export function clearArchiveLibraryCache(): void { cached = undefined; }
