import { expect } from '@open-wc/testing';
import { fittedGraphCamera, graphCurveExtrema, graphCurvePoint, normalizeGraphCurvature, projectSpatialPoint, projectSpatialScene, pickSpatialScene, type SpatialWorldNode } from './graph-spatial.js';
import type { LyraGraphEdge, LyraGraphPosition } from './graph-model.js';

const viewport = { width: 600, height: 400 };
const camera = { yaw: 0.6, pitch: 0.2, distance: 500, target: { x: 0, y: 0, z: 0 } };
const world = (id: string, position: LyraGraphPosition): SpatialWorldNode => ({ node: { id }, position, radius: 2, shape: 'circle' });
const a = { x: 0, y: 0, z: 0 }, b = { x: 100, y: 0, z: 0 };
const curved: LyraGraphEdge = { id: 'curve', source: 'a', target: 'b', curvature: 0.5, directed: true };

describe('spatial quadratic edges', () => {
  it('uses stable directed world curvature and exact endpoints', () => {
    expect(graphCurvePoint(a, b, 0.5, 0)).to.deep.equal(a);
    expect(graphCurvePoint(a, b, 0.5, 1)).to.deep.equal(b);
    expect(graphCurvePoint(a, b, 0.5, 0.5)).to.deep.equal({ x: 50, y: 0, z: 50 });
    expect(graphCurvePoint(b, a, 0.5, 0.5)).to.deep.equal({ x: 50, y: 0, z: -50 });
    expect(graphCurvePoint(a, b, -0.5, 0.5)).to.deep.equal({ x: 50, y: 0, z: -50 });
    expect(graphCurvePoint(a, a, 1, 0.5)).to.deep.equal(a);
    expect([NaN, Infinity, undefined, '1'].map(normalizeGraphCurvature)).to.deep.equal([0, 0, 0, 0]);
    expect([-2, 2].map(normalizeGraphCurvature)).to.deep.equal([-1, 1]);
  });

  it('samples sixteen curve strokes with continuous projected dash offsets and a curved label', () => {
    const scene = projectSpatialScene([world('a', a), world('b', b)], [curved], camera, viewport);
    expect(scene.segments.length).to.equal(16);
    let offset = 0;
    for (const segment of scene.segments) {
      expect(segment.offset).to.be.closeTo(offset, 1e-9);
      offset += Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
    }
    expect(scene.segments.find(segment => segment.middle)?.labelPoint).to.deep.equal(projectSpatialPoint({ x: 50, y: 0, z: 50 }, camera, viewport));
    const midpoint = projectSpatialPoint({ x: 50, y: 0, z: 50 }, camera, viewport)!;
    expect(pickSpatialScene(scene, midpoint.x, midpoint.y)?.id).to.equal('curve');
    const chord = projectSpatialPoint({ x: 50, y: 0, z: 0 }, camera, viewport)!;
    expect(pickSpatialScene(scene, chord.x, chord.y)).to.equal(undefined);
  });

  it('projects the analytic endpoint tangent through the perspective differential', () => {
    const scene = projectSpatialScene([world('a', a), world('b', b)], [curved], camera, viewport);
    const direction = scene.segments.at(-1)!.arrowDirection!;
    const endpoint = projectSpatialPoint(b, camera, viewport)!;
    const preceding = projectSpatialPoint(graphCurvePoint(a, b, 0.5, 1 - 1e-7), camera, viewport)!;
    const dx = endpoint.x - preceding.x, dy = endpoint.y - preceding.y;
    const length = Math.hypot(dx, dy);
    expect(direction.x).to.be.closeTo(dx / length, 1e-6);
    expect(direction.y).to.be.closeTo(dy / length, 1e-6);
  });

  it('retains loop and dangling geometry while reserving coincident curve segments', () => {
    const nodes = [world('a', a), world('b', a)];
    const plain = projectSpatialScene(nodes, [{ source: 'a', target: 'a' }, { source: 'a', target: 'missing' }], camera, viewport);
    const ignored = projectSpatialScene(nodes, [{ source: 'a', target: 'a', curvature: 1 }, { source: 'a', target: 'missing', curvature: 1 }], camera, viewport);
    expect(ignored.segments.map(({ a, b }) => [a, b])).to.deep.equal(plain.segments.map(({ a, b }) => [a, b]));
    expect(projectSpatialScene(nodes, [curved], camera, viewport).segments.length).to.equal(16);
  });

  it('fits analytic curve extrema and keeps the default fit exact', () => {
    const nodes = [world('a', a), world('b', b)];
    expect(graphCurveExtrema(a, b, 0.5)).to.deep.include({ x: 50, y: 0, z: 50 });
    const fitted = fittedGraphCamera(nodes, viewport, 24, [curved]);
    expect(fitted.target.z).to.be.greaterThan(20);
    expect(fittedGraphCamera(nodes, viewport, 24, [{ ...curved, curvature: 0 }])).to.deep.equal(fittedGraphCamera(nodes, viewport));
    const large = [world('a', { x: 0, y: 0, z: 1e6 }), world('b', { x: 1e6, y: 0, z: 1e6 })];
    const bounded = fittedGraphCamera(large, viewport, 24, [{ ...curved, curvature: 1 }]);
    expect(bounded.target.z).to.equal(1e6);
    expect(bounded.distance).to.be.greaterThan(2e6);
    expect(bounded.distance).to.be.at.most(1e7);
  });
});
