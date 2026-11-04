import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import { pathToFileURL } from 'node:url';
import { buildSceneFixture } from './scene-built-fixture.mjs';

let built;
before(async () => { built = await buildSceneFixture(); });
after(() => built?.remove());

function oneOwner(source) {
  const owners = built.owning(source);
  assert.equal(owners.length, 1, `${source} belongs to exactly one emitted module`);
  return owners[0];
}

test('the scene facade loads its production bridge from the same generated graph', async () => {
  const scene = oneOwner('src/scene/index.mjs'), bridge = oneOwner('src/scene/bridge.mjs');
  assert.equal(built.reachable(scene, { dynamic: false }).has(bridge.file), true);
  const source = await readFile(join(built.directory, 'dist/scene.mjs'), 'utf8');
  assert.ok(source.includes(scene.file), 'the facade points into the observed production graph');
  const actual = await import(pathToFileURL(join(built.directory, 'dist/scene.mjs')).href);
  assert.deepEqual(Object.keys(actual), ['createSceneBridge']);
});

test('the default map graph cannot load the optional bridge, glyph renderer or Three', () => {
  oneOwner('src/scene/index.mjs');
  const roots = built.graph.filter(chunk => chunk.facade?.includes('lyra-map-entry'));
  assert.equal(roots.length, 1);
  const reachable = built.reachable(roots[0]);
  const forbidden = built.graph.filter(chunk => chunk.modules.some(id =>
    /\/(?:bridge|bridge-glyph)\.mjs$/u.test(id) || /\/node_modules\/(?:\.pnpm\/three@[^/]+\/node_modules\/)?three\//u.test(id)));
  assert.ok(forbidden.some(chunk => chunk.modules.includes(join(built.directory, 'src/scene/bridge.mjs'))));
  for (const chunk of forbidden) assert.equal(reachable.has(chunk.file), false, `${chunk.file} stays outside the default map graph`);
});

test('a full-fallback scene build does not claim native specialization from a helper registry', async () => {
  const scene = oneOwner('src/scene/index.mjs');
  const authorities = built.owning('src/scene/native-terrain-authority.mjs');
  const registryModules = built.graph.flatMap(chunk => chunk.modules.filter(id => id.endsWith('/native-terrain-authority.mjs')));
  assert.ok(registryModules.length <= 1, 'the scene graph cannot contain duplicated registry modules');
  assert.equal(registryModules.length, authorities.length, 'a registry must come from the package-owned source');
  const provenance = JSON.parse(await readFile(join(built.directory, 'dist/provenance.json'), 'utf8'));
  const changed = provenance.changedSourceFiles.includes('webgl/draw/draw_custom.ts');
  assert.equal(changed, true, 'the reviewed native phase hooks are independent of terrain specialization');
  const issuers = built.graph.filter(chunk => chunk.modules.some(id => id.endsWith('/webgl/draw/draw_custom.ts')));
  assert.equal(issuers.length, 1, 'the actual native custom-layer implementation is present once');
  const issuerReachable = built.reachable(issuers[0]);
  const issuerCode = await readFile(join(built.directory, 'dist', issuers[0].file), 'utf8');
  assert.doesNotMatch(issuerCode, /\bwithNativeTerrainHookScope\b/u, 'the unqualified native callback has no issuer wrapper');
  if (authorities.length) {
    assert.equal(built.reachable(scene).has(authorities[0].file), true);
    assert.equal(issuerReachable.has(authorities[0].file), false, 'a disabled build cannot reach an issuer registry');
  }
});
