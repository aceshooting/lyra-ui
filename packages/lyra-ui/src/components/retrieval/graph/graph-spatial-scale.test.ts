import { expect } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { projectSpatialScene, type SpatialWorldNode } from './graph-spatial.js';

it('projects n=10000 without fixed straight-edge subdivision or a global comparison sort', () => {
  const nodes: SpatialWorldNode[] = Array.from({ length: 10000 }, (_, i) => ({
    node: { id: `n${i}` }, position: { x: i % 100, y: Math.floor(i / 100), z: 0 }, radius: 6, shape: 'circle',
  }));
  const edges = Array.from({ length: 1000 }, (_, i) => ({ source: `n${i}`, target: `n${i + 1}` }));
  const native = Array.prototype.sort;
  let compared = 0;
  Array.prototype.sort = function <T>(this: T[], compare?: (a: T, b: T) => number): T[] {
    if (this.length >= 10000 && compare) {
      return native.call(this, (a, b) => { compared++; return compare(a as T, b as T); }) as T[];
    }
    return native.call(this, compare) as T[];
  };
  try {
    const scene = projectSpatialScene(nodes, edges, { yaw: 0, pitch: 0, distance: 300, target: { x: 0, y: 0, z: 0 } }, { width: 600, height: 400 });
    recordScaleMeasurement('lr-graph', 'n=10000 spatial projection', { nodes: scene.nodes.length, segments: scene.segments.length, compared });
    expect(scene.segments.length).to.equal(edges.length);
    expect(compared).to.equal(0);
    expect(scene.primitives.slice(0, edges.length).every(entry => entry.kind === 'link')).to.equal(true);
    expect(scene.primitives.at(-1)?.kind).to.equal('node');
  } finally { Array.prototype.sort = native; }
});


it('matches exact depth ordering and stable equal-depth ties across reused projection storage', async () => {
  const { SpatialProjectionWorkspace } = await import('./graph-spatial.js');
  const workspace = new SpatialProjectionWorkspace();
  const nodes: SpatialWorldNode[] = Array.from({ length: 300 }, (_, i) => ({
    node: { id: `n${i}` }, position: { x: i % 20, y: i % 13, z: (i % 31) * 3 }, radius: 6, shape: 'circle',
  }));
  const edges = nodes.slice(1).map((entry, i) => ({ source: `n${i}`, target: entry.node.id }));
  for (const yaw of [0, 0.5, -0.5, Math.PI]) {
    const scene = projectSpatialScene(nodes, edges, { yaw, pitch: 0.3, distance: 120, target: { x: 0, y: 0, z: 0 } }, { width: 600, height: 400 }, workspace);
    const reference = [
      ...scene.nodes.map(value => ({ kind: 'node' as const, value, depth: value.depth })),
      ...scene.segments.map(value => ({ kind: 'link' as const, value, depth: value.depth })),
    ].sort((a, b) => b.depth - a.depth || (a.kind === b.kind ? 0 : a.kind === 'link' ? -1 : 1));
    expect(scene.primitives.every((entry, i) => entry.value === reference[i]!.value)).to.equal(true);
    expect(scene.primitives.every(entry => Number.isFinite(entry.depth) && entry.depth > 0)).to.equal(true);
  }
});

it('keeps indexed picking identical for overlaps, wide geometry and nonempty hits', async () => {
  const { SpatialHitIndex, pickSpatialScene } = await import('./graph-spatial.js');
  const nodes: SpatialWorldNode[] = Array.from({ length: 100 }, (_, i) => ({
    node: { id: `n${i}` }, position: { x: (i % 10) * 30 - 150, y: Math.floor(i / 10) * 20 - 100, z: i % 3 * 30 },
    radius: i === 0 ? 2000 : 10, shape: i % 2 ? 'square' : 'diamond',
  }));
  const scene = projectSpatialScene(nodes, nodes.slice(1).map((entry, i) => ({ source: `n${i}`, target: entry.node.id })),
    { yaw: 0, pitch: 0, distance: 300, target: { x: 0, y: 0, z: 0 } }, { width: 600, height: 400 });
  const index = new SpatialHitIndex(scene);
  let hits = 0;
  for (let x = 0; x <= 600; x += 20) for (let y = 0; y <= 400; y += 20) {
    const expected = pickSpatialScene(scene, x, y), actual = index.hit(x, y);
    if (expected) hits++;
    expect(actual ? `${actual.kind}:${actual.id}` : '').to.equal(expected ? `${expected.kind}:${expected.id}` : '');
  }
  expect(hits).to.be.greaterThan(10);
});

it('preserves the reference fallback for out-of-domain direct helper depths', async () => {
  const { SpatialProjectionWorkspace } = await import('./graph-spatial.js');
  const sample = projectSpatialScene([{ node: { id: 'a' }, position: { x: 0, y: 0, z: 0 }, radius: 5, shape: 'circle' }], [],
    { yaw: 0, pitch: 0, distance: 300, target: { x: 0, y: 0, z: 0 } }, { width: 600, height: 400 }).primitives[0]!;
  const entries = [Infinity, -1, 0, NaN, Number.MIN_VALUE, 300].map(depth => ({ ...sample, depth }));
  const reference = [...entries].sort((a, b) => b.depth - a.depth);
  expect(new SpatialProjectionWorkspace().order([...entries]).every((entry, i) => entry === reference[i])).to.equal(true);
});
