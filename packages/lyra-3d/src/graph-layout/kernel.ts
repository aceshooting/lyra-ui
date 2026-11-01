import { graphDagColumnLength } from './admission.js';
import type { GraphDagAdmission } from './admission.js';
import { GraphDagLayoutError } from './types.js';
import type { GraphDagLayoutPhase, GraphDagLayoutResult } from './types.js';

export interface GraphDagKernelStep {
  readonly phase: GraphDagLayoutPhase;
  readonly operations: number;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly header?: true;
  readonly allocation?: true;
}
/** Every suspension bounds scalar work; allocations have a separate scheduling checkpoint. */
export function* createGraphDagKernel(admission: GraphDagAdmission): Generator<GraphDagKernelStep, GraphDagLayoutResult, void> {
  const { nodeCount, edgeCount, source: borrowedSource, target: borrowedTarget, direction, nodeGap, layerGap } = admission;
  let operations = 0;
  let phase: GraphDagLayoutPhase = 'snapshot';
  const charge = (): GraphDagKernelStep => ({ phase, operations: ++operations, nodeCount, edgeCount });
  const allocation = (): GraphDagKernelStep => ({ phase, operations, nodeCount, edgeCount, allocation: true });
  yield { phase, operations, nodeCount, edgeCount, header: true };
  yield allocation();
  const source = new Uint32Array(edgeCount);
  yield allocation();
  const target = new Uint32Array(edgeCount);
  yield allocation();
  const indegree = new Uint32Array(nodeCount);
  yield allocation();
  const degree = new Uint32Array(nodeCount);
  for (let edge = 0; edge < edgeCount; edge++) {
    if (graphDagColumnLength(borrowedSource) !== edgeCount) throw new GraphDagLayoutError('invalid-input');
    yield charge();
    const from = borrowedSource[edge];
    yield charge();
    if (from === undefined || from >= nodeCount) throw new GraphDagLayoutError('invalid-input');
    yield charge();
    source[edge] = from;
    yield charge();
    if (graphDagColumnLength(borrowedTarget) !== edgeCount) throw new GraphDagLayoutError('invalid-input');
    yield charge();
    const to = borrowedTarget[edge];
    yield charge();
    if (to === undefined || to >= nodeCount) throw new GraphDagLayoutError('invalid-input');
    yield charge();
    target[edge] = to;
    yield charge();
    degree[from] = degree[from]! + 1;
    yield charge();
    indegree[to] = indegree[to]! + 1;
    yield charge();
  }
  phase = 'adjacency';
  yield allocation();
  const offsets = new Uint32Array(nodeCount + 1);
  yield allocation();
  const cursors = new Uint32Array(nodeCount);
  for (let node = 0; node < nodeCount; node++) {
    offsets[node + 1] = offsets[node]! + degree[node]!;
    yield charge();
    cursors[node] = offsets[node]!;
    yield charge();
  }
  yield allocation();
  const adjacent = new Uint32Array(edgeCount);
  for (let edge = 0; edge < edgeCount; edge++) {
    const from = source[edge]!;
    const slot = cursors[from]!;
    adjacent[slot] = target[edge]!;
    yield charge();
    cursors[from] = slot + 1;
    yield charge();
  }
  phase = 'rank';
  yield allocation();
  const queue = new Uint32Array(nodeCount);
  yield allocation();
  const ranks = new Uint32Array(nodeCount);
  let head = 0;
  let tail = 0;
  for (let node = 0; node < nodeCount; node++) {
    if (indegree[node] === 0) queue[tail++] = node;
    yield charge();
  }
  let layerCount = nodeCount === 0 ? 0 : 1;
  while (head < tail) {
    const node = queue[head++]!;
    const nextRank = ranks[node]! + 1;
    yield charge();
    for (let edge = offsets[node]!; edge < offsets[node + 1]!; edge++) {
      const to = adjacent[edge]!;
      if (ranks[to]! < nextRank) ranks[to] = nextRank;
      yield charge();
      indegree[to] = indegree[to]! - 1;
      if (indegree[to] === 0) queue[tail++] = to;
      yield charge();
    }
    layerCount = Math.max(layerCount, nextRank);
    yield charge();
  }
  if (head !== nodeCount) throw new GraphDagLayoutError('cyclic-graph');
  phase = 'place';
  yield allocation();
  const sizes = new Uint32Array(layerCount);
  for (let node = 0; node < nodeCount; node++) {
    const rank = ranks[node]!;
    sizes[rank] = sizes[rank]! + 1;
    yield charge();
  }
  yield allocation();
  const rankOffsets = new Uint32Array(layerCount + 1);
  yield allocation();
  const slots = new Uint32Array(layerCount);
  const principalExtent = (layerCount - 1) * layerGap / 2;
  if (principalExtent > 10000000) throw new GraphDagLayoutError('coordinate-range');
  for (let rank = 0; rank < layerCount; rank++) {
    rankOffsets[rank + 1] = rankOffsets[rank]! + sizes[rank]!;
    yield charge();
    slots[rank] = rankOffsets[rank]!;
    yield charge();
    const columns = Math.ceil(Math.sqrt(sizes[rank]!));
    const rows = Math.ceil(sizes[rank]! / columns);
    if ((columns - 1) * nodeGap / 2 > 10000000 || (rows - 1) * nodeGap / 2 > 10000000) throw new GraphDagLayoutError('coordinate-range');
    yield charge();
  }
  yield allocation();
  const positions = new Float32Array(nodeCount * 3);
  const axis = direction.endsWith('x') ? 0 : direction.endsWith('y') ? 1 : 2;
  const sign = direction.startsWith('-') ? -1 : 1;
  for (let node = 0; node < nodeCount; node++) {
    const rank = ranks[node]!;
    const slot = slots[rank]! - rankOffsets[rank]!;
    slots[rank] = slots[rank]! + 1;
    yield charge();
    const columns = Math.ceil(Math.sqrt(sizes[rank]!));
    const rows = Math.ceil(sizes[rank]! / columns);
    const u = (slot % columns - (columns - 1) / 2) * nodeGap;
    const v = (Math.floor(slot / columns) - (rows - 1) / 2) * nodeGap;
    const w = (rank - (layerCount - 1) / 2) * layerGap * sign;
    yield charge();
    for (let coordinate = 0; coordinate < 3; coordinate++) {
      const value = coordinate === axis ? w : axis === 0 ? coordinate === 1 ? u : v : axis === 1 ? coordinate === 0 ? u : v : coordinate === 0 ? u : v;
      if (!Number.isFinite(value) || Math.abs(value) > 10000000) throw new GraphDagLayoutError('coordinate-range');
      yield charge();
      positions[node * 3 + coordinate] = value;
      yield charge();
    }
  }
  return { positions, ranks, layerCount };
}
