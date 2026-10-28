import { expect } from '@open-wc/testing';
import { SpatialHitIndex, pickSpatialScene, projectSpatialScene, type SpatialWorldNode } from './graph-spatial.js';
import type { LyraGraphPosition } from './graph-model.js';

const viewport = { width: 600, height: 400 };
const node = (id: string, position: LyraGraphPosition): SpatialWorldNode => ({ node: { id }, position, radius: 2, shape: 'circle' });

describe('spatial curve clipping and arrow boundaries', () => {
  it('accumulates only visible clipped stroke lengths through a near-plane crossing', () => {
    const world = [node('a', { x: -100, y: 0, z: 0 }), node('b', { x: 100, y: 0, z: 0 })];
    for (const distance of [100, 120]) {
      const camera = { yaw: 0, pitch: 0, distance, target: { x: 0, y: 0, z: 0 } };
      const near = distance * 0.0001;
      const scene = projectSpatialScene(world, [{ id: 'curve', source: 'a', target: 'b', curvature: 1, dash: [7, 3] }], camera, viewport);
      expect(scene.segments.length).to.be.greaterThan(0); expect(scene.segments.length).to.be.lessThan(16);
      expect(scene.segments.some(segment => Math.abs(segment.a.depth - near) < 1e-8 || Math.abs(segment.b.depth - near) < 1e-8)).to.equal(true);
      let offset = 0;
      for (const segment of scene.segments) {
        expect([segment.a.x, segment.a.y, segment.a.depth, segment.b.x, segment.b.y, segment.b.depth, segment.depth, segment.offset].every(Number.isFinite)).to.equal(true);
        expect(segment.a.depth).to.be.at.least(near - 1e-8); expect(segment.b.depth).to.be.at.least(near - 1e-8);
        expect(segment.offset).to.be.closeTo(offset, Math.max(1e-8, offset * 1e-12));
        offset += Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
      }
      expect(offset).to.be.greaterThan(0);
    }
  });

  it('suppresses a curved arrow whose analytic endpoint tangent projects to zero', () => {
    // D=(-2,0,1), c=0.5 gives Q\'(1)=(0,0,5), directly along the endpoint viewing ray.
    const world = [node('a', { x: 2, y: 0, z: -1 }), node('b', { x: 0, y: 0, z: 0 })];
    const camera = { yaw: 0, pitch: 0, distance: 100, target: { x: 0, y: 0, z: 0 } };
    const scene = projectSpatialScene(world, [{ source: 'a', target: 'b', curvature: 0.5, directed: true }], camera, viewport);
    expect(scene.segments.length).to.equal(16);
    expect(scene.segments.at(-1)!.curved).to.equal(true);
    expect(scene.segments.at(-1)!.arrowDirection).to.equal(undefined);
  });

  it('does not add arrow triangle area outside the curved stroke hit footprint', () => {
    const world = [node('a', { x: -100, y: 0, z: 0 }), node('b', { x: 100, y: 0, z: 0 })];
    const camera = { yaw: 0, pitch: 0, distance: 500, target: { x: 0, y: 0, z: 0 } };
    const scene = projectSpatialScene(world, [{ id: 'curve', source: 'a', target: 'b', curvature: 0.5, directed: true, width: 100 }], camera, viewport);
    const last = scene.segments.at(-1)!, direction = last.arrowDirection!;
    const angle = Math.atan2(direction.y, direction.x), target = scene.nodes.find(entry => entry.node.id === 'b')!;
    const tip = { x: last.b.x - direction.x * target.screenRadius, y: last.b.y - direction.y * target.screenRadius };
    const size = 300;
    const left = { x: tip.x - Math.cos(angle - 0.45) * size, y: tip.y - Math.sin(angle - 0.45) * size };
    const right = { x: tip.x - Math.cos(angle + 0.45) * size, y: tip.y - Math.sin(angle + 0.45) * size };
    // Strictly interior barycentric coordinates; the lateral distance exceeds the 50px stroke radius.
    const point = { x: 0.1 * tip.x + 0.75 * left.x + 0.15 * right.x, y: 0.1 * tip.y + 0.75 * left.y + 0.15 * right.y };
    expect(Math.abs(point.y - last.b.y)).to.be.greaterThan(50);
    expect(pickSpatialScene(scene, point.x, point.y)).to.equal(undefined);
    expect(new SpatialHitIndex(scene).hit(point.x, point.y)).to.equal(undefined);
  });
});
