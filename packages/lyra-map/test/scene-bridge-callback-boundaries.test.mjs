import assert from 'node:assert/strict';
import test from 'node:test';
import { withNativeTerrainHookScope } from '../src/scene/native-terrain-authority.mjs';
import { absolute, fixture, latest, marker, ownedLive, packet, sampleCalls, sanitized } from './scene-bridge-fixture.mjs';

for (const captureNumber of [2, 3]) {
  test(`capture ${captureNumber} retiring the host prevents stale input installation`, async () => {
    const item = fixture({ input: packet({ markers: [absolute()] }) });
    let captures = 0;
    item.controls.onCapture = () => { if (++captures === captureNumber) item.expire(); };
    item.start();
    try {
      await item.ready(); await item.frames();
      assert.equal(captures, captureNumber);
      assert.equal(item.calls.prepare.length, 0);
      assert.equal(item.calls.add.length, 0);
      assert.equal(item.gpu.created.size, 0);
      assert.deepEqual(item.states, []);
      assert.deepEqual(item.errors, []);
    } finally { item.stop(); }
    assert.equal(item.calls.unsubscribe, 1);
    assert.equal(item.nativeEvents.count(), 0);
    assert.equal(item.canvasEvents.count(), 0);
  });
}

test('native view capture retiring the host prevents installation after the view read', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) });
  const getCenter = item.map.getCenter;
  item.map.getCenter = () => { item.expire(); return getCenter(); };
  item.start();
  try {
    await item.ready(); await item.frames();
    assert.equal(item.calls.prepare.length, 0);
    assert.equal(item.calls.add.length, 0);
    assert.equal(item.gpu.created.size, 0);
    assert.deepEqual(item.states, []);
    assert.deepEqual(item.errors, []);
  } finally { item.stop(); }
});

test('pending presentation retiring the host cancels the layer before feature preparation', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) });
  item.controls.onState = value => { if (value.state === 'pending') item.expire(); };
  item.start();
  try {
    await item.ready(); await item.frames();
    assert.deepEqual(item.states.map(value => value.state), ['pending']);
    assert.equal(item.calls.prepare.length, 0);
    assert.equal(item.calls.add.length, 0);
    assert.equal(item.gpu.created.size, 0);
    sanitized(item);
  } finally { item.stop(); }
  assert.equal(item.nativeEvents.count(), 0);
  assert.equal(item.canvasEvents.count(), 0);
});

test('projection callback reentry cannot recursively draw the same native layer', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) });
  item.start();
  try {
    await item.ready();
    const layer = item.calls.add[0].layer;
    const project = item.args.getProjectionData;
    let projections = 0;
    item.args.getProjectionData = args => {
      projections++;
      layer.render(item.gl, item.args);
      return project(args);
    };
    await item.callback();
    assert.equal(projections, 1);
    assert.equal(item.gpu.draws.length, 1);
    assert.deepEqual(item.errors, []);
    assert.equal(latest(item).state, 'installed');
    sanitized(item);
  } finally { item.stop(); }
  assert.equal(ownedLive(item, 'Program').length, 0);
  assert.equal(item.canvasEvents.count(), 0);
});

test('a projection callback replacing accepted input cannot draw its stale marker packet', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) });
  item.start();
  try {
    await item.ready();
    const project = item.args.getProjectionData;
    let replaced = false;
    item.args.getProjectionData = args => {
      if (!replaced) {
        replaced = true;
        item.replace(packet({ acceptedSceneRevision: 2, presentationRevision: 2, markers: [absolute('replacement')] }));
      }
      return project(args);
    };
    await item.callback();
    assert.equal(replaced, true);
    assert.equal(item.gpu.draws.length, 0);
    assert.equal(latest(item).acceptedSceneRevision, 2);
    await item.callback();
    assert.equal(item.gpu.draws.length, 1);
    assert.equal(latest(item).state, 'installed');
    sanitized(item);
  } finally { item.stop(); }
});

test('a previously issued terrain hook outside its native scope cannot authorize bridge drawing', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) });
  withNativeTerrainHookScope(item.gl, item.args.renderTerrainHeightMap, () => {});
  item.start();
  try {
    await item.ready(); await item.callback();
    assert.equal(item.gpu.draws.length, 0);
    assert.equal(item.gpu.created.size, 0);
    assert.ok(item.errors.includes('render'));
    sanitized(item);
  } finally { item.stop(); }
  assert.equal(item.nativeEvents.count(), 0);
  assert.equal(item.canvasEvents.count(), 0);
});

test('a native layer installed on another canvas refuses bridge graphics allocation', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) });
  const foreign = fixture();
  const add = item.map.addLayer;
  item.map.addLayer = (layer, before) => {
    const onAdd = layer.onAdd;
    layer.onAdd = function (map) { return onAdd.call(this, map, foreign.gl); };
    return add(layer, before);
  };
  item.start();
  try {
    await item.ready(); await item.frames();
    assert.equal(item.gpu.created.size, 0);
    assert.equal(foreign.gpu.created.size, 0);
    assert.equal(item.gpu.draws.length, 0);
    assert.ok(item.errors.length > 0);
    sanitized(item);
  } finally { item.stop(); foreign.stop(); }
  assert.equal(item.nativeEvents.count(), 0);
  assert.equal(item.canvasEvents.count(), 0);
});

