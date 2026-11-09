import assert from 'node:assert/strict';
import test from 'node:test';
import { createSceneBridge } from '../src/scene/bridge.mjs';
import { fixture, packet, absolute, latest, sanitized, events, ownedLive } from './scene-bridge-fixture.mjs';

for (const [name, change] of [
  ['missing revision', input => { delete input.acceptedSceneRevision; }],
  ['zero scene revision', input => { input.acceptedSceneRevision = 0; }],
  ['fractional presentation revision', input => { input.presentationRevision = 1.5; }],
  ['non-boolean motion', input => { input.reducedMotion = 'true'; }],
  ['negative padding', input => { input.allocation.padding.top = -1; }],
  ['nonfinite padding', input => { input.allocation.padding.left = NaN; }],
  ['non-array markers', input => { input.markers = {}; }],
  ['subclassed markers', input => { input.markers = new (class extends Array {})(...input.markers); }],
  ['sparse markers', input => { input.markers = Array(1); }],
  ['excessive markers', input => { input.markers = Array(2001).fill(input.markers[0]); }],
  ['invalid marker color size', input => { input.markers[0].rgba = [1, 1, 1]; }],
  ['invalid marker altitude reference', input => { input.markers[0].position.altitudeReference = 'relative'; }],
]) {
  test(`bridge rejects ${name} without allocating and recovers on a valid packet`, async () => {
    const input = structuredClone(packet({ markers: [absolute()] })); change(input);
    const item = fixture({ input }); item.start();
    try {
      await item.ready(); await item.frames();
      assert.equal(item.calls.add.length, 0); assert.equal(item.gpu.created.size, 0);
      assert.ok(item.errors.length > 0);
      item.replace(packet({ acceptedSceneRevision: 2, presentationRevision: 2, markers: [absolute()] }));
      await item.ready(); await item.frames();
      assert.equal(latest(item).state, 'installed'); assert.equal(latest(item).acceptedSceneRevision, 2);
      assert.ok(item.gpu.draws.length > 0); sanitized(item);
    } finally { item.stop(); }
    assert.equal(item.nativeEvents.count(), 0); assert.equal(item.canvasEvents.count(), 0);
  });
}

test('null packets and accessor-bearing marker records fail without invoking caller getters', async () => {
  const item = fixture(); item.replace(null); item.start();
  let reads = 0;
  try {
    await item.ready(); assert.equal(item.calls.add.length, 0); assert.ok(item.errors.length > 0);
    const input = structuredClone(packet({ markers: [absolute()] }));
    Object.defineProperty(input.markers[0], 'id', { get() { reads++; return 'injected'; } });
    item.replace(input); await item.ready();
    assert.equal(reads, 0); assert.equal(item.gpu.created.size, 0);
    item.replace(packet({ markers: [absolute()] })); await item.ready(); await item.frames();
    assert.equal(latest(item).state, 'installed');
  } finally { item.stop(); }
});

for (const method of ['captureInput', 'subscribeInput', 'claimPaintSerial', 'captureCameraFacts']) {
  test(`missing completion ${method} refuses construction before listener installation`, () => {
    const item = fixture();
    item.host.completion = { captureInput() {}, subscribeInput() {}, claimPaintSerial() {}, captureCameraFacts() {} };
    item.host.completion[method] = null;
    assert.throws(() => item.start(), TypeError);
    assert.equal(item.nativeEvents.count(), 0); assert.equal(item.canvasEvents.count(), 0);
    assert.equal(item.calls.subscribe, 0);
  });
}

for (const field of ['isCurrent', 'captureRenderInput', 'subscribeRenderInput', 'onState', 'onError']) {
  test(`missing host ${field} refuses construction without native work`, () => {
    const item = fixture(); item.host[field] = null;
    assert.throws(() => item.start(), TypeError);
    assert.equal(item.nativeEvents.count(), 0); assert.equal(item.canvasEvents.count(), 0);
    assert.equal(item.gpu.created.size, 0);
  });
}

for (const canvas of [null, {}, { addEventListener() {} }, { removeEventListener() {} }]) {
  test(`incomplete native canvas ${Object.keys(canvas ?? {}).join(',') || 'none'} refuses construction`, () => {
    const item = fixture(); item.map.getCanvas = () => canvas;
    assert.throws(() => item.start(), TypeError);
    assert.equal(item.nativeEvents.count(), 0); assert.equal(item.calls.subscribe, 0);
  });
}

test('a failed input subscription unwinds all listeners registered during bridge construction', () => {
  const item = fixture();
  item.host.subscribeRenderInput = () => { throw new Error('Input subscription failed'); };
  assert.throws(() => createSceneBridge(item.map, item.host), /Input subscription failed/);
  assert.equal(item.nativeEvents.count(), 0);
  assert.equal(item.canvasEvents.count(), 0);
  assert.equal(item.gpu.created.size, 0);
});

