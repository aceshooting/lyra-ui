import assert from 'node:assert/strict';
import test from 'node:test';
import * as three from 'three';
import { WebGLAttributes } from 'three/src/renderers/webgl/WebGLAttributes.js';
import { createGraphEngine } from '../dist/graph/engine.js';
import * as orbit from '../dist/core/orbit.js';
import * as style from '../dist/core/style.js';
import { attributesOf, graphData, state, uploadRecorder, viewportHarness, visualSnapshot } from './performance-fixture.mjs';

async function fixture(spatial, translucent, next = state(), yaw = 0, extra = {}) {
  const h = viewportHarness(three, orbit, style);
  const engine = createGraphEngine({ viewport: () => h.viewport,
    task: () => ({ mode: 'main-thread', stop() {}, update() {} }) });
  engine.setData({ ...graphData(128, spatial, translucent), ...extra }, 0); engine.setState(next);
  engine.setCamera({ ...orbit.DEFAULT_ORBIT_CAMERA, yaw });
  try { await engine.mount({}, h.host); } catch (error) { engine.dispose(); throw error; }
  return { ...h, engine };
}

test('classic directed edge hover repaints only its base and arrow colors', async () => {
  const extra = { directed: new Uint8Array(128).fill(1) };
  const f = await fixture(false, false, state({ hover: 128 }), 0, extra);
  f.viewport.tick(0);
  const attributes = attributesOf(f.viewport), gpu = uploadRecorder(attributes, WebGLAttributes);
  let control;
  try {
    const before = new Map([...attributes].map(([key, attr]) => [key, attr.version]));
    f.engine.setState(state({ hover: 129 })); f.viewport.tick(1);
    control = await fixture(false, false, state({ hover: 129 }), 0, extra); control.viewport.tick(1);
    assert.deepEqual(visualSnapshot(f.viewport), visualSnapshot(control.viewport));
    for (const [key, attr] of attributes) if (key.endsWith('/instanceMatrix')) assert.equal(attr.version, before.get(key));
    const calls = gpu.flush();
    assert.ok(calls.length > 0); assert.ok(calls.reduce((sum, call) => sum + call.bytes, 0) <= 48);
    assert.deepEqual(gpu.mirrors(), visualSnapshot(f.viewport).attributes);
  } finally { control?.engine.dispose(); gpu.dispose(); f.engine.dispose(); }
});

for (const [spatial, translucent] of [[false, false], [true, false], [true, true]]) {
  test(`sparse graph hover reaches the final draw buffers (${spatial ? translucent ? 'spatial translucent' : 'spatial opaque' : 'classic'})`, async () => {
    const f = await fixture(spatial, translucent, state({ hover: 0 }));
    const attrs = attributesOf(f.viewport), gpu = uploadRecorder(attrs, WebGLAttributes);
    let reference;
    try {
      // Establish a nontrivial existing painter permutation before changing state.
      f.engine.setCamera({ ...orbit.DEFAULT_ORBIT_CAMERA, yaw: 0.7 }); f.viewport.tick(0); gpu.flush();
      const versions = new Map([...attrs].map(([key, attr]) => [key, attr.version]));
      f.engine.setState(state({ hover: 1 }));
      reference = await fixture(spatial, translucent, state({ hover: 1 }), 0.7);
      assert.deepEqual(visualSnapshot(f.viewport), visualSnapshot(reference.viewport), 'sparse paint equals a fresh full paint at the same camera');
      for (const [key, attr] of attrs) if (/\/(nodePosition|nodeSize|nodeShape|edgeStart|edgeEnd|edgePath|pickColor|instanceMatrix|payload0)$/u.test(key)) {
        assert.equal(attr.version, versions.get(key), `hover must not dirty ${key}`);
      }
      const uploads = gpu.flush();
      assert.ok(uploads.length > 0, 'the visual change must reach upload dispatch');
      // Two node rows, at most five vec4 source fields and five vec4 composite fields each.
      // This conservative structural ceiling is independent of graph size, not a size budget.
      assert.ok(uploads.reduce((n, call) => n + call.bytes, 0) <= 320, 'two changed nodes cannot upload whole graph buffers');
      assert.deepEqual(gpu.mirrors(), visualSnapshot(f.viewport).attributes);
      const stable = [...attrs.values()].map(a => a.version);
      f.engine.setState(state({ hover: 1 }));
      assert.deepEqual([...attrs.values()].map(a => a.version), stable);
      assert.deepEqual(gpu.flush(), []);
    } finally { reference?.engine.dispose(); gpu.dispose(); f.engine.dispose(); }
  });
}
