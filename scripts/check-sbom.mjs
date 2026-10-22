// Proves on every push that the release SBOM generator (scripts/release-artifacts.mjs) still works
// for each publishable package: `pnpm sbom` runs against the installed workspace, its document
// describes the package, and two runs give identical bytes. Without this, a pnpm update that changes
// the document would only surface during a release.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';
import { generateSbom } from './release-artifacts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function publishablePackages(root = ROOT) {
  return readdirSync(join(root, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ directory: `packages/${entry.name}`, manifest: JSON.parse(readFileSync(join(root, 'packages', entry.name, 'package.json'), 'utf8')) }))
    .filter(({ manifest }) => manifest.private !== true)
    .map(({ directory, manifest }) => ({ directory, packageName: manifest.name, version: manifest.version }));
}

if (isMainModule(import.meta.url)) {
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const packages = publishablePackages();
  let components = 0;
  for (const expected of packages) {
    const generate = () => generateSbom({ expected, sourceSha, repositoryRoot: ROOT, verifyCheckout: false });
    const first = generate();
    if (!first.equals(generate())) throw new Error(`${expected.packageName}: two SBOM runs differ.`);
    components += JSON.parse(first).components.length;
  }
  console.log(`SBOM check passed: ${packages.length} publishable packages, ${components} components, reproducible.`);
}
