import assert from 'node:assert/strict';
import test from 'node:test';
import { admitGraphNodeMeshes, GraphNodeMeshAdmissionError } from '../dist/graph/node-mesh.js';
import { triangleMesh } from './graph-node-mesh-fixtures.mjs';

const refused = (run, reason = 'invalid', nodeIndex) => assert.throws(run, (error) =>
  error instanceof GraphNodeMeshAdmissionError && error.reason === reason && error.code === 'graph-node-mesh' &&
  (nodeIndex === undefined || error.nodeIndex === nodeIndex));

test('unset and all-null mesh scenes retain the ordinary path without owned row storage', () => {
  assert.equal(admitGraphNodeMeshes(undefined, 0), undefined);
  assert.equal(admitGraphNodeMeshes(undefined, 200_000), undefined);
  assert.equal(admitGraphNodeMeshes([], 0), undefined);
  assert.equal(admitGraphNodeMeshes([null, null], 2), undefined);
});

test('admission snapshots geometry, normals, color and original render row mapping', () => {
  const mesh = triangleMesh(1, [0.25, 0.5, 0.75, 0.5]);
  const input = [null, mesh, null];
  const admitted = admitGraphNodeMeshes(input, 3);
  assert.equal(admitted.triangleCount, 1);
  assert.equal(admitted.customNodeCount, 1);
  assert.equal(admitted.payloadBytes, 64);
  assert.equal(admitted.nodeMeshes[0], null);
  assert.equal(admitted.nodeMeshes[2], null);
  assert.notEqual(admitted.nodeMeshes[1].positions.buffer, mesh.positions.buffer);
  assert.notEqual(admitted.nodeMeshes[1].normals.buffer, mesh.normals.buffer);
  assert.ok(Object.isFrozen(admitted));
  assert.ok(Object.isFrozen(admitted.nodeMeshes));
  assert.ok(Object.isFrozen(admitted.nodeMeshes[1]));
  assert.ok(Object.isFrozen(admitted.nodeMeshes[1].color));
  mesh.positions.fill(0); mesh.normals.fill(0); mesh.color.fill(0); input[1] = null;
  assert.deepEqual([...admitted.nodeMeshes[1].positions], [-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0]);
  assert.deepEqual([...admitted.nodeMeshes[1].normals], [0, 0, 1]);
  assert.deepEqual(admitted.nodeMeshes[1].color, [0.25, 0.5, 0.75, 0.5]);
});

test('transparent custom materials remain valid data and omitted color inherits future paint', () => {
  const transparent = admitGraphNodeMeshes([triangleMesh(1, [1, 0, 0, 0])], 1);
  assert.equal(transparent.nodeMeshes[0].color[3], 0);
  assert.equal(admitGraphNodeMeshes([triangleMesh()], 1).nodeMeshes[0].color, undefined);
});

test('unsupported scene shapes, sparse slots and counts fail before copying', () => {
  for (const count of [-1, 0.5, NaN, Infinity, 200_001, '1']) refused(() => admitGraphNodeMeshes(undefined, count));
  for (const value of [null, {}, 'mesh', [undefined], new Array(1), [], [null, null]]) refused(() => admitGraphNodeMeshes(value, 1));
  const hidden = Object.create({ positions: triangleMesh().positions, normals: triangleMesh().normals });
  refused(() => admitGraphNodeMeshes([hidden], 1), 'invalid', 0);
});

test('mesh and tuple accessors, unknown fields and iterators never execute', () => {
  let reads = 0;
  const accessor = Object.defineProperty({ normals: triangleMesh().normals }, 'positions', { get() { reads++; throw Error('untrusted'); } });
  refused(() => admitGraphNodeMeshes([accessor], 1));
  const color = [1, 0, 0, 1];
  Object.defineProperty(color, '1', { get() { reads++; return 0; } });
  refused(() => admitGraphNodeMeshes([triangleMesh(1, color)], 1));
  const rows = [triangleMesh()];
  Object.defineProperty(rows, '0', { get() { reads++; return triangleMesh(); } });
  refused(() => admitGraphNodeMeshes(rows, 1));
  const unknown = triangleMesh();
  Object.defineProperty(unknown, 'then', { get() { reads++; return () => undefined; } });
  refused(() => admitGraphNodeMeshes([unknown], 1));
  refused(() => admitGraphNodeMeshes([{ ...triangleMesh(), ignored: true }], 1));
  assert.equal(reads, 0);
});

test('native typed-array access bypasses overridden length, buffer, slice and iterator properties', () => {
  let reads = 0;
  const mesh = triangleMesh();
  for (const array of [mesh.positions, mesh.normals]) for (const name of ['length', 'buffer', 'slice', Symbol.iterator]) {
    Object.defineProperty(array, name, { get() { reads++; throw Error('override'); } });
  }
  const admitted = admitGraphNodeMeshes([mesh], 1);
  assert.equal(admitted.triangleCount, 1);
  assert.equal(reads, 0);
});

