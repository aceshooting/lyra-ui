/**
 * Module-fetch checks over resource-timing entries, for lazy-loading tests.
 *
 * Under the unbundled test server every module is its own HTTP resource, so "the browser fetched
 * a module whose path ends with X" is a reliable proxy for "X was reached by the import graph".
 * The resource-timing buffer defaults to 250 entries, though, and once it is full later fetches
 * are not recorded at all, so a bare "was not fetched" check can pass without examining anything.
 * The page enlarges the buffer before the first module loads (web-test-runner.config.js), this
 * module enlarges it again for any other host page, and a negative check names a control module
 * the file is known to have loaded: when the control is missing, or the buffer is saturated, the
 * check throws instead of answering.
 */
export const RESOURCE_TIMING_BUFFER_SIZE = 10000;
performance.setResourceTimingBufferSize(RESOURCE_TIMING_BUFFER_SIZE);

/** A path suffix (`'/toast.class.ts'`) or a pattern tested against each fetched URL's path. */
export type ModuleMatch = string | RegExp;

export interface FetchedModuleOptions {
  /** A module this file has certainly fetched; required for a check that expects `false`. */
  readonly control?: ModuleMatch;
}

/** The URL paths of every resource this page has fetched so far, in fetch-completion order. */
export function fetchedModulePaths(): string[] {
  const entries = performance.getEntriesByType('resource');
  if (entries.length >= RESOURCE_TIMING_BUFFER_SIZE) {
    throw new Error(`The resource-timing buffer is saturated (${entries.length} entries); later fetches are unrecorded`);
  }
  return entries.map(entry => new URL(entry.name).pathname);
}

function matches(path: string, match: ModuleMatch): boolean {
  return typeof match === 'string' ? path.endsWith(match) : match.test(path);
}

/** Whether a module matching `match` was fetched, after verifying the optional positive control. */
export function fetchedModule(match: ModuleMatch, { control }: FetchedModuleOptions = {}): boolean {
  const paths = fetchedModulePaths();
  if (control !== undefined && !paths.some(path => matches(path, control))) {
    throw new Error(`Control module ${String(control)} is absent from ${paths.length} resource-timing entries, so an absence check would be vacuous`);
  }
  return paths.some(path => matches(path, match));
}
