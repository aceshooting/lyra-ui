import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import { buildSceneFixture } from './scene-built-fixture.mjs';

// This probe imports the built package in a separate Node process. Under mutation testing that build
// serializes instrumented preparation code the child process cannot resolve, so the probe stays out of
// the mutation run (stryker.config.mjs) and runs in the ordinary suite.
let built;
before(async () => { built = await buildSceneFixture(); });
after(() => built?.remove());

test('the optional scene package export resolves its runtime and neutral declarations', async () => {
  const manifest = JSON.parse(await readFile(join(built.directory, 'package.json'), 'utf8'));
  assert.deepEqual(manifest.exports['./scene'], {
    types: './dist/scene.d.ts', import: './dist/scene.mjs'
  });
  assert.deepEqual(Object.keys(manifest.exports).sort(), ['.', './vite', './worker', './map.css', './package.json', './scene',
    ...['attribution', 'navigation', 'geolocate', 'scale', 'fullscreen', 'terrain', 'globe', 'logo'].map(name => `./controls/${name}`)].sort(),
  'the package exposes only its reviewed entry points');
  const declaration = await readFile(join(built.directory, 'dist/scene.d.ts'), 'utf8');
  assert.match(declaration, /\bcreateSceneBridge\b/u);
  const probe = join(built.directory, 'scene-package-probe.mjs');
  await writeFile(probe, `
import assert from 'node:assert/strict';
import * as scene from '@aceshooting/lyra-map/scene';
import * as map from '@aceshooting/lyra-map';
assert.deepEqual(Object.keys(scene), ['createSceneBridge', 'createSceneLayer']);
assert.equal(typeof scene.createSceneBridge, 'function');
assert.equal(typeof scene.createSceneLayer, 'function');
for (const name of ['createSceneBridge', 'withNativeTerrainHookScope', 'captureNativeTerrainAuthority', 'assertNativeTerrainAuthority',
  'registerNativeFrameDemand', 'beginNativeFrame', 'captureNativeFrameAuthority', 'readNativeFrameAuthority']) {
  assert.equal(Object.hasOwn(map, name), false, name + ' is not a default map export');
}
for (const path of ['native-terrain-authority', 'src/scene/native-terrain-authority.mjs', 'dist/scene/native-terrain-authority.mjs',
  'native-frame-authority', 'src/scene/native-frame-authority.mjs', 'dist/scene/native-frame-authority.mjs']) {
  await assert.rejects(import('@aceshooting/lyra-map/' + path), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
}
`);
  const result = spawnSync(process.execPath, [probe], { cwd: built.directory, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
