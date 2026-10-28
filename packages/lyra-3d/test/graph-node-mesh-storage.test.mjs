import assert from 'node:assert/strict';
import test from 'node:test';
import { graphNodeMeshStorage } from '../dist/graph/node-mesh-storage.js';

const input = (extra = {}) => ({ nodeCount: 3, customNodeCount: 1, triangleCount: 2, ordinaryPrimitiveCount: 4,
  sortKeyBytesBefore: 0, sortKeyBytesAfter: 0, scratchBytes: 0, ...extra });
const rejected = (value) => assert.throws(() => graphNodeMeshStorage(value), RangeError);

test('all-null storage is zero without node-sized custom masks or tables', () => {
  assert.deepEqual(graphNodeMeshStorage(input({ nodeCount: 200_000, customNodeCount: 0, triangleCount: 0 })),
    { payloadBytes: 0, cpuBytes: 0, gpuBytes: 0, accountedBytes: 0, primitiveCount: 4 });
});

test('ledger charges both admitted copies, CPU attribute backing, staging, mappings and separate GPU upload', () => {
  const value = graphNodeMeshStorage(input());
  assert.deepEqual(value, { payloadBytes: 112, cpuBytes: 651, gpuBytes: 320, accountedBytes: 971, primitiveCount: 6 });
  // CPU =2*(48T+16R)+160T+12T+8T+4*(N+1)+N+16N, GPU=160T.
});

test('turning on translucency charges new sort keys for the entire mixed scene', () => {
  const before = graphNodeMeshStorage(input());
  const sorted = graphNodeMeshStorage(input({ sortKeyBytesAfter: 48 }));
  assert.equal(sorted.cpuBytes - before.cpuBytes, 48);
  const retained = graphNodeMeshStorage(input({ sortKeyBytesBefore: 32, sortKeyBytesAfter: 48 }));
  assert.equal(retained.cpuBytes - before.cpuBytes, 16);
});

test('all scene-wide custom scratch participates in the CPU cap', () => {
  const base = graphNodeMeshStorage(input());
  assert.equal(graphNodeMeshStorage(input({ scratchBytes: 8192 })).cpuBytes, base.cpuBytes + 8192);
  rejected(input({ scratchBytes: 32 * 1024 * 1024 }));
});

test('limits are joint and a large ordinary scene can refuse smaller custom geometry', () => {
  const maximum = input({ nodeCount: 200_000, customNodeCount: 16_384, triangleCount: 65_536, ordinaryPrimitiveCount: 1_900_000 });
  const accepted = graphNodeMeshStorage(maximum);
  assert.ok(accepted.cpuBytes < 32 * 1024 * 1024);
  assert.ok(accepted.gpuBytes < 16 * 1024 * 1024);
  rejected({ ...maximum, sortKeyBytesAfter: (maximum.ordinaryPrimitiveCount + maximum.triangleCount) * 8 });
});

test('existing primitive ceiling includes custom faces and refuses limit+1', () => {
  assert.equal(graphNodeMeshStorage(input({ ordinaryPrimitiveCount: 1_999_998 })).primitiveCount, 2_000_000);
  rejected(input({ ordinaryPrimitiveCount: 1_999_999 }));
});

test('negative fractional nonfinite unsafe and inconsistent accounting inputs reject', () => {
  for (const key of Object.keys(input())) for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1']) rejected(input({ [key]: value }));
  for (const extra of [{ nodeCount: 200_001 }, { customNodeCount: 4 }, { customNodeCount: 16_385, nodeCount: 20_000 },
    { triangleCount: 65_537 }, { triangleCount: 0 }, { customNodeCount: 0 }, { sortKeyBytesBefore: 33 },
    { sortKeyBytesAfter: 49 }, { sortKeyBytesAfter: 56 }]) rejected(input(extra));
});

test('all-null scenes refuse custom scratch and newly allocated mixed sort keys', () => {
  rejected(input({ customNodeCount: 0, triangleCount: 0, scratchBytes: 1 }));
  rejected(input({ customNodeCount: 0, triangleCount: 0, sortKeyBytesBefore: 8, sortKeyBytesAfter: 16 }));
  assert.equal(graphNodeMeshStorage(input({ customNodeCount: 0, triangleCount: 0, sortKeyBytesBefore: 16, sortKeyBytesAfter: 8 })).cpuBytes, 0);
});

test('the CPU storage cap accepts its exact boundary and rejects one extra scratch byte', () => {
  const remaining = 32 * 1024 * 1024 - graphNodeMeshStorage(input()).cpuBytes;
  assert.equal(graphNodeMeshStorage(input({ scratchBytes: remaining })).cpuBytes, 32 * 1024 * 1024);
  rejected(input({ scratchBytes: remaining + 1 }));
});
