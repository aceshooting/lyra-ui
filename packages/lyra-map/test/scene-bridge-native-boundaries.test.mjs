import assert from 'node:assert/strict';
import test from 'node:test';
import { absolute, fixture, latest, packet, sanitized } from './scene-bridge-fixture.mjs';

for (const method of ['addLayer', 'removeLayer', 'getLayer', 'getCanvas', 'isStyleLoaded', 'triggerRepaint',
  'getCenter', 'getZoom', 'getPitch', 'getBearing', 'getTerrain', 'getProjection', 'on', 'off']) {
  test(`a map without ${method} refuses bridge construction before native work`, () => {
    const item = fixture(); item.map[method] = undefined;
    assert.throws(() => item.start(), TypeError);
    assert.equal(item.nativeEvents.count(), 0); assert.equal(item.canvasEvents.count(), 0);
    assert.equal(item.calls.subscribe, 0); assert.equal(item.calls.add.length, 0);
  });
}

test('a refused native repaint request is reported as an engine failure and later requests recover', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) });
  let refuse = true, requests = 0;
  item.map.triggerRepaint = () => { requests++; if (refuse) throw new Error('Repaint unavailable'); };
  item.start();
  try {
    await item.ready(); await item.frames();
    assert.deepEqual(item.errors, ['engine']);
    assert.equal(latest(item).state, 'installed');
    refuse = false;
    const before = requests;
    item.replace(packet({ acceptedSceneRevision: 2, presentationRevision: 2, markers: [absolute()] }));
    await item.ready(); await item.frames();
    assert.ok(requests > before);
    assert.deepEqual(item.errors, ['engine']);
    assert.equal(latest(item).acceptedSceneRevision, 2);
    sanitized(item);
  } finally { item.stop(); }
});

test('a non-finite native view is refused as an engine failure without a new installation', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) });
  item.start();
  try {
    await item.ready(); await item.frames();
    const installed = item.states.length;
    item.view({ center: { lng: Number.NaN, lat: 0 } }); await item.ready(); await item.frames();
    assert.deepEqual(item.errors, ['engine']);
    assert.equal(item.states.length, installed);
    sanitized(item);
  } finally { item.stop(); }
  assert.equal(item.nativeEvents.count(), 0); assert.equal(item.canvasEvents.count(), 0);
});
