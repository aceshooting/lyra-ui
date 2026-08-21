/**
 * Returns the bytes added to a splitting-aware initial route and rejects impossible/nonpositive
 * results. A zero or negative delta means chunk sharing or metafile traversal no longer models the
 * reviewed baseline, so treating it as a tiny component would make the budget pass vacuously.
 */
export function positiveInitialMarginalGzipBytes(routeBytes, baselineBytes, label) {
  if (
    !Number.isSafeInteger(routeBytes) ||
    routeBytes < 0 ||
    !Number.isSafeInteger(baselineBytes) ||
    baselineBytes < 0
  ) {
    throw new TypeError(`${label}: initial-route gzip measurements must be nonnegative integers`);
  }
  const marginalBytes = routeBytes - baselineBytes;
  if (marginalBytes <= 0) {
    throw new Error(
      `${label}: initial-route gzip must exceed its baseline; measured ${routeBytes} - ${baselineBytes} = ${marginalBytes} bytes`,
    );
  }
  return marginalBytes;
}
