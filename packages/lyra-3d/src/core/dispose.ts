/** Attempts every owned release, then rethrows the first failure without losing later cleanup. */
export function disposeAll(operations: readonly (() => void)[]): void {
  let failed = false, failure: unknown;
  for (const operation of operations) try { operation(); } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
}
