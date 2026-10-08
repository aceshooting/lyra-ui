import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { pack, verifyInstalledArtifacts } from './check-packed-framework-types.mjs';

const manifest = { name: '@aceshooting/lyra-ui', version: '1.0.0' };

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'lr-framework-artifact-contract-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packageDir = join(root, 'workspace');
  const destination = join(root, 'archives');
  await mkdir(packageDir); await mkdir(destination);
  await writeFile(join(packageDir, 'package.json'), JSON.stringify(manifest));
  return { root, packageDir, destination };
}

test('supplied package is selected without requiring a workspace build', async (t) => {
  const { root, packageDir, destination } = await fixture(t);
  const staging = join(root, 'staging');
  await mkdir(join(staging, 'package'), { recursive: true });
  await writeFile(join(staging, 'package', 'package.json'), JSON.stringify(manifest));
  const tarball = join(root, 'supplied.tgz');
  execFileSync('tar', ['-czf', tarball, '-C', staging, 'package']);
  await assert.rejects(access(join(packageDir, 'dist')));
  const selected = await pack(destination, { packageDir, environment: { LYRA_PACKED_UI_TARBALL: tarball } });
  assert.deepEqual(await readFile(selected), await readFile(tarball));
});

test('local packing still requires the workspace framework build', async (t) => {
  const { packageDir, destination } = await fixture(t);
  await assert.rejects(pack(destination, { packageDir, environment: {} }), /dist\/custom-elements-jsx\.d\.ts is missing; run/);
});

test('installed supplied artifacts reject a missing declaration and executable runtime', async (t) => {
  const { root } = await fixture(t);
  const installed = join(root, 'node_modules', '@aceshooting', 'lyra-ui');
  await mkdir(join(installed, 'dist'), { recursive: true });
  await writeFile(join(installed, 'package.json'), JSON.stringify(manifest));
  for (const stem of ['custom-elements-jsx', 'svelte', 'vue']) {
    await writeFile(join(installed, 'dist', `${stem}.d.ts`), 'export {};');
    await writeFile(join(installed, 'dist', `${stem}.js`), 'export {};');
  }
  await verifyInstalledArtifacts(root);
  const declaration = join(installed, 'dist', 'custom-elements-jsx.d.ts');
  await rm(declaration);
  await assert.rejects(verifyInstalledArtifacts(root), /custom-elements-jsx\.d\.ts/);
  await writeFile(declaration, 'export {};');
  await writeFile(join(installed, 'dist', 'custom-elements-jsx.js'), 'console.log("unexpected");');
  await assert.rejects(verifyInstalledArtifacts(root), /must be an empty type-only runtime module/);
});
