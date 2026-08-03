import { resolveOptionalPeerCapability } from './optional-peer-capabilities.js';

export interface PapaParseApi {
  parse(input: string, options?: Record<string, unknown>): unknown;
}

function isPapaParseApi(value: unknown): value is PapaParseApi {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'parse' in value &&
    typeof value.parse === 'function'
  );
}

let cached: Promise<PapaParseApi | null> | undefined;

/** Uncached worker, shared by `<lr-csv-viewer>` and `<lr-dataset-viewer>` (both parse delimited
 *  text through the optional `papaparse` peer) — `importPapaParse` is injectable for tests. Tolerates
 *  either a `{ default }` ESM interop shape or the module itself already being the API, so it works
 *  regardless of how a given bundler/test harness resolves the CJS `papaparse` package. */
export async function loadPapaParse(
  importPapaParse: () => Promise<unknown> = () => import('papaparse'),
): Promise<PapaParseApi | null> {
  try {
    const module = await importPapaParse();
    return resolveOptionalPeerCapability(module, isPapaParseApi);
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
