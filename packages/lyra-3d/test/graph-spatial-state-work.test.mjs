import assert from 'node:assert/strict';
import test from 'node:test';
import { WebGLAttributes } from 'three/src/renderers/webgl/WebGLAttributes.js';
import { createGraphSpatialComposite } from '../dist/graph/spatial-composite.js';
import { createGraphSpatialNodes } from '../dist/graph/spatial-nodes.js';
import { createGraphSpatialEdges } from '../dist/graph/spatial-edges.js';
import { DEFAULT_ORBIT_CAMERA } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { state, uploadRecorder } from './performance-fixture.mjs';

function fixture({ alpha = 1, opacity = 0.35, next = state(), yaw = 0, style = resolveLyra3dStyle() } = {}) {
  const data = {
    nodeCount: 6, source: new Uint32Array([0, 1, 2, 3]), target: new Uint32Array([1, 2, 2, 3]),
    directed: new Uint8Array([1, 0, 1, 0]), sizes: new Float32Array([20, 24, 18, 16, 12, 0]),
    spatialAppearance: {
      nodeColors: new Float32Array(Array.from({ length: 24 }, (_, i) => i % 4 === 3 ? alpha : 0.4)),
      edgeColors: new Float32Array(Array.from({ length: 16 }, (_, i) => i % 4 === 3 ? alpha : 0.2)),
      dimmedOpacity: opacity, dangling: new Uint8Array([0, 0, 0, 1]),
    },
  };
  const positions = new Float32Array([-50, 0, 0, 40, 0, 10, 0, 20, -30, 30, -20, 50, -20, 40, 20, 60, 50, -10]);
  const view = { width: 640, height: 480, orbit: { ...DEFAULT_ORBIT_CAMERA, yaw }, style, invalidate() {} };
  const nodes = createGraphSpatialNodes(data), edges = createGraphSpatialEdges(data);
  const composite = createGraphSpatialComposite(nodes, edges);
  const lookup = i => ({ x: positions[i * 3], y: positions[i * 3 + 1], z: positions[i * 3 + 2] });
  nodes.update(view, positions, next); edges.update(view, lookup, next); composite.update(view);
  const attributes = new Map();
  for (const [name, batch] of [['nodes', nodes], ['edges', edges], ['composite', composite]]) {
    for (const [key, attr] of Object.entries(batch.mesh.geometry.attributes)) attributes.set(`${name}/${key}`, attr);
  }
  const sparse = (value, rows, compose = true) => {
    nodes.updateState(view, value, rows); edges.updateState(view, value, rows);
    if (compose) composite.update(view);
  };
  const snapshot = () => {
    const arrays = Object.fromEntries([...attributes].map(([key, attr]) => [key,
      Array.from(key.startsWith('composite/payload') ? attr.array.subarray(0, composite.mesh.geometry.instanceCount * 4) : attr.array)]));
    return { arrays, count: composite.mesh.geometry.instanceCount,
      materials: [nodes, edges, composite].map(batch => [batch.mesh.material.transparent, batch.mesh.material.depthWrite]) };
  };
  return { nodes, edges, composite, view, attributes, sparse, snapshot,
    dispose() { composite.dispose(); nodes.dispose(); edges.dispose(); } };
}

function compareFull(f, options) {
  const control = fixture({ ...options, yaw: f.view.orbit.yaw, style: f.view.style });
  try { assert.deepEqual(f.snapshot(), control.snapshot(), 'incremental output equals fresh compatibility full updates'); }
  finally { control.dispose(); }
}

function checkMirrors(gpu, f) {
  assert.deepEqual(gpu.mirrors(), Object.fromEntries([...f.attributes].map(([key, attr]) => [key, Array.from(attr.array)])));
}

