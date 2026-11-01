import { expect } from '@open-wc/testing';
import { graphWebglCamera, graphWebglData } from './graph-webgl-engine.js';

const world = [{ node: { id: 'a', label: 'A', expandable: true }, position: { x: 1, y: 2, z: 3 }, radius: 15, shape: 'square' as const },
  { node: { id: 'b' }, position: { x: 4, y: 5, z: 6 }, radius: 20, shape: 'diamond' as const }];
const paint = { nodes: new Map([['a', 'rgba(255,0,0,0.5)'], ['b', '#00ff00']]), edges: new Map([['edge', '#0000ff']]), visibleEdges: new Set(['edge']), text: '#ffffff', selected: '#ff00ff', font: 'sans-serif', fontSize: 12, dimmedOpacity: 0.35 };
describe('graph WebGL component translation', () => {
  it('keeps spatial rows, world diameters, shapes, authored alpha and dangling edge identity', () => {
    const value = graphWebglData(world, [{ id: 'edge', source: 'a', target: 'missing', width: 3, directed: true, dash: [4, 2] }], paint, () => [1, 0, 0, 0.5]);
    expect(value.nodeCount).to.equal(2); expect([...value.positions]).to.deep.equal([1, 2, 3, 4, 5, 6]);
    expect([...value.sizes]).to.deep.equal([30, 40]); expect([...value.spatialAppearance.nodeShapes]).to.deep.equal([1, 2]);
    expect([...value.source]).to.deep.equal([0]); expect([...value.target]).to.deep.equal([0]);
    expect([...value.spatialAppearance.dangling]).to.deep.equal([1]); expect(value.spatialAppearance.nodeColors[3]).to.equal(0.5);
    expect(value.nodeLabels).to.equal('none'); expect(value.withEdgeLabels).to.equal(false);
  });
  it('accepts independent finite camera distances without clamping targets beyond the renderable world', () => {
    const fallback = { yaw: 0, pitch: 0, distance: 500, target: { x: 0, y: 0, z: 0 } };
    const value = graphWebglCamera({ yaw: 1, pitch: 0, distance: 5e8, target: { x: 1e7, y: -1e7, z: 0 } }, fallback);
    expect(value.distance).to.equal(5e8); expect(value.target.x).to.equal(1e7);
    let reads = 0; const hostile = Object.defineProperty({}, 'distance', { get() { reads++; throw Error(); } });
    expect(graphWebglCamera(hostile, fallback)).to.deep.equal(fallback); expect(reads).to.equal(0);
    expect(graphWebglCamera({ distance: Infinity }, fallback).distance).to.equal(500);
  });
});


it('owns normalized record curvature only when an effective curve exists', () => {
  const edges = [-4, 0.25, 4, NaN, Infinity].map((curvature, i) => ({ id: `e${i}`, source: 'a', target: 'b', curvature }));
  const value = graphWebglData(world, edges, paint, () => [1, 0, 0, 1]);
  const curves = (value.spatialAppearance as unknown as { edgeCurvatures?: Float32Array }).edgeCurvatures;
  expect(curves instanceof Float32Array).to.equal(true); expect(Array.from(curves ?? [])).to.deep.equal([-1, 0.25, 1, 0, 0]);
  edges[0]!.curvature = 0; expect(curves?.[0]).to.equal(-1);
  for (const curvature of [undefined, 0, NaN, Infinity, '0.5' as unknown as number]) {
    const straightEdges = [{ source: 'a', target: 'b', curvature }];
    const straight = graphWebglData(world, straightEdges, paint, () => [1, 0, 0, 1]);
    expect((straight.spatialAppearance as unknown as { edgeCurvatures?: Float32Array }).edgeCurvatures).to.equal(undefined);
  }
});
