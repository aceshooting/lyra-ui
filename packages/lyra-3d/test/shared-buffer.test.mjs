import assert from 'node:assert/strict';
import test from 'node:test';
import { admitPointsData } from '../dist/points/data.js';
import { createGraphLayoutKernel } from './graph-synchronous-fixture.mjs';
import { createGraphEngine } from '../dist/graph/engine.js';
import { admitGraphSpatialAppearance, validateGraphSpatialSizes } from '../dist/graph/spatial-appearance.js';
import { createPanoramaEngine } from '../dist/panorama/engine.js';

function shared(array) {
  const result = new array.constructor(new SharedArrayBuffer(array.byteLength));
  result.set(array);
  return result;
}
const points = () => ({ positions: new Float32Array([0, 1, 2]), sizes: new Float32Array([4]), categories: new Uint16Array([1]), colors: new Float32Array([0, 0.5, 1]), segments: new Uint32Array([0, 0]) });
const graph = () => ({ nodeCount: 1, positions: new Float32Array([0, 1, 2]), source: new Uint32Array([0]), target: new Uint32Array([0]), pinned: new Uint8Array([1]), sizes: new Float32Array([4]), categories: new Uint16Array([1]), directed: new Uint8Array([1]) });
const pins = () => ({ indices: new Uint32Array([0]), positions: new Float32Array([1, 2, 3]), pinned: new Uint8Array([1]) });
for (const field of ['positions', 'sizes', 'categories', 'colors', 'segments']) {
  test(`shared buffers: point ${field} rejects shared backing and accepts ordinary data`, () => {
    const value = points();
    assert.doesNotThrow(() => admitPointsData(value));
    assert.throws(() => admitPointsData({ ...value, [field]: shared(value[field]) }), RangeError);
    const copy = admitPointsData(value); value[field].fill(0);
    assert.notEqual(copy[field].buffer, value[field].buffer);
  });
}
for (const field of ['positions', 'source', 'target', 'pinned', 'sizes', 'categories', 'directed']) {
  test(`shared buffers: graph ${field} rejects shared backing before revision replacement`, () => {
    const engine = createGraphEngine(); const value = graph();
    try {
      engine.setData(value, 0);
      assert.throws(() => engine.setData({ ...value, [field]: shared(value[field]) }, 1));
      assert.doesNotThrow(() => engine.setData(value, 1));
    } finally { engine.dispose(); }
  });
}
for (const field of ['indices', 'positions', 'pinned']) {
  test(`shared buffers: pin ${field} rejects shared backing in kernel and engine`, () => {
    const kernel = createGraphLayoutKernel(graph()); const engine = createGraphEngine(); const value = pins();
    try {
      engine.setData(graph(), 0);
      assert.throws(() => kernel.update({ ...value, [field]: shared(value[field]) }));
      assert.throws(() => engine.setPins({ ...value, [field]: shared(value[field]) }));
      assert.doesNotThrow(() => kernel.update(value));
      assert.doesNotThrow(() => engine.setPins(value));
    } finally { engine.dispose(); }
  });
}
const appearance = () => ({ nodeShapes: new Uint8Array([1]), nodeColors: new Float32Array([0, 0.5, 1, 1]), expandable: new Uint8Array([1]), edgeColors: new Float32Array([1, 0, 0, 1]), edgeWidths: new Float32Array([1]), dangling: new Uint8Array([1]) });
for (const field of Object.keys(appearance())) {
  test(`shared buffers: graph appearance ${field} rejects shared backing`, () => {
    const value = appearance();
    assert.doesNotThrow(() => admitGraphSpatialAppearance(value, 1, 1));
    assert.throws(() => admitGraphSpatialAppearance({ ...value, [field]: shared(value[field]) }, 1, 1), RangeError);
  });
}
test('shared buffers: spatial size validation requires ordinary backing', () => {
  const sizes = new Float32Array([4]);
  assert.doesNotThrow(() => validateGraphSpatialSizes(sizes, 1, {}));
  assert.throws(() => validateGraphSpatialSizes(shared(sizes), 1, {}), RangeError);
});
for (const field of ['hotspotAngles', 'hotspotSizes', 'hotspotCategories']) {
  test(`shared buffers: panorama ${field} rejects shared backing before media inspection`, () => {
    let inspections = 0;
    const engine = createPanoramaEngine({ inspectMedia(source) { inspections++; return { kind: 'image', element: source.image, width: 2, height: 1 }; }, probe() {} });
    const value = { source: { kind: 'image', image: {} }, hotspotAngles: new Float32Array([0, 0]), hotspotSizes: new Float32Array([4]), hotspotCategories: new Uint16Array([1]) };
    try {
      engine.setData(value, 0); const before = inspections;
      assert.throws(() => engine.setData({ ...value, [field]: shared(value[field]) }, 1), RangeError);
      assert.equal(inspections, before);
      assert.doesNotThrow(() => engine.setData(value, 1));
    } finally { engine.dispose(); }
  });
}
