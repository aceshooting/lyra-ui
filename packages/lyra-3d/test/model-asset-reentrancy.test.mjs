import assert from 'node:assert/strict';
import test from 'node:test';
import { BufferGeometry, Material } from 'three';
import { prepareModelAsset, instantiatePreparedModel } from '../dist/model/model-asset.js';
import { glbWithImage, png, triangleJson, utf8 } from './model-fixtures.mjs';

function ledger(onReserve = () => {}) {
  const live = new Map(), releases = new Map();
  let serial = 0;
  return {
    live, releases,
    reserve(request) {
      const key = `buffer-${serial++}`;
      live.set(key, request.byteLength);
      onReserve(request);
      return { key, release() {
        releases.set(key, (releases.get(key) ?? 0) + 1);
        live.delete(key);
      } };
    },
    admitCounts() {},
    noteNativeImage() {}
  };
}

function assertRetired(budget) {
  assert.equal(budget.live.size, 0);
  assert.ok(budget.releases.size > 0, 'the callback returned an owned lease');
  assert.ok([...budget.releases.values()].every(count => count === 1), 'each lease retires once');
}

for (const purpose of ['encoded', 'embedded']) {
  test(`${purpose} reservation abort retires its returned lease before constructing owned bytes`, async () => {
    const controller = new AbortController();
    const bytes = purpose === 'encoded' ? utf8('1 2 3\n') : utf8(JSON.stringify(triangleJson()));
    const budget = ledger(request => { if (request.purpose === purpose) controller.abort(); });
    const Native = globalThis.Uint8Array;
    let constructorsAfterAbort = 0;
    globalThis.Uint8Array = new Proxy(Native, { construct(target, args) {
      // Before reserve, snapshot creates a view. Count only constructors after cancellation.
      if (controller.signal.aborted) constructorsAfterAbort++;
      return Reflect.construct(target, args, target);
    } });
    try {
      await assert.rejects(prepareModelAsset({ format: purpose === 'encoded' ? 'xyz' : 'gltf', bytes },
        { execution: 'local', budget, signal: controller.signal }), { name: 'AbortError' });
    } finally {
      globalThis.Uint8Array = Native;
    }
    assertRetired(budget);
    assert.equal(constructorsAfterAbort, 0, 'cancellation must unwind before the reserved constructor');
  });
}

test('conversion reservation abort disposes already constructed epoch wrappers and preserves its CPU asset', async () => {
  const owner = ledger();
  const asset = await prepareModelAsset({ format: 'xyz', bytes: utf8('1 2 3 255 0 0\n') },
    { execution: 'local', budget: owner });
  const controller = new AbortController();
  let conversions = 0, geometryDisposals = 0, materialDisposals = 0, constructorsAfterAbort = 0;
  const budget = ledger(request => {
    if (request.purpose === 'color-conversion') { conversions++; controller.abort(); }
  });
  const Native = globalThis.Float32Array;
  const disposeGeometry = BufferGeometry.prototype.dispose;
  const disposeMaterial = Material.prototype.dispose;
  globalThis.Float32Array = new Proxy(Native, { construct(target, args) {
    if (controller.signal.aborted) constructorsAfterAbort++;
    return Reflect.construct(target, args, target);
  } });
  BufferGeometry.prototype.dispose = function () { geometryDisposals++; return disposeGeometry.call(this); };
  Material.prototype.dispose = function () { materialDisposals++; return disposeMaterial.call(this); };
  let recovered;
  try {
    try {
      await assert.rejects(instantiatePreparedModel(asset, { budget, signal: controller.signal }), { name: 'AbortError' });
    } finally {
      globalThis.Float32Array = Native;
      BufferGeometry.prototype.dispose = disposeGeometry;
      Material.prototype.dispose = disposeMaterial;
    }
    assert.equal(conversions, 1, 'fixture must reach the conversion reservation');
    assertRetired(budget);
    assert.equal(geometryDisposals, 1, 'geometry created before conversion must retire on callback abort');
    assert.equal(materialDisposals, 1, 'material created before conversion must retire on callback abort');
    assert.equal(constructorsAfterAbort, 0);
    assert.ok(owner.live.size > 0, 'failed epoch must not retire its retained CPU asset');
    recovered = await instantiatePreparedModel(asset, { budget: owner });
    const positions = [];
    recovered.object.traverse(node => {
      if (node.geometry) positions.push(...node.geometry.getAttribute('position').array);
    });
    assert.deepEqual(positions, [1, 2, 3]);
  } finally {
    recovered?.dispose();
    asset.dispose();
  }
  assertRetired(owner);
});

test('image admission callback abort prevents the next decode and closes earlier accepted bitmaps', async () => {
  const controller = new AbortController(), budget = ledger();
  let admitted = 0, decoded = 0, closed = 0;
  budget.noteNativeImage = () => { if (++admitted === 2) controller.abort(); };
  const bytes = glbWithImage(png(), 'image/png', document => {
    document.images.push({ ...document.images[0] });
  });
  await assert.rejects(prepareModelAsset({ format: 'glb', bytes },
    { execution: 'local', budget, signal: controller.signal }, {
      async decodeImage() {
        decoded++;
        return { width: 1, height: 1, close() { closed++; } };
      }
    }), { name: 'AbortError' });
  assert.equal(admitted, 2, 'fixture reaches second image admission');
  assertRetired(budget);
  assert.equal(decoded, 1, 'an aborted admission callback must not start another image decode');
  assert.equal(closed, 1, 'the previously accepted bitmap is closed once');
});

for (const retainInstance of [false, true]) {
  test(`image close reentrancy retires an asset once${retainInstance ? ' after its last epoch' : ''}`, async () => {
    const budget = ledger();
    let asset, instance, closed = 0;
    asset = await prepareModelAsset({ format: 'glb', bytes: glbWithImage(png(), 'image/png') },
      { execution: 'local', budget }, {
        async decodeImage() {
          return { width: 1, height: 1, close() {
            closed++;
            if (closed === 1) asset.dispose();
          } };
        }
      });
    try {
      if (retainInstance) instance = await instantiatePreparedModel(asset, { budget });
      asset.dispose();
      if (retainInstance) assert.equal(closed, 0, 'live epoch defers retirement');
      instance?.dispose();
      assert.equal(closed, 1, 'reentrant cleanup must not close the same bitmap twice');
      assertRetired(budget);
      await assert.rejects(instantiatePreparedModel(asset, { budget }));
    } finally {
      instance?.dispose();
      asset.dispose();
    }
  });
}
