import assert from 'node:assert/strict';
import test from 'node:test';
import { addPreparedFeatures } from '../scripts/prepared-mutations.mjs';

/** A map that records native calls; the tests exercise how descriptors reach the native methods. */
function harness() {
  const sources = new Map();
  const layers = new Map();
  const calls = [];
  return {
    style: {}, _removed: false, sources, layers, calls,
    on() {}, off() {},
    getLayersOrder: () => [...layers.keys()],
    getSource: (id) => sources.get(id),
    getLayer: (id) => layers.get(id),
    async prepareFeatures(requirements) { calls.push(['prepare', requirements]); },
    addSource(id, source) { calls.push(['source', id]); sources.set(id, source); return this; },
    removeSource(id) { sources.delete(id); return this; },
    addLayer(layer) { calls.push(['layer', layer.id]); layers.set(layer.id, layer); return this; },
    removeLayer(id) { layers.delete(id); return this; },
  };
}

/**
 * Installs a canvas class whose `width` accessor is brand checked by identity, as the platform's
 * is by internal slot (a prototype link alone does not pass); restores the global afterwards.
 */
async function withCanvasClass(run, { accessor = true } = {}) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'HTMLCanvasElement');
  const created = new WeakSet();
  class HTMLCanvasElement {
    constructor() { created.add(this); }
    static { if (accessor) Object.defineProperty(this.prototype, 'width', { get() {
      if (!created.has(this)) throw new TypeError('Illegal invocation');
      return 300;
    } }); }
  }
  Object.defineProperty(globalThis, 'HTMLCanvasElement', { configurable: true, writable: true, value: HTMLCanvasElement });
  try { await run(HTMLCanvasElement); }
  finally {
    if (previous) Object.defineProperty(globalThis, 'HTMLCanvasElement', previous);
    else delete globalThis.HTMLCanvasElement;
  }
}

const coordinates = () => [[0, 1], [1, 1], [1, 0], [0, 0]];
const canvasBatch = (canvas) => ({
  sources: { drawing: { type: 'canvas', canvas, coordinates: coordinates(), animate: false } },
  layers: [{ layer: { id: 'sketch', type: 'raster', source: 'drawing' } }],
});

test('a real canvas keeps its identity while the rest of the descriptor is copied', async () => {
  await withCanvasClass(async (Canvas) => {
    const map = harness();
    const canvas = new Canvas();
    const input = canvasBatch(canvas);
    assert.equal(await addPreparedFeatures(map, input), map);
    const admitted = map.sources.get('drawing');
    assert.equal(admitted.canvas, canvas, 'the same element is handed to the native source');
    assert.notEqual(admitted, input.sources.drawing);
    assert.notEqual(admitted.coordinates, input.sources.drawing.coordinates);
    assert.deepEqual(admitted.coordinates, coordinates());
    assert.deepEqual(map.calls.map(([kind, value]) => kind === 'prepare' ? kind : `${kind}:${value}`), ['prepare', 'source:drawing', 'layer:sketch']);
    assert.equal(map.calls[0][1].sources.drawing.canvas, canvas, 'preparation sees the same element');
  });
});

test('an element id string is a valid canvas reference', async () => {
  const map = harness();
  await addPreparedFeatures(map, canvasBatch('sketch-canvas'));
  assert.equal(map.sources.get('drawing').canvas, 'sketch-canvas');
});

test('objects that only look like canvases are rejected before preparation', async () => {
  await withCanvasClass(async (Canvas) => {
    for (const lookalike of [{ width: 300, getContext() {} }, Object.create(Canvas.prototype, { width: { value: 300 } }), Object.create(null), 7, true]) {
      const map = harness();
      await assert.rejects(addPreparedFeatures(map, canvasBatch(lookalike)), { code: 'invalid-descriptor' });
      assert.deepEqual(map.calls, [], 'nothing is prepared or added');
    }
  });
});

test('a platform canvas class without a width accessor cannot vouch for any canvas', async () => {
  await withCanvasClass(async (Canvas) => {
    const map = harness();
    await assert.rejects(addPreparedFeatures(map, canvasBatch(new Canvas())), { code: 'invalid-descriptor' });
    assert.deepEqual(map.calls, []);
  }, { accessor: false });
});

test('the canvas allowance applies only to canvas sources', async () => {
  await withCanvasClass(async (Canvas) => {
    const map = harness();
    await assert.rejects(addPreparedFeatures(map, {
      sources: { picture: { type: 'image', url: '/image.png', coordinates: coordinates(), canvas: new Canvas() } },
    }), { code: 'invalid-descriptor' });
    assert.deepEqual(map.calls, []);
  });
});
