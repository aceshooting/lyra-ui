import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';

export type PapaParseApi = OptionalPeerApi;
let cached: Promise<PapaParseApi | null> | undefined;

export async function loadPapaParse(
  importPapaParse: () => Promise<PapaParseApi | { default: PapaParseApi }> = () => import('papaparse'),
): Promise<PapaParseApi | null> {
  try {
    const module = await importPapaParse();
    const candidate = (module as { default?: PapaParseApi }).default;
    return candidate && typeof candidate.parse === 'function' ? candidate : module as PapaParseApi;
  } catch (error) {
    console.warn('<lyra-csv-viewer> needs the optional peer dependency `papaparse` to parse CSV files — install it with `pnpm add papaparse`:', error);
    return null;
  }
}

export function loadPapaParseCached(): Promise<PapaParseApi | null> {
  if (!cached) cached = loadPapaParse();
  return cached;
}

export function clearPapaParseCache(): void { cached = undefined; }
