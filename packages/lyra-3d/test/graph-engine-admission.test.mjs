import assert from 'node:assert/strict';
import test from 'node:test';
import { createGraphEngine } from '../dist/graph/engine.js';
import { installFakeBrowser } from './fake-browser.mjs';

const edges = (count = 1) => ({ source: new Uint32Array(count), target: new Uint32Array(count).fill(1) });
const host = () => ({ hover() {}, pick() {}, camera() {}, lost() {} });

/** An engine whose layout task records the input it was started with. */
function recordingEngine() {
  const tasks = [];
  const engine = createGraphEngine({
    task(options) {
      const task = { options, stopped: false, mode: 'main-thread', stop() { this.stopped = true; }, update() {} };
      tasks.push(task);
      return task;
    },
  });
  return { engine, tasks };
}

test('invalid per-node and per-edge columns are refused without consuming the revision', () => {
  const { engine } = recordingEngine();
  const data = { nodeCount: 2, positions: new Float32Array([0, 0, 0, 5, 0, 0]), ...edges() };
  engine.setData(data, 1);
  const before = engine.positionOf(1);
  const refusals = [
    ['sizes of the wrong type', { sizes: [1, 2] }, /Invalid graph node sizes/u],
    ['sizes of the wrong length', { sizes: new Float32Array(3) }, /Invalid graph node sizes/u],
    ['negative sizes', { sizes: new Float32Array([1, -1]) }, /Invalid graph node sizes/u],
    ['non-finite sizes', { sizes: new Float32Array([1, Number.NaN]) }, /Invalid graph node sizes/u],
    ['categories of the wrong type', { categories: new Uint8Array(2) }, /Invalid graph categories/u],
    ['categories of the wrong length', { categories: new Uint16Array(3) }, /Invalid graph categories/u],
    ['a dangling row whose layout target differs from its source', { spatialAppearance: { dangling: new Uint8Array([1]) } }, /Dangling layout endpoints/u],
  ];
  for (const [name, change, message] of refusals) {
    assert.throws(() => engine.setData({ ...data, positions: new Float32Array([9, 9, 9, 9, 9, 9]), ...change }, 2), message, name);
    assert.deepEqual(engine.positionOf(1), before, `${name} leaves the current graph intact`);
  }
  // None of those attempts used revision 2.
  engine.setData({ ...data, positions: new Float32Array([1, 2, 3, 4, 5, 6]) }, 2);
  assert.deepEqual(engine.positionOf(0), { x: 1, y: 2, z: 3 });
  engine.dispose();
});

test('a dangling row is accepted when its layout endpoints coincide', () => {
  const { engine } = recordingEngine();
  const loop = { source: new Uint32Array([0]), target: new Uint32Array([0]) };
  assert.doesNotThrow(() => engine.setData({ nodeCount: 1, positions: new Float32Array(3), ...loop, spatialAppearance: { dangling: new Uint8Array([1]) } }, 1));
  engine.dispose();
});

test('without supplied positions the layout starts from seeded, bounded coordinates that are free to move', async (t) => {
  const browser = installFakeBrowser();
  t.after(() => browser.restore());
  const nodes = 64;
  const layout = (seed) => ({ nodeCount: nodes, ...edges(), options: seed === undefined ? {} : { seed } });
  const start = async (seed) => {
    const { engine, tasks } = recordingEngine();
    engine.setData(layout(seed), 1);
    const positions = Array.from({ length: nodes }, (_, row) => engine.positionOf(row));
    await engine.mount(browser.container, host());
    const input = tasks[0].options.input.data;
    engine.dispose();
    return { positions, input };
  };
  const first = await start(7);
  const again = await start(7);
  const other = await start(8);
  const unseeded = await start();
  const defaulted = await start(1);
  assert.deepEqual(first.positions, again.positions, 'the same seed starts from the same layout');
  assert.notDeepEqual(first.positions, other.positions, 'another seed starts elsewhere');
  assert.deepEqual(unseeded.positions, defaulted.positions, 'the default seed is 1');
  const radius = Math.max(10, Math.cbrt(nodes) * 10);
  for (const { x, y, z } of first.positions) for (const value of [x, y, z]) assert.ok(Number.isFinite(value) && Math.abs(value) <= radius / 2, `${value} is inside the starting volume`);
  assert.ok(new Set(first.positions.map(({ x }) => x)).size > nodes / 2, 'nodes do not start stacked');
  assert.deepEqual([...first.input.pinned], new Array(nodes).fill(0), 'generated positions are free');
  assert.deepEqual([...first.input.positions.slice(0, 3)], [first.positions[0].x, first.positions[0].y, first.positions[0].z]);
});

test('explicit positions start pinned unless the caller supplies a pin mask', async (t) => {
  const browser = installFakeBrowser();
  t.after(() => browser.restore());
  const startInput = async (extra) => {
    const { engine, tasks } = recordingEngine();
    engine.setData({ nodeCount: 2, positions: new Float32Array([0, 0, 0, 5, 0, 0]), ...edges(), ...extra }, 1);
    await engine.mount(browser.container, host());
    const { data } = tasks[0].options.input;
    engine.dispose();
    return [...data.pinned];
  };
  assert.deepEqual(await startInput({}), [1, 1]);
  assert.deepEqual(await startInput({ pinned: new Uint8Array([0, 1]) }), [0, 1]);
});
