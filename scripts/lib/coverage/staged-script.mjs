import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Extension of the records written beside the V8 dumps; `node-coverage.mjs` reads them back. */
export const STAGED_RECORD_EXTENSION = '.staged';

/**
 * Copies original scripts into a fixture tree so a test can run them against fixture data, the way
 * scripts that locate their inputs from `import.meta.url` must be run. When the process is collecting
 * V8 coverage (`NODE_V8_COVERAGE`), each copy is recorded with the digest of the bytes copied, so the
 * report credits the run to the original file. A copy that is edited afterwards is no longer the
 * original and must not be staged through this helper.
 * @param {{ from: string, to: string, files: string[] }} options `files` are relative to both roots.
 * @returns {string[]} The staged paths, in `files` order.
 */
export function stageScripts({ from, to, files }) {
  const directory = process.env.NODE_V8_COVERAGE;
  return files.map(file => {
    const original = resolve(from, file);
    const staged = resolve(to, file);
    mkdirSync(dirname(staged), { recursive: true });
    copyFileSync(original, staged);
    if (directory) {
      mkdirSync(directory, { recursive: true });
      // V8 reports the real path of a module, which differs from the requested one under a symlinked temp root.
      const record = { original, staged: realpathSync(staged), sha256: createHash('sha256').update(readFileSync(staged)).digest('hex') };
      writeFileSync(join(directory, `${randomUUID()}${STAGED_RECORD_EXTENSION}`), `${JSON.stringify(record)}\n`);
    }
    return staged;
  });
}
