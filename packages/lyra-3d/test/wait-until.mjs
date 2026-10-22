/**
 * Resolves once `condition` holds, polling on the event loop, and fails the awaiting test with the
 * description if it never does. Waiting on the outcome instead of a fixed delay keeps timing-based
 * tests deterministic on a loaded machine.
 */
export async function waitUntil(condition, description, timeoutMs = 5000) {
  const deadline = performance.now() + timeoutMs;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`Timed out waiting for ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

/** A grace period for asserting that something does NOT happen; it can only miss a bug, never fail a correct run. */
export const settle = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