for (const alpha of [1, 0.5]) {
  test(`dense composition skips unchanged source paints and preserves coalesced revert (alpha ${alpha})`, () => {
    const resting = state({ selected: new Set([5]) });
    const selected = state({ selected: new Set(Array.from({ length: 10 }, (_, row) => row)) });
    const f = fixture({ alpha, next: resting, yaw: 0.7 }), gpu = uploadRecorder(f.attributes, WebGLAttributes);
    let unchangedSourceReads = 0;
    const restores = [];
    try {
      f.sparse(selected, null, false);
      // Source batches already know these three paints did not change. Observe only the
      // compositor, after source painting, so this does not count required source validation.
      for (const name of ['nodeFill', 'nodeRing', 'nodeMarker']) {
        const attribute = f.nodes.mesh.geometry.getAttribute(name);
        const descriptor = Object.getOwnPropertyDescriptor(attribute, 'array');
        Object.defineProperty(attribute, 'array', { ...descriptor, value: new Proxy(descriptor.value, {
          get(target, key) {
            if (typeof key === 'string' && /^\d+$/u.test(key)) unchangedSourceReads++;
            const value = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        }) });
        restores.push(() => Object.defineProperty(attribute, 'array', descriptor));
      }
      try { f.composite.update(f.view); } finally { for (const restore of restores) restore(); }
      compareFull(f, { alpha, next: selected }); gpu.flush(); checkMirrors(gpu, f);
      const versions = Object.fromEntries([...f.attributes].filter(([key]) => key.startsWith('composite/payload')).map(([key, attr]) => [key, attr.version]));
      // Versions are hints: both batches change and then restore before composition.
      f.sparse(resting, null, false); f.sparse(selected, null, false); f.composite.update(f.view);
      compareFull(f, { alpha, next: selected });
      for (const [key, version] of Object.entries(versions)) assert.equal(f.attributes.get(key).version, version, 'a coalesced revert cannot dirty a composite payload');
      assert.deepEqual(gpu.flush().filter(call => call.key.startsWith('composite/')), []);
      checkMirrors(gpu, f);
      // A later changed source must still reach both its staged and current sorted output.
      f.sparse(resting, null); compareFull(f, { alpha, next: resting }); gpu.flush(); checkMirrors(gpu, f);
      assert.equal(unchangedSourceReads, 0, 'dense composition must not rescan source paints whose versions are unchanged');
    } finally { for (const restore of restores) restore(); gpu.dispose(); f.dispose(); }
  });

  test(`mixed dense node-only and edge-only paints keep exact payload ownership (alpha ${alpha})`, () => {
    const resting = state({ selected: new Set([5]) });
    const nodesSelected = state({ selected: new Set(Array.from({ length: 6 }, (_, row) => row)) });
    const allSelected = state({ selected: new Set(Array.from({ length: 10 }, (_, row) => row)) });
    const f = fixture({ alpha, next: resting, yaw: 0.7 }), gpu = uploadRecorder(f.attributes, WebGLAttributes);
    try {
      f.sparse(nodesSelected, null); compareFull(f, { alpha, next: nodesSelected });
      const nodeCalls = gpu.flush().filter(call => call.key.startsWith('composite/'));
      assert.ok(nodeCalls.length > 0);
      assert.ok(nodeCalls.every(call => call.key === 'composite/payload1'), 'node flags cannot dirty edge-owned paint');
      checkMirrors(gpu, f);
      f.sparse(allSelected, null); compareFull(f, { alpha, next: allSelected });
      const edgeCalls = gpu.flush().filter(call => call.key.startsWith('composite/'));
      assert.ok(edgeCalls.length > 0);
      assert.ok(edgeCalls.every(call => ['composite/payload2', 'composite/payload3'].includes(call.key)), 'edge paint cannot dirty node-only flag/marker payloads');
      checkMirrors(gpu, f);
      f.sparse(resting, null); compareFull(f, { alpha, next: resting }); gpu.flush(); checkMirrors(gpu, f);
    } finally { gpu.dispose(); f.dispose(); }
  });

  test(`dense composite paint reuses geometric row coverage after rebuild and sort (alpha ${alpha})`, () => {
    const resting = state({ selected: new Set([5]) });
    const selected = state({ selected: new Set(Array.from({ length: 10 }, (_, row) => row)) });
    const f = fixture({ alpha, next: resting, yaw: 0.7 }), gpu = uploadRecorder(f.attributes, WebGLAttributes);
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Uint8Array');
    let allocatedMaskBytes = 0;
    const compose = () => {
      const Native = descriptor.value;
      Object.defineProperty(globalThis, 'Uint8Array', { ...descriptor, value: new Proxy(Native, {
        construct(target, args) {
          const result = Reflect.construct(target, args);
          allocatedMaskBytes += result.byteLength;
          return result;
        },
      }) });
      try { f.composite.update(f.view); } finally { Object.defineProperty(globalThis, 'Uint8Array', descriptor); }
    };
    const dense = next => {
      const geometry = f.attributes.get('composite/payload0'), marker = f.attributes.get('composite/payload4');
      const geometryVersion = geometry.version, markerVersion = marker.version;
      f.sparse(next, null, false); compose();
      assert.equal(geometry.version, geometryVersion, 'paint preserves geometric payloads');
      assert.equal(marker.version, markerVersion, 'unchanged markers stay untouched');
      compareFull(f, { alpha, next });
      const calls = gpu.flush();
      assert.ok(calls.filter(call => call.key.startsWith('composite/')).every(call => /payload[123]$/u.test(call.key)));
      checkMirrors(gpu, f);
    };
    try {
      dense(selected); dense(resting);
      // A changed painter permutation must refresh coverage before the next dense paint.
      f.view.orbit = { ...f.view.orbit, yaw: Math.PI }; f.composite.update(f.view); gpu.flush();
      dense(selected); dense(resting);
      // Exercise compaction in both directions before using the stable dense path again.
      f.sparse(state(), [5]); gpu.flush();
      f.sparse(resting, [5]); gpu.flush();
      dense(selected);
      f.sparse(selected, null, false); compose();
      assert.deepEqual(gpu.flush(), [], 'equal dense paint retains its no-op contract');
      assert.equal(allocatedMaskBytes, 0, 'stable dense paint must not allocate fresh per-primitive coverage masks');
    } finally { Object.defineProperty(globalThis, 'Uint8Array', descriptor); gpu.dispose(); f.dispose(); }
  });
}

for (const alpha of [1, 0.5]) {
  test(`multiple sparse states accumulate before composite and upload (alpha ${alpha})`, () => {
    const f = fixture({ alpha, next: state({ hover: 0 }), yaw: 0.7 });
    const gpu = uploadRecorder(f.attributes, WebGLAttributes);
    try {
      f.sparse(state({ hover: 1 }), [0, 1], false);
      f.sparse(state({ hover: 2 }), [1, 2], false);
      f.composite.update(f.view);
      // A second composite patch must preserve the preceding unconsumed ranges.
      const next = state({ hover: 3 }); f.sparse(next, [2, 3]);
      compareFull(f, { alpha, next });
      const calls = gpu.flush();
      assert.ok(calls.length > 0);
      assert.ok(calls.reduce((total, call) => total + call.bytes, 0) <= 320);
      checkMirrors(gpu, f);
      const versions = [...f.attributes.values()].map(attr => attr.version);
      f.sparse(next, [0, 1, 2, 3]);
      assert.deepEqual([...f.attributes.values()].map(attr => attr.version), versions);
      assert.deepEqual(gpu.flush(), []);
    } finally { gpu.dispose(); f.dispose(); }
  });
}

test('zero-size node selection adds and removes active membership', () => {
  const f = fixture(), gpu = uploadRecorder(f.attributes, WebGLAttributes);
  try {
    const initialCount = f.composite.mesh.geometry.instanceCount;
    const selected = state({ selected: new Set([5]) }); f.sparse(selected, [5]);
    assert.equal(f.composite.mesh.geometry.instanceCount, initialCount + 1);
    compareFull(f, { next: selected }); gpu.flush(); checkMirrors(gpu, f);
    f.sparse(state(), [5]);
    assert.equal(f.composite.mesh.geometry.instanceCount, initialCount);
    compareFull(f, {}); gpu.flush(); checkMirrors(gpu, f);
  } finally { gpu.dispose(); f.dispose(); }
});

test('zero dimmed opacity hides and restores directed and loop edge primitives', () => {
  const f = fixture({ opacity: 0 }), gpu = uploadRecorder(f.attributes, WebGLAttributes);
  try {
    const count = f.composite.mesh.geometry.instanceCount;
    const next = state({ dimmed: new Set([6, 8]) }); f.sparse(next, [6, 8]);
    assert.ok(f.composite.mesh.geometry.instanceCount < count);
    compareFull(f, { opacity: 0, next }); gpu.flush(); checkMirrors(gpu, f);
    f.sparse(state(), [6, 8]);
    assert.equal(f.composite.mesh.geometry.instanceCount, count);
    compareFull(f, { opacity: 0 }); gpu.flush(); checkMirrors(gpu, f);
  } finally { gpu.dispose(); f.dispose(); }
});

test('partial alpha transitions switch composite material mode and retain all pending uploads', () => {
  const f = fixture(), gpu = uploadRecorder(f.attributes, WebGLAttributes);
  try {
    const next = state({ dimmed: new Set([0, 6]) }); f.sparse(next, [0, 6]);
    assert.equal(f.composite.mesh.material.transparent, true);
    assert.equal(f.composite.mesh.material.depthWrite, false);
    compareFull(f, { next });
    f.sparse(state(), [0, 6]);
    assert.equal(f.composite.mesh.material.transparent, false);
    compareFull(f, {}); gpu.flush(); checkMirrors(gpu, f);
  } finally { gpu.dispose(); f.dispose(); }
});

test('sparse edge paint follows sorted destinations and a pending settled sort uses current colors', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture({ alpha: 0.5 }), gpu = uploadRecorder(f.attributes, WebGLAttributes);
  try {
    f.view.orbit = { ...f.view.orbit, yaw: 0.7 }; f.composite.update(f.view); gpu.flush();
    const next = state({ hover: 6, selected: new Set([8]) });
    f.sparse(next, [6, 8]); compareFull(f, { alpha: 0.5, next }); gpu.flush(); checkMirrors(gpu, f);
    const positionVersion = f.attributes.get('composite/payload0').version;
    let paints = 0; f.view.invalidate = () => { paints++; };
    f.view.orbit = { ...f.view.orbit, yaw: 0.705 }; f.composite.update(f.view);
    const settled = state({ hover: 1, dimmed: new Set([9]) });
    f.sparse(settled, [1, 6, 8, 9]);
    assert.equal(f.attributes.get('composite/payload0').version, positionVersion, 'paint retains the existing permutation before settle');
    gpu.flush(); checkMirrors(gpu, f);
    t.mock.timers.tick(1000);
    assert.equal(paints, 1);
    compareFull(f, { alpha: 0.5, next: settled }); gpu.flush(); checkMirrors(gpu, f);
  } finally { gpu.dispose(); f.dispose(); }
});

