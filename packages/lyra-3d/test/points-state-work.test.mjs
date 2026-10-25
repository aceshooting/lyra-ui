import assert from 'node:assert/strict';
import test from 'node:test';
import * as three from 'three';
import { WebGLAttributes } from 'three/src/renderers/webgl/WebGLAttributes.js';
import { createPointsEngine } from '../dist/points/engine.js';
import * as orbit from '../dist/core/orbit.js';
import * as style from '../dist/core/style.js';
import { attributesOf, countWrites, state, uploadRecorder, viewportHarness, visualSnapshot } from './performance-fixture.mjs';

async function fixture(count, explicitSizes = false, nextState = state(), nextStyle = {}) {
  const harness = viewportHarness(three, orbit, style);
  const engine = createPointsEngine({ viewport: () => harness.viewport });
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) positions[i * 3] = i;
  engine.setData({ positions, ...(explicitSizes ? { sizes: new Float32Array(count).fill(6) } : {}) }, 0);
  engine.setStyle(nextStyle); engine.setState(nextState);
  try { await engine.mount({}, harness.host); } catch (error) { engine.dispose(); throw error; }
  return { ...harness, engine };
}

for (const explicitSizes of [false, true]) test(`hover updates only two color rows (${explicitSizes ? 'explicit' : 'default'} sizes)`, async () => {
  const f = await fixture(256, explicitSizes, state({ hover: 0 }));
  const attrs = attributesOf(f.viewport), writes = countWrites(attrs), gpu = uploadRecorder(attrs, WebGLAttributes);
  try {
    const geometry = f.viewport.world.children[0].geometry;
    const colors = geometry.getAttribute('pointColor'), before = colors.array.slice();
    const sizeVersion = geometry.getAttribute('pointSize').version;
    f.engine.setState(state({ hover: 1 }));
    const changed = [];
    for (let row = 0; row < 256; row++) if ([0, 1, 2].some(channel => before[row * 3 + channel] !== colors.array[row * 3 + channel])) changed.push(row);
    assert.deepEqual(changed, [0, 1], 'the control changes exactly two rows');
    const colorWrites = Object.entries(writes.read()).filter(([key]) => key.endsWith('/pointColor.setXYZ')).reduce((n, [, count]) => n + count, 0);
    assert.ok(colorWrites <= 2, `two changed rows caused ${colorWrites} color writes`);
    assert.equal(geometry.getAttribute('pointSize').version, sizeVersion, 'hover cannot dirty unchanged sizes');
    const uploads = gpu.flush();
    assert.ok(uploads.every(call => call.key.endsWith('/pointColor')), 'hover uploads only color');
    assert.ok(uploads.reduce((n, call) => n + call.bytes, 0) <= 24, 'at most two RGB float rows');
    assert.deepEqual(gpu.mirrors(), visualSnapshot(f.viewport).attributes, 'dispatch covers every changed value');
    writes.reset(); const versions = [...attrs.values()].map(a => a.version);
    f.engine.setState(state({ hover: 1 }));
    assert.deepEqual(writes.read(), {});
    assert.deepEqual([...attrs.values()].map(a => a.version), versions);
    assert.deepEqual(gpu.flush(), []);
  } finally { writes.restore(); gpu.dispose(); f.engine.dispose(); }
});

test('reordering dimmed membership does not invalidate or update point attributes', async () => {
  const f = await fixture(64, false, state({ dimmed: new Set([1, 2]) }));
  const attrs = attributesOf(f.viewport), writes = countWrites(attrs), gpu = uploadRecorder(attrs, WebGLAttributes);
  try {
    const invalidations = f.viewport.invalidations, versions = [...attrs.values()].map(a => a.version);
    f.engine.setState(state({ dimmed: new Set([2, 1]) }));
    assert.equal(f.viewport.invalidations, invalidations, 'equal dimmed membership cannot request a render');
    assert.deepEqual(writes.read(), {});
    assert.deepEqual([...attrs.values()].map(a => a.version), versions);
    assert.deepEqual(gpu.flush(), []);
  } finally { writes.restore(); gpu.dispose(); f.engine.dispose(); }
});

test('coalesced sparse and full changes preserve every pending upload and caller ownership', async () => {
  const f = await fixture(64), attrs = attributesOf(f.viewport), gpu = uploadRecorder(attrs, WebGLAttributes);
  const selected = new Set([3]);
  const finalStyle = { palette: ['#ff0000'], pointSize: 9 };
  let reference;
  try {
    f.engine.setState(state({ hover: 0 }));
    f.engine.setState(state({ hover: 5 }));
    f.engine.setStyle(finalStyle);
    f.engine.setState(state({ selected, hover: 9 }));
    selected.clear();
    reference = await fixture(64, false, state({ selected: new Set([3]), hover: 9 }), finalStyle);
    assert.deepEqual(visualSnapshot(f.viewport), visualSnapshot(reference.viewport), 'full initialization is the behavioral control');
    gpu.flush();
    assert.deepEqual(gpu.mirrors(), visualSnapshot(reference.viewport).attributes, 'a later partial range cannot lose an earlier pending full update');
  } finally { reference?.engine.dispose(); gpu.dispose(); f.engine.dispose(); }
});


test('all-row point state refresh uses a direct color range while preserving sizes and caller ownership', async () => {
  const count = 256, f = await fixture(count), attrs = attributesOf(f.viewport), gpu = uploadRecorder(attrs, WebGLAttributes);
  const geometry = f.viewport.world.children[0].geometry, colors = geometry.getAttribute('pointColor');
  const ranges = colors.updateRanges, own = Object.getOwnPropertyDescriptor(ranges, Symbol.iterator);
  let pendingRangesEnumerated = 0, reference;
  Object.defineProperty(ranges, Symbol.iterator, { configurable: true, value: function* () {
    pendingRangesEnumerated++; yield* Array.prototype[Symbol.iterator].call(this);
  } });
  const restore = () => own ? Object.defineProperty(ranges, Symbol.iterator, own) : Reflect.deleteProperty(ranges, Symbol.iterator);
  try {
    const selected = new Set(Array.from({ length: count }, (_, index) => index));
    const sizeVersion = geometry.getAttribute('pointSize').version;
    f.engine.setState(state({ selected }));
    assert.equal(pendingRangesEnumerated, 0, 'all color rows replace the range directly instead of sparse merging');
    assert.deepEqual(colors.updateRanges, [{ start: 0, count: count * 3 }]);
    assert.equal(geometry.getAttribute('pointSize').version, sizeVersion, 'dense state still cannot dirty size');
    restore();
    const calls = gpu.flush();
    assert.equal(calls.reduce((sum, call) => sum + call.bytes, 0), count * 12);
    selected.clear();
    const nextStyle = { palette: ['#ff0000'], accent: '#00ff00' };
    f.engine.setStyle(nextStyle);
    reference = await fixture(count, false, state({ selected: new Set(Array.from({ length: count }, (_, index) => index)) }), nextStyle);
    assert.deepEqual(visualSnapshot(f.viewport), visualSnapshot(reference.viewport));
    gpu.flush(); assert.deepEqual(gpu.mirrors(), visualSnapshot(reference.viewport).attributes);
  } finally { restore(); reference?.engine.dispose(); gpu.dispose(); f.engine.dispose(); }
});
