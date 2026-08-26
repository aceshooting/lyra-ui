import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Reports whether an ES module is the process entry point, including when Node reached it through
 * a package-manager shim or another symbolic link.
 *
 * @param {string} moduleUrl import.meta.url from the calling module
 * @param {string | undefined} invokedPath process.argv[1], overridable for tests
 */
export function isMainModule(moduleUrl, invokedPath = process.argv[1]) {
  if (!invokedPath) return false;
  try {
    return realpathSync(invokedPath) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}
