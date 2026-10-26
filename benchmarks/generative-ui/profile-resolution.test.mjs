import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildContext } from '../../packages/lyra-gen/scripts/measure-bundles.mjs';
import { profileBrowserResolution, profileInputKey } from './profile-driver.mjs';

// A small synthetic package exercises resolution only; no product bundle or browser.
test('production profile uses package imports rather than contributor TypeScript source aliases', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'lyra-profile-resolution-'));
  try {
    const packageDirectory = join(scratch, 'packages/lyra-ui');
    await mkdir(join(packageDirectory, 'dist/internal'), { recursive: true });
    await mkdir(join(packageDirectory, 'src/internal'), { recursive: true });
    await writeFile(join(packageDirectory, 'package.json'), JSON.stringify({ name: 'synthetic-resolution-fixture', type: 'module', imports: {
      '#lyra-dev-attributes': { development: './dist/internal/development.js', default: './dist/internal/dev-mode-attribute-warning.production.js' },
    } }));
    await writeFile(join(packageDirectory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { paths: {
      '#lyra-dev-attributes': ['./src/internal/dev-mode-attribute-warning.production.ts'],
    } } }));
    await writeFile(join(packageDirectory, 'dist/entry.js'), 'export { branch } from "#lyra-dev-attributes";');
    await writeFile(join(packageDirectory, 'dist/internal/dev-mode-attribute-warning.production.js'), 'export const branch = "published-production";');
    await writeFile(join(packageDirectory, 'dist/internal/development.js'), 'export const branch = "published-development";');
    await writeFile(join(packageDirectory, 'src/internal/dev-mode-attribute-warning.production.ts'), 'export const branch = "contributor-source";');
    const { esbuild } = await buildContext();
    const options = { absWorkingDir: scratch, entryPoints: ['packages/lyra-ui/dist/entry.js'], bundle: true, write: false, format: 'esm', platform: 'browser', metafile: true, logLevel: 'silent' };
    const contributorResolution = await esbuild.build(options);
    assert.ok(Object.keys(contributorResolution.metafile.inputs).some(file => file.includes('/src/')));
    assert.throws(() => Object.keys(contributorResolution.metafile.inputs).forEach(file => profileInputKey(resolve(scratch, file), scratch, scratch)), /rejected packages\/lyra-ui\/src/u);
    const production = await esbuild.build({ ...options, ...profileBrowserResolution() });
    assert.ok(Object.keys(production.metafile.inputs).some(file => file.endsWith('/dist/internal/dev-mode-attribute-warning.production.js')));
    assert.doesNotThrow(() => Object.keys(production.metafile.inputs).forEach(file => profileInputKey(resolve(scratch, file), scratch, scratch)));
    assert.ok(production.outputFiles[0].text.includes('published-production'));
    assert.equal(production.outputFiles[0].text.includes('contributor-source'), false);
    assert.equal(production.outputFiles[0].text.includes('published-development'), false);
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
