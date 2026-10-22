/**
 * Shared fast-check settings for the colocated `*.property.test.ts` files.
 *
 * The seed is fixed so every run replays the same inputs: a failing property reproduces on any
 * machine and can never surface as flake. fast-check also prints the seed, the path and the
 * shrunk counterexample when a property fails, and `includeErrorInReport` adds the assertion
 * message (the chai labels) to that report. To explore beyond the fixed inputs while investigating,
 * pass a larger `numRuns` or temporarily change the seed in the call site.
 */
export const PROPERTY_SEED = 0x5eed_1e57;

/** Runs per property. Keep the whole property suite near two seconds of added test time. */
export const PROPERTY_RUNS = 200;

export function propertyRuns(
  numRuns: number = PROPERTY_RUNS,
): { readonly seed: number; readonly numRuns: number; readonly includeErrorInReport: true } {
  return { seed: PROPERTY_SEED, numRuns, includeErrorInReport: true };
}
