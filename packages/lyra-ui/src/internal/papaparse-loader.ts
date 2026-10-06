import { createOptionalPeerLoader } from './optional-peer-capabilities.js';

const PAPAPARSE_WARNING_KEY = 'lyra-papaparse-unavailable';
const PAPAPARSE_WARNING = 'A lyra-ui component could not load its optional papaparse peer.';

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

const papaParse = /* @__PURE__ */ createOptionalPeerLoader<PapaParseApi>({
  load: () => import('papaparse'),
  isCapability: isPapaParseApi,
  warningKey: PAPAPARSE_WARNING_KEY,
  warning: PAPAPARSE_WARNING,
});

/** Uncached worker, shared by `<lr-csv-viewer>` and `<lr-dataset-viewer>` (both parse delimited
 *  text through the optional `papaparse` peer) — `importPapaParse` is injectable for tests. Tolerates
 *  either a `{ default }` ESM interop shape or the module itself already being the API, so it works
 *  regardless of how a given bundler/test harness resolves the CJS `papaparse` package. */
export function loadPapaParse(importPapaParse?: () => Promise<unknown>): Promise<PapaParseApi | null> {
  return papaParse.loadWith(importPapaParse);
}

/** Cached accessor — the actual dynamic `import('papaparse')` and its resolved API are shared across
 *  every caller regardless of which component asked first, instead of each component maintaining its
 *  own independent cache of the same peer. A failed load is retried by the next caller. */
export function loadPapaParseCached(): Promise<PapaParseApi | null> {
  return papaParse.get();
}