test('a failing native ownership lookup during queued input redraw remains isolated and recovers', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) });
  item.start();
  try {
    await item.ready(); await item.callback();
    const layer = item.calls.add[0].layer;
    const draws = item.gpu.draws.length;
    const getLayer = item.map.getLayer;
    item.replace(packet({ acceptedSceneRevision: 2, presentationRevision: 2, markers: [absolute('replacement')] }));
    item.map.getLayer = () => { throw new Error('Native ownership lookup unavailable'); };
    try {
      assert.doesNotThrow(() => layer.render(item.gl, item.args));
      assert.equal(item.gpu.draws.length, draws);
    } finally { item.map.getLayer = getLayer; }
    await item.ready(); await item.callback();
    assert.equal(latest(item).acceptedSceneRevision, 2);
    assert.equal(latest(item).state, 'installed');
    assert.ok(item.gpu.draws.length > draws);
    sanitized(item);
  } finally { item.stop(); }
});

test('visibility retirement during a native context check prevents the in-flight graphics operation', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) });
  item.start();
  try {
    await item.ready();
    const isContextLost = item.gl.isContextLost;
    let hidden = false;
    item.gl.isContextLost = () => {
      if (!hidden) { hidden = true; item.bridge.setVisible(false); }
      return isContextLost();
    };
    await item.callback();
    assert.equal(hidden, true);
    assert.equal(item.gpu.draws.length, 0);
    item.gl.isContextLost = isContextLost;
    item.bridge.setVisible(true);
    item.replace(packet({ acceptedSceneRevision: 2, presentationRevision: 2, markers: [absolute()] }));
    await item.ready(); await item.callback();
    assert.equal(item.gpu.draws.length, 1);
    assert.equal(latest(item).state, 'installed');
    sanitized(item);
  } finally { item.stop(); }
});


test('replacing a terrain marker with an absolute position releases its old terrain demand', async () => {
  const item = fixture({ input: packet({ markers: [marker('ground'), absolute('other')] }) });
  item.gpu.setCoverage(125, 1);
  item.start();
  try {
    await item.ready(); await item.frames();
    assert.equal(sampleCalls(item), 1);
    assert.ok(item.gpu.draws.length > 0);
    const samples = sampleCalls(item);
    item.replace(packet({ acceptedSceneRevision: 2, presentationRevision: 2,
      markers: [absolute('ground'), absolute('other')] }));
    await item.ready();
    const draws = item.gpu.draws.length;
    item.nativeEvents.emit('move');
    await item.frames();
    assert.equal(sampleCalls(item), samples, 'removed terrain demand must not be sampled after a view change');
    assert.ok(item.gpu.draws.length > draws);
    assert.equal(latest(item).acceptedSceneRevision, 2);
    assert.equal(latest(item).state, 'installed');
    sanitized(item);
  } finally { item.stop(); }
  for (const kind of ['Program', 'Shader', 'VertexArray', 'Buffer', 'Texture']) assert.equal(ownedLive(item, kind).length, 0);
  assert.equal(item.canvasEvents.count(), 0);
});

test('native redraw retirement during reconciliation cannot publish an installation with no layer', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) });
  item.start();
  try {
    await item.ready(); await item.callback();
    assert.equal(item.gpu.draws.length, 1);
    const layer = item.calls.add[0].layer;
    const getLayer = item.map.getLayer;
    const project = item.args.getProjectionData;
    let lookups = 0, redrawn = false;
    item.map.getLayer = id => {
      if (++lookups === 2) {
        redrawn = true;
        item.args.getProjectionData = () => { throw new Error('Projection unavailable during native redraw'); };
        try { assert.doesNotThrow(() => layer.render(item.gl, item.args)); }
        finally { item.args.getProjectionData = project; }
      }
      return getLayer(id);
    };
    try {
      item.replace(packet({ acceptedSceneRevision: 2, presentationRevision: 2, markers: [absolute('replacement')] }));
      await item.ready();
    } finally { item.map.getLayer = getLayer; item.args.getProjectionData = project; }
    assert.equal(redrawn, true, 'the reconciliation lookup must enter the native redraw');
    assert.ok(item.errors.includes('render'), 'the native redraw must retire its failed callback');
    const strandedInstallation = latest(item).state === 'installed' && latest(item).acceptedSceneRevision === 2 && item.layers.size === 0;
    const draws = item.gpu.draws.length;
    item.replace(packet({ acceptedSceneRevision: 3, presentationRevision: 3, markers: [absolute('recovered')] }));
    await item.ready(); await item.callback();
    assert.equal(latest(item).state, 'installed');
    assert.equal(latest(item).acceptedSceneRevision, 3);
    assert.equal(item.layers.size, 1);
    assert.ok(item.gpu.draws.length > draws, 'a later accepted packet must produce a live native draw');
    assert.equal(strandedInstallation, false, 'revision 2 must not report installed after its native lifetime was retired');
    sanitized(item);
  } finally { item.stop(); }
  assert.equal(item.nativeEvents.count(), 0);
  assert.equal(item.canvasEvents.count(), 0);
});