test('full style changes followed by sparse state preserve full pending upload ranges', () => {
  const f = fixture(), gpu = uploadRecorder(f.attributes, WebGLAttributes);
  try {
    f.view.style = resolveLyra3dStyle({ pointSize: 28, lineWidth: 5, fontSize: 20, accent: '#ff00aa', foreground: '#227744' });
    f.nodes.updateStyle(f.view, state()); f.edges.updateStyle(f.view, state()); f.composite.update(f.view);
    const next = state({ hover: 1, selected: new Set([6]) }); f.sparse(next, [1, 6]);
    compareFull(f, { next });
    assert.ok(gpu.flush().length > 0); checkMirrors(gpu, f);
  } finally { gpu.dispose(); f.dispose(); }
});


test('full spatial style refresh publishes full invalidation without materializing sparse rows', () => {
  const f = fixture();
  try {
    const next = state({ selected: new Set(Array.from({ length: 10 }, (_, index) => index)) });
    f.view.style = resolveLyra3dStyle({ pointSize: 28, lineWidth: 5, fontSize: 20, accent: '#ff00aa', foreground: '#227744' });
    f.nodes.updateStyle(f.view, next); f.edges.updateStyle(f.view, next);
    const nodeChanges = f.nodes.takeChanges(), edgeChanges = f.edges.takeChanges();
    assert.equal(nodeChanges.full, true); assert.equal(edgeChanges.full, true);
    assert.deepEqual(nodeChanges.rows, [], 'a full node rebuild has no sparse row payload');
    assert.deepEqual(edgeChanges.rows, [], 'a full edge rebuild has no sparse primitive payload');
  } finally { f.dispose(); }
});

