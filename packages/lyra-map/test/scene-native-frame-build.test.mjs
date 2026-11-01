import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { buildSceneFixture } from './scene-built-fixture.mjs';
import { authority as sourceAuthority, nativePaintFixture, attachBuiltBridge, loadTransformedNative } from './fixtures/scene-native-frame-build.mjs';

test('the real built native issuer and optional bridge share one private registry while dormant routes stay inactive', async () => {
  const built = await buildSceneFixture();
  const load = chunk => import(pathToFileURL(join(built.directory, 'dist', chunk.file)).href);
  const owner = suffix => {
    const matches = built.graph.filter(chunk => chunk.modules.some(id => id.endsWith(suffix)));
    assert.equal(matches.length, 1, `one physical owner for ${suffix}`); return matches[0];
  };
  try {
    const painterChunk = owner('/render/painter.ts'), customChunk = owner('/webgl/draw/draw_custom.ts');
    const registryChunk = owner('/src/scene/native-frame-authority.mjs'), sceneChunk = owner('/src/scene/index.mjs');
    assert.equal(built.graph.flatMap(chunk => chunk.modules).filter(id => id.endsWith('/native-frame-authority.mjs')).length, 1);
    for (const chunk of [painterChunk, customChunk, sceneChunk]) assert.equal(built.reachable(chunk).has(registryChunk.file), true);
    const roots = built.graph.filter(chunk => chunk.facade?.includes('lyra-map-entry')); assert.equal(roots.length, 1);
    const reachable = built.reachable(roots[0]);
    for (const chunk of built.graph) for (const id of chunk.modules) {
      if (/\/(?:bridge|bridge-glyph|completion|completion-data|completion-observation)\.mjs$/u.test(id) || /\/node_modules\/(?:\.pnpm\/three@[^/]+\/node_modules\/)?three\//u.test(id)) {
        assert.equal(reachable.has(chunk.file), false, `${id} is outside the default native graph`);
      }
    }
    const [{ Painter }, { drawCustom }, registry, scene, mapExports] = await Promise.all([
      load(painterChunk), load(customChunk), load(registryChunk),
      import(pathToFileURL(join(built.directory, 'dist/scene.mjs')).href),
      import(pathToFileURL(join(built.directory, 'dist/index.mjs')).href)
    ]);
    assert.equal(typeof Painter, 'function'); assert.equal(typeof drawCustom, 'function');
    assert.deepEqual(Object.keys(scene), ['createSceneBridge']);
    for (const name of Object.keys(registry)) assert.equal(Object.hasOwn(mapExports, name), false, name);
    const manifest = JSON.parse(await readFile(join(built.directory, 'package.json'), 'utf8'));
    assert.ok(Object.keys(manifest.exports).every(key => !key.includes('native-frame') && !key.includes('native-terrain')));
    const provenance = JSON.parse(await readFile(join(built.directory, 'dist/provenance.json'), 'utf8'));
    assert.ok(provenance.changedSourceFiles.includes('webgl/draw/draw_custom.ts'));
    assert.doesNotMatch(await readFile(join(built.directory, 'dist', customChunk.file), 'utf8'), /withNativeTerrainHookScope/u,
      'phase issuance does not authorize reduced terrain preservation');

    const native = { Painter, drawCustom };
    const original = await loadTransformedNative({ enabled: false }), baseline = nativePaintFixture(original); baseline.render();
    const dormant = nativePaintFixture(native, { registry });
    dormant.render(); assert.equal(dormant.projectionReads, 0); assert.equal(registry.hasNativeFrameDemand(dormant.gl), false);
    assert.equal(dormant.captures.at(-1).status, 'unqualified');
    assert.deepEqual(dormant.layerReads, baseline.layerReads, 'built dormant painter does not collect layer metadata');
    const marker = await attachBuiltBridge(dormant, scene.createSceneBridge, false);
    try {
      const baselineBefore = { ...baseline.layerReads }; baseline.setOffscreen(true); baseline.render();
      const before = { ...dormant.layerReads };
      await marker.paint(); assert.ok(dormant.gpu.draws.length > 0, 'the built marker callback actually executes');
      assert.equal(dormant.projectionReads, 0); assert.equal(registry.hasNativeFrameDemand(dormant.gl), false);
      assert.equal(dormant.gpu.calls.some(call => ['createQuery', 'fenceSync'].includes(call[0])), false);
      assert.equal(dormant.gpu.raf.pending, 0); assert.deepEqual(marker.errors, []);
      assert.deepEqual({ id: dormant.layerReads.id - before.id, type: dormant.layerReads.type - before.type },
        { id: baseline.layerReads.id - baselineBefore.id, type: baseline.layerReads.type - baselineBefore.type },
        'the built marker-only route performs only original native layer reads');
    } finally { marker.close(); }

    const active = nativePaintFixture(native, { registry });
    const bridge = await attachBuiltBridge(active, scene.createSceneBridge);
    try {
      assert.equal(bridge.layers.size, 1); assert.equal(registry.hasNativeFrameDemand(active.gl), true);
      assert.equal(sourceAuthority.hasNativeFrameDemand(active.gl), false, 'source imports cannot share the generated capability registry');
      await bridge.paint();
      assert.equal(active.gpu.calls.filter(call => call[0] === 'createQuery').length, 2,
        'the production bridge issues through the actual generated native callback');
      await bridge.settle(); assert.equal(bridge.completed.length, 1); assert.deepEqual(bridge.errors, []);
      const frame = bridge.completed[0]; assert.equal(bridge.bridge.completion.current(frame, 'anchor', bridge.input.members[0].target.token), true);
      const layer = [...bridge.layers.values()][0].layer;
      const sourceRelease = sourceAuthority.registerNativeFrameDemand(active.gl, layer, layer.render);
      try {
        const fake = sourceAuthority.beginNativeFrame(active.gl, {}, { styleGeneration: 1,
          orderedLayers: [{ id: layer.id, type: 'custom' }], terrainEnabled: false, projection: 'mercator', projectionTransition: 0,
          debug: false, tailDraws: false });
        const args = {}, scope = sourceAuthority.enterNativeCustomRender(fake, layer, layer.render, args, { pass: 'translucent', currentLayer: 0 });
        const capture = sourceAuthority.captureNativeFrameAuthority(active.gl, layer, layer.render, args);
        assert.equal(capture.status, 'admitted');
        assert.throws(() => registry.readNativeFrameAuthority(capture.authority, active.gl, 'render'), TypeError);
        sourceAuthority.leaveNativeCustomRender(scope, true); sourceAuthority.sealNativeFrame(fake);
        assert.throws(() => registry.readNativeFrameAuthority(capture.authority, active.gl, 'completed'), TypeError);
        sourceAuthority.abortNativeFrame(fake);
      } finally { sourceRelease(); }
      await bridge.paint(); assert.equal(bridge.bridge.completion.current(frame, 'anchor', bridge.input.members[0].target.token), false);
      await bridge.settle(); assert.equal(bridge.completed.length, 2);
    } finally { bridge.close(); }
    assert.equal(registry.hasNativeFrameDemand(active.gl), false);
  } finally { await built.remove(); }
});
