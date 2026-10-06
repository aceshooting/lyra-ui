import { execFileSync } from 'node:child_process';
import { copyFile, readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

// Tarballs CI already packed (real prepack, SHA256SUMS-verified); unset, each check packs as before.
export const PACKED_TARBALL_ENVIRONMENT = Object.freeze({
  ui: 'LYRA_PACKED_UI_TARBALL',
  flags: 'LYRA_PACKED_FLAGS_TARBALL',
  docs: 'LYRA_PACKED_DOCS_TARBALL',
});

export const packedManifest = (tarball) => JSON.parse(execFileSync('tar', ['-xzOf', tarball, 'package/package.json'], {
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
}));

/** The supplied tarball copied into `destination`, after proving it is this checkout's package; undefined when unset. */
export async function suppliedPackedTarball(variable, { packageDir, destination, compareExports = false, environment = process.env }) {
  if (!environment[variable]) return undefined;
  const source = resolve(environment[variable]);
  const workspace = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'));
  const packed = packedManifest(source);
  for (const key of ['name', 'version', ...(compareExports ? ['exports'] : [])]) {
    if (JSON.stringify(packed[key]) !== JSON.stringify(workspace[key])) {
      throw new TypeError(`${variable} ${key} does not match the ${workspace.name}@${workspace.version} workspace manifest.`);
    }
  }
  const target = join(destination, basename(source));
  if (target !== source) await copyFile(source, target);
  return target;
}