for (const operation of ['native observer', 'canvas observer']) {
  test(`failed bridge construction preserves its original cause when removing a ${operation} also throws`, () => {
    const item = fixture(), failure = new Error('Input subscription failed');
    item.host.subscribeRenderInput = () => { throw failure; };
    if (operation === 'native observer') {
      const off = item.map.off;
      item.map.off = (name, callback) => { off(name, callback); throw new Error('Native cleanup failed'); };
    } else {
      const remove = item.gl.canvas.removeEventListener;
      item.gl.canvas.removeEventListener = (...args) => { remove(...args); throw new Error('Canvas cleanup failed'); };
    }
    assert.throws(() => item.start(), error => error === failure);
    assert.equal(item.nativeEvents.count(), 0); assert.equal(item.canvasEvents.count(), 0);
  });

  test(`bridge disposal completes resource retirement despite a throwing ${operation}`, async () => {
    const item = fixture({ input: packet({ markers: [absolute()] }) }); item.start();
    await item.ready(); await item.frames(); assert.ok(ownedLive(item, 'Program').length > 0);
    if (operation === 'native observer') {
      const off = item.map.off;
      item.map.off = (name, callback) => { off(name, callback); throw new Error('Native cleanup failed'); };
    } else {
      const remove = item.gl.canvas.removeEventListener;
      item.gl.canvas.removeEventListener = (...args) => { remove(...args); throw new Error('Canvas cleanup failed'); };
    }
    assert.doesNotThrow(() => item.stop()); await item.ready();
    assert.equal(item.nativeEvents.count(), 0); assert.equal(item.canvasEvents.count(), 0);
    assert.equal(item.calls.unsubscribe, 1); assert.equal(item.layers.size, 0);
    for (const kind of ['Program', 'Shader', 'VertexArray', 'Buffer', 'Texture']) assert.equal(ownedLive(item, kind).length, 0);
  });
}

for (const cleanupThrows of [false, true]) test(`failed visibility registration releases the attached listener${cleanupThrows ? ' even when removal throws' : ''}`, () => {
  const item = fixture(), visibility = events(), failure = new Error('Visibility registration failed');
  item.host.completion = { captureInput() {}, subscribeInput() { return () => {}; }, claimPaintSerial() {}, captureCameraFacts() {} };
  item.gl.canvas.ownerDocument = {
    hidden: false,
    addEventListener(name, callback) { visibility.add(name, callback); throw failure; },
    removeEventListener(name, callback) { visibility.remove(name, callback); if (cleanupThrows) throw new Error('Visibility cleanup failed'); },
  };
  assert.throws(() => item.start(), error => error === failure);
  assert.equal(visibility.count(), 0); assert.equal(item.nativeEvents.count(), 0);
  assert.equal(item.canvasEvents.count(), 0);
});

for (const event of ['move', 'resize', 'terrain', 'projectiontransition', 'sourcedata', 'style.load', 'render']) {
  test(`failed ${event} listener registration unwinds an interrupted native subscription`, () => {
    const item = fixture(), on = item.map.on;
    item.map.on = (name, callback) => {
      on(name, callback);
      if (name === event) throw new Error('Native registration failed');
      return item.map;
    };
    assert.throws(() => item.start(), /Native registration failed/);
    assert.equal(item.nativeEvents.count(), 0); assert.equal(item.canvasEvents.count(), 0);
  });
}

for (const event of ['webglcontextlost', 'webglcontextrestored']) {
  test(`failed ${event} listener registration retires both canvas and map observers`, () => {
    const item = fixture(), add = item.gl.canvas.addEventListener;
    item.gl.canvas.addEventListener = (name, callback, options) => {
      add(name, callback, options);
      if (name === event) throw new Error('Canvas registration failed');
    };
    assert.throws(() => item.start(), /Canvas registration failed/);
    assert.equal(item.nativeEvents.count(), 0); assert.equal(item.canvasEvents.count(), 0);
  });
}

test('synchronous abort during subscription releases the returned subscription once', async () => {
  const item = fixture(), subscribe = item.host.subscribeRenderInput;
  item.host.subscribeRenderInput = callback => {
    const release = subscribe(callback); item.controller.abort(); return release;
  };
  item.start(); await item.ready();
  assert.equal(item.calls.unsubscribe, 1); assert.equal(item.calls.add.length, 0);
  assert.equal(item.nativeEvents.count(), 0); assert.equal(item.canvasEvents.count(), 0);
  item.stop(); assert.equal(item.calls.unsubscribe, 1);
});

test('a missing release callback rejects construction and removes native observers', () => {
  const item = fixture(); item.host.subscribeRenderInput = () => undefined;
  assert.throws(() => item.start(), TypeError);
  assert.equal(item.nativeEvents.count(), 0); assert.equal(item.canvasEvents.count(), 0);
});

test('throwing presentation and unsubscribe callbacks cannot prevent native cleanup', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }), subscribe = item.host.subscribeRenderInput;
  item.controls.onState = () => { throw new Error('Presentation failed'); };
  item.host.subscribeRenderInput = callback => {
    const release = subscribe(callback); return () => { release(); throw new Error('Subscription cleanup failed'); };
  };
  item.start(); await item.ready(); await item.frames();
  assert.ok(item.gpu.draws.length > 0);
  item.stop(); await item.ready();
  assert.equal(item.calls.unsubscribe, 1);
  assert.equal(item.nativeEvents.count(), 0); assert.equal(item.canvasEvents.count(), 0);
});

test('a missing optional preparation method still permits ordinary native layer installation', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); delete item.map.prepareFeatures;
  item.start();
  try {
    await item.ready(); await item.frames();
    assert.equal(item.calls.add.length, 1); assert.ok(item.gpu.draws.length > 0);
    assert.equal(latest(item).state, 'installed');
  } finally { item.stop(); }
});
