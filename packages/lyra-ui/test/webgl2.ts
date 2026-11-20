import { webgl2Available } from '../src/internal/engine-3d.js';

/**
 * Shared WebGL2 gate for tests that drive a real WebGL2 engine.
 *
 * The probe runs once, when this module is first evaluated: imports evaluate before any test
 * body, so a later `getContext` stub cannot change the answer, and no case pays for (or leaks) a
 * throwaway context of its own. A run started with `WTR_REQUIRE_WEBGL2=1` must examine these
 * cases, so a missing context fails the case instead of skipping it silently.
 */
export const webgl2Present: boolean = webgl2Available();

export type Webgl2Outcome = 'run' | 'skip' | 'fail';

/** What a WebGL2-dependent case does for a given capability and run policy. */
export function webgl2Outcome(available: boolean, required: boolean): Webgl2Outcome {
  if (available) return 'run';
  return required ? 'fail' : 'skip';
}

/** Whether this run was started with `WTR_REQUIRE_WEBGL2=1`. */
export function webgl2RequiredByRun(): boolean {
  return globalThis.__LYRA_WTR_REQUIRE_WEBGL2__ === true;
}

export const WEBGL2_REQUIRED_MESSAGE =
  'WebGL2 is unavailable in this browser, but this run requires it (WTR_REQUIRE_WEBGL2=1)';

/** Builds a guard for one capability answer; `requireWebgl2` is the page's own instance. */
export function createWebgl2Guard(
  available: boolean,
  required: () => boolean = webgl2RequiredByRun,
): (this: Mocha.Context) => void {
  return function (this: Mocha.Context): void {
    const outcome = webgl2Outcome(available, required());
    if (outcome === 'fail') throw new Error(WEBGL2_REQUIRED_MESSAGE);
    if (outcome === 'skip') this.skip();
  };
}

/**
 * Use as `before(requireWebgl2)` or `requireWebgl2.call(this)` inside a case: runs the case when
 * WebGL2 exists, skips it otherwise, and throws when the run requires WebGL2.
 */
export const requireWebgl2: (this: Mocha.Context) => void = createWebgl2Guard(webgl2Present);