test('full spatial style refresh replaces pending ranges without sparse range merging', () => {
  const f = fixture(), restores = [];
  let pendingRangesEnumerated = 0;
  try {
    for (const [name, attr] of f.attributes) {
      if (name.startsWith('composite/')) continue;
      const ranges = attr.updateRanges;
      const own = Object.getOwnPropertyDescriptor(ranges, Symbol.iterator);
      Object.defineProperty(ranges, Symbol.iterator, { configurable: true, value: function* () {
        pendingRangesEnumerated++; yield* Array.prototype[Symbol.iterator].call(this);
      } });
      restores.push(() => own ? Object.defineProperty(ranges, Symbol.iterator, own) : Reflect.deleteProperty(ranges, Symbol.iterator));
    }
    const next = state({ selected: new Set(Array.from({ length: 10 }, (_, index) => index)) });
    f.view.style = resolveLyra3dStyle({ pointSize: 28, lineWidth: 5, accent: '#ff00aa', foreground: '#227744' });
    f.nodes.updateStyle(f.view, next); f.edges.updateStyle(f.view, next);
    assert.equal(pendingRangesEnumerated, 0, 'full replacement cannot spend work merging sparse update histories');
    f.composite.update(f.view); compareFull(f, { next });
  } finally { for (const restore of restores) restore(); f.dispose(); }
});

