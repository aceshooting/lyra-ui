import { expect } from '@open-wc/testing';
import {
  normalizeGraphCamera,
  spatialNodePosition,
  projectSpatialPoint,
  projectSpatialScene,
  pickSpatialScene,
  type SpatialWorldNode,
} from './graph-spatial.js';

const camera = { yaw: 0, pitch: 0, distance: 300, target: { x: 0, y: 0, z: 0 } };
const viewport = { width: 600, height: 400 };
const node = (id: string, z: number): SpatialWorldNode => ({
  node: { id }, position: { x: 0, y: 0, z }, radius: 15, shape: 'circle',
});

describe('graph perspective geometry', () => {
  it('projects real z coordinates with perspective scaling', () => {
    const near = projectSpatialPoint({ x: 40, y: 0, z: 100 }, camera, viewport)!;
    const far = projectSpatialPoint({ x: 40, y: 0, z: -100 }, camera, viewport)!;
    expect(near.x).to.be.greaterThan(far.x);
    expect(near.scale).to.be.greaterThan(far.scale);
    expect(near.depth).to.be.lessThan(far.depth);
  });

  it('clips points behind the near plane without nonfinite projection', () => {
    expect(projectSpatialPoint({ x: 0, y: 0, z: 301 }, camera, viewport)).to.equal(undefined);
    const scene = projectSpatialScene([node('front', 0), node('behind', 400)], [
      { source: 'front', target: 'behind' },
    ], camera, viewport);
    expect(scene.nodes.map((entry) => entry.node.id)).to.deep.equal(['front']);
    expect(scene.segments.length).to.be.greaterThan(0);
    expect(scene.segments.every((entry) => [entry.a.x, entry.a.y, entry.b.x, entry.b.y].every(Number.isFinite))).to.equal(true);
  });

  it('picks the nearest overlapping node independently of input order and after orbit', () => {
    const nodes = [node('near', 80), node('far', -80)];
    const front = projectSpatialScene(nodes, [], camera, viewport);
    expect(pickSpatialScene(front, 300, 200)?.id).to.equal('near');
    const back = projectSpatialScene(nodes, [], { ...camera, yaw: Math.PI }, viewport);
    expect(pickSpatialScene(back, 300, 200)?.id).to.equal('far');
  });

  it('picks the last painted node when projected depths are equal', () => {
    const scene = projectSpatialScene([node('first', 0), node('last', 0)], [], camera, viewport);
    expect(pickSpatialScene(scene, 300, 200)?.id).to.equal('last');
  });

  it('compares edge hit depth with node depth rather than always privileging nodes', () => {
    const nodes = [node('back', -80),
      { ...node('left', 80), position: { x: -80, y: 0, z: 80 } },
      { ...node('right', 80), position: { x: 80, y: 0, z: 80 } }];
    const scene = projectSpatialScene(nodes, [{ id: 'front-link', source: 'left', target: 'right' }], camera, viewport);
    expect(pickSpatialScene(scene, 300, 200)?.id).to.equal('front-link');
  });

  it('picks the last painted overlapping edge at equal depth', () => {
    const nodes = [
      { ...node('left', 0), position: { x: -80, y: 0, z: 0 } },
      { ...node('right', 0), position: { x: 80, y: 0, z: 0 } },
    ];
    const scene = projectSpatialScene(nodes, [
      { id: 'first-link', source: 'left', target: 'right' },
      { id: 'last-link', source: 'left', target: 'right' },
    ], camera, viewport);
    expect(pickSpatialScene(scene, 300, 200)?.id).to.equal('last-link');
  });

  it('normalizes hostile camera and position objects without invoking accessors', () => {
    let reads = 0;
    const unsafe = Object.defineProperty({}, 'yaw', { get() { reads++; throw new Error('accessor'); } });
    const normalized = normalizeGraphCamera(unsafe, camera);
    expect(normalized).to.deep.equal(camera);
    expect(reads).to.equal(0);
    const inherited = Object.create({ x: 1, y: 2, z: 3 }) as { x: number; y: number; z: number };
    const fallback = spatialNodePosition({ id: 'a' });
    expect(spatialNodePosition({ id: 'a', position: inherited })).to.deep.equal(fallback);
    const invalid = normalizeGraphCamera({ yaw: Infinity, pitch: NaN, distance: -1, target: { x: Infinity, y: 0, z: 0 } }, camera);
    expect([invalid.yaw, invalid.pitch, invalid.distance, invalid.target.x].every(Number.isFinite)).to.equal(true);
    expect(invalid.distance).to.be.greaterThan(0);
  });

  it('keeps deterministic spatial positions and never changes authored coordinates', () => {
    const position = Object.freeze({ x: 20, y: 30, z: 40 });
    const original = Object.freeze({ id: 'authored', position });
    expect(spatialNodePosition(original)).to.deep.equal(position);
    expect(spatialNodePosition({ id: 'fallback' })).to.deep.equal(spatialNodePosition({ id: 'fallback' }));
    expect(spatialNodePosition({ id: 'fallback' }).z).not.to.equal(0);
    projectSpatialScene([{ node: original, position, radius: 15, shape: 'circle' }], [], camera, viewport);
    expect(original.position).to.deep.equal({ x: 20, y: 30, z: 40 });
  });

  it('retains a 24px minimum square pointer target for a distant node', () => {
    const square: SpatialWorldNode = { ...node('small-square', -1000), radius: 6, shape: 'square' };
    const scene = projectSpatialScene([square], [], camera, viewport);
    expect(pickSpatialScene(scene, 311, 211)?.id).to.equal('small-square');
    expect(pickSpatialScene(scene, 313, 200)).to.equal(undefined);
  });

});
