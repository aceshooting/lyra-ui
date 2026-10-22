import { createHash, randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));

/** Extension of the records written beside the V8 dumps; the coverage report reads them back. */
export const STAGED_RECORD_EXTENSION = '.staged';

/**
 * A disposable copy of the package's build inputs. The build and the checks locate the package
 * through their own file location, so running them from a copy keeps the real `dist` untouched.
 * Dependencies are linked from the real installation. `browser: true` adds the browser fixtures
 * and the files the archive carries.
 *
 * The copy lives inside the package: the bundler writes module paths relative to its working
 * directory, and a copy outside the workspace would embed machine paths that the package check
 * rejects.
 *
 * While V8 coverage is collected (`coverageDirectory`, by default `NODE_V8_COVERAGE`), every copied
 * module is recorded with its original path and the digest of the bytes copied, so the report can
 * credit what ran in the copy to the original module.
 */
export async function createScratchPackage({ browser = false, coverageDirectory = process.env.NODE_V8_COVERAGE } = {}) {
  const parent = resolve(packageRoot, 'coverage/scratch');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(join(parent, 'lyra-map-scratch-'));
  const entries = ['scripts', 'src', 'types', 'UPSTREAM.json', 'package.json'];
  if (browser) entries.push('test/browser', 'README.md', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md');
  for (const entry of entries) await cp(resolve(packageRoot, entry), resolve(directory, entry), { recursive: true });
  await symlink(resolve(packageRoot, 'node_modules'), resolve(directory, 'node_modules'), 'dir');
  if (coverageDirectory) {
    await mkdir(coverageDirectory, { recursive: true });
    for (const entry of ['scripts', 'src']) {
      for (const file of await readdir(resolve(directory, entry), { recursive: true })) {
        if (!file.endsWith('.mjs')) continue;
        const staged = resolve(directory, entry, file);
        const sha256 = createHash('sha256').update(await readFile(staged)).digest('hex');
        await writeFile(join(coverageDirectory, `${randomUUID()}${STAGED_RECORD_EXTENSION}`),
          `${JSON.stringify({ original: resolve(packageRoot, entry, file), staged, sha256 })}\n`);
      }
    }
  }
  return { directory, remove: () => rm(directory, { recursive: true, force: true }) };
}