test('dense paint preserves a translucent permutation and coalesces later sparse paint before a pending sort', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  // Keep the zero-size node active before and throughout this paint-only transition.
  const f = fixture({ alpha: 0.5, next: state({ selected: new Set([5]) }), yaw: 0.7 });
  const gpu = uploadRecorder(f.attributes, WebGLAttributes);
  try {
    const geometryKeys = ['nodes/nodePosition', 'nodes/nodeSize', 'nodes/nodeShape', 'nodes/pickColor',
      'edges/edgeStart', 'edges/edgeEnd', 'edges/edgePath', 'edges/pickColor', 'composite/payload0'];
    const before = Object.fromEntries(geometryKeys.map(key => [key, { version: f.attributes.get(key).version, array: Array.from(f.attributes.get(key).array) }]));
    let paints = 0; f.view.invalidate = () => { paints++; };
    f.view.orbit = { ...f.view.orbit, yaw: 0.705 }; f.composite.update(f.view);
    const selected = new Set(Array.from({ length: 10 }, (_, index) => index));
    f.sparse(state({ selected }), null, false);
    const final = state({ selected, hover: 1, dimmed: new Set([0, 6]) });
    f.sparse(final, [0, 1, 6]);
    for (const key of geometryKeys) {
      assert.equal(f.attributes.get(key).version, before[key].version, `${key} keeps its geometry upload version`);
      assert.deepEqual(Array.from(f.attributes.get(key).array), before[key].array, `${key} keeps its geometry/pick contents`);
    }
    gpu.flush(); checkMirrors(gpu, f);
    t.mock.timers.tick(1000);
    assert.equal(paints, 1, 'dense paint cannot cancel the pending camera settle');
    compareFull(f, { alpha: 0.5, next: final }); gpu.flush(); checkMirrors(gpu, f);
    const cleared = state({ selected: new Set([5]) }); f.sparse(cleared, null);
    compareFull(f, { alpha: 0.5, next: cleared }); gpu.flush(); checkMirrors(gpu, f);
    f.sparse(state({ selected: new Set([5]), hover: 1 }), [1]);
    const calls = gpu.flush();
    assert.ok(calls.reduce((sum, call) => sum + call.bytes, 0) <= 320, 'post-dense sparse uploads regain their bounded ranges');
    checkMirrors(gpu, f);
  } finally { gpu.dispose(); f.dispose(); }
});