test('wrong typed kinds, shared or detached buffers and malformed lengths are rejected', () => {
  const detached = new Float32Array(9); structuredClone(detached.buffer, { transfer: [detached.buffer] });
  const invalid = [[0, 0, 0], new Float64Array(9), new Uint32Array(9), new Float32Array(), new Float32Array(8), detached];
  if (typeof SharedArrayBuffer === 'function') invalid.push(new Float32Array(new SharedArrayBuffer(36)));
  for (const positions of invalid) refused(() => admitGraphNodeMeshes([{ ...triangleMesh(), positions }], 1), 'invalid', 0);
  for (const normals of [new Float64Array(3), new Float32Array(), new Float32Array(6)]) refused(() => admitGraphNodeMeshes([{ ...triangleMesh(), normals }], 1));
});

test('unit sphere, finite coordinates, normals, winding and nondegenerate faces are enforced', () => {
  const examples = [];
  for (const value of [NaN, Infinity, -Infinity, 1.01]) { const mesh = triangleMesh(); mesh.positions[0] = value; examples.push(mesh); }
  for (const normal of [[0, 0, 0], [0, 0, 0.5], [0, 0, -1], [NaN, 0, 1]]) { const mesh = triangleMesh(); mesh.normals.set(normal); examples.push(mesh); }
  const degenerate = triangleMesh(); degenerate.positions.fill(0); examples.push(degenerate);
  const reversed = triangleMesh(); reversed.positions.set([0, 0.5, 0, 0.5, -0.5, 0, -0.5, -0.5, 0]); examples.push(reversed);
  for (const mesh of examples) refused(() => admitGraphNodeMeshes([null, mesh], 2), 'invalid', 1);
});

test('RGBA admission uses four own finite numeric entries without coercion', () => {
  for (const color of [[1, 0, 0], [1, 0, 0, 1, 0], new Float32Array([1, 0, 0, 1]), [1, 0, 0, NaN], [1, 0, 0, 1.01], ['1', 0, 0, 1], [1, , 0, 1]]) {
    refused(() => admitGraphNodeMeshes([triangleMesh(1, color)], 1));
  }
});

test('per-node and aggregate triangle limits have exact accepted and refused boundaries', () => {
  assert.equal(admitGraphNodeMeshes([triangleMesh(64)], 1).triangleCount, 64);
  refused(() => admitGraphNodeMeshes([triangleMesh(65)], 1), 'budget', 0);
  const rows = Array(1024).fill(triangleMesh(64));
  assert.equal(admitGraphNodeMeshes(rows, rows.length).triangleCount, 65_536);
  rows.push(triangleMesh());
  refused(() => admitGraphNodeMeshes(rows, rows.length), 'budget', 1024);
});

test('the custom-node ceiling counts non-null rows rather than last occupied index', () => {
  const accepted = Array(16_384).fill(triangleMesh());
  assert.equal(admitGraphNodeMeshes(accepted, accepted.length).customNodeCount, 16_384);
  const sparse = Array(200_000).fill(null); sparse[199_999] = triangleMesh();
  assert.equal(admitGraphNodeMeshes(sparse, sparse.length).customNodeCount, 1);
  accepted.push(triangleMesh());
  refused(() => admitGraphNodeMeshes(accepted, accepted.length), 'budget', 16_384);
});

test('reflective reentrancy aborts before the next slot and does not expose stale candidate data', () => {
  let current = true, laterReads = 0;
  const rows = new Proxy([triangleMesh(), triangleMesh()], {
    getOwnPropertyDescriptor(target, key) {
      if (key === '0') current = false;
      if (key === '1') laterReads++;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  assert.throws(() => admitGraphNodeMeshes(rows, 2, () => current), { name: 'AbortError' });
  assert.equal(laterReads, 0);
});

test('throwing reflection is translated to a bounded admission error', () => {
  const hostile = new Proxy(triangleMesh(), { ownKeys() { throw Error('application secret'); } });
  refused(() => admitGraphNodeMeshes([hostile], 1));
});

test('resizable and proxied typed arrays cannot become owned geometry', () => {
  const buffer = new ArrayBuffer(36, { maxByteLength: 72 });
  if (buffer.resizable) refused(() => admitGraphNodeMeshes([{ ...triangleMesh(), positions: new Float32Array(buffer) }], 1));
  refused(() => admitGraphNodeMeshes([{ ...triangleMesh(), positions: new Proxy(triangleMesh().positions, {}) }], 1));
});
