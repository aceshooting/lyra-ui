import type { OptionalPeerApi } from './optional-peer-types.js';

export type PapaParseApi = OptionalPeerApi;

let cached: Promise<PapaParseApi | null> | undefined;

/** Uncached worker, shared by `<lyra-csv-viewer>` and `<lyra-dataset-viewer>` (both parse delimited
 *  text through the optional `papaparse` peer) — `importPapaParse` is injectable for tests. Tolerates
 *  either a `{ default }` ESM interop shape or the module itself already being the API, so it works
 *  regardless of how a given bundler/test harness resolves the CJS `papaparse` package. */
export async function loadPapaParse(
  importPapaParse: () => Promise<PapaParseApi | { default: PapaParseApi }> = () => import('papaparse'),
): Promise<PapaParseApi | null> {
  try {
    const module = await importPapaParse();
    const candidate = (module as { default?: PapaParseApi }).default;
    return candidate && typeof candidate.parse === 'function' ? candidate : (module as PapaParseApi);
  } catch (error) {
    console.warn(
      'A lyra-ui component needs the optional peer dependency `papaparse` to parse delimited text — install it with `pnpm add papaparse`:',
      error,
    );
    return null;
  }
}

/** Cached accessor — the actual dynamic `import('papaparse')` and its resolved API are shared across
 *  every caller regardless of which component asked first, instead of each component maintaining its
 *  own independent cache of the same peer. */
export function loadPapaParseCached(): Promise<PapaParseApi | null> {
  if (!cached) cached = loadPapaParse();
  return cached;
}

export function clearPapaParseCache(): void {
  cached = undefined;
}