test('dense translucent paint includes unchanged affected rows without uploading unchanged payloads', () => {
  const count = 67, edgesCount = count * 3;
  const positions = Float32Array.from({ length: count * 3 }, (_, index) => index % 3 === 2 ? Math.floor(index / 3) : 0);
  const data = { nodeCount: count, source: Uint32Array.from({ length: edgesCount }, (_, index) => index % count),
    target: Uint32Array.from({ length: edgesCount }, (_, index) => (index + 1) % count),
    spatialAppearance: { nodeColors: Float32Array.from({ length: count * 4 }, (_, index) => index % 4 === 3 ? 0.5 : 0.4),
      edgeColors: Float32Array.from({ length: edgesCount * 4 }, (_, index) => index % 4 === 3 ? 0.5 : 0.2) } };
  const view = { width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(), invalidate() {} };
  const lookup = index => ({ x: 0, y: 0, z: index });
  const make = next => {
    const nodes = createGraphSpatialNodes(data), edges = createGraphSpatialEdges(data), composite = createGraphSpatialComposite(nodes, edges);
    nodes.update(view, positions, next); edges.update(view, lookup, next); composite.update(view);
    const attributes = new Map(Object.entries(composite.mesh.geometry.attributes).filter(([name]) => name.startsWith('payload')));
    return { nodes, edges, composite, attributes,
      dispose() { composite.dispose(); nodes.dispose(); edges.dispose(); } };
  };
  const f = make(state({ hover: 32 })), gpu = uploadRecorder(f.attributes, WebGLAttributes);
  let control;
  try {
    const positionsBefore = Array.from(f.attributes.get('payload0').array), positionVersion = f.attributes.get('payload0').version;
    const next = state({ selected: new Set(Array.from({ length: count + edgesCount }, (_, index) => index)) });
    f.nodes.updateState(view, next, null); f.edges.updateState(view, next, null); f.composite.update(view);
    const calls = gpu.flush();
    assert.equal(calls.filter(call => call.key === 'payload1').length, 1, 'one previously highlighted node cannot fragment a dense paint upload');
    assert.ok(calls.length <= 3, 'only changed flag/color/stroke payloads upload');
    assert.ok(calls.every(call => ['payload1', 'payload2', 'payload3'].includes(call.key)));
    assert.equal(f.attributes.get('payload0').version, positionVersion);
    assert.deepEqual(Array.from(f.attributes.get('payload0').array), positionsBefore);
    control = make(next);
    assert.deepEqual(gpu.mirrors(), Object.fromEntries([...control.attributes].map(([key, attr]) => [key, Array.from(attr.array)])));
    f.nodes.updateState(view, next, null); f.edges.updateState(view, next, null); f.composite.update(view);
    assert.deepEqual(gpu.flush(), [], 'logically dense but unchanged paint must not request uploads');
  } finally { control?.dispose(); gpu.dispose(); f.dispose(); }
});
