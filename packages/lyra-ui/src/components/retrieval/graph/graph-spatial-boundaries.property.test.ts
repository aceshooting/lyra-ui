import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { fittedGraphCamera, pickSpatialScene, projectSpatialPoint, projectSpatialScene, SpatialHitIndex,
  type SpatialWorldNode } from './graph-spatial.js';

const camera = { yaw: 0, pitch: 0, distance: 300, target: { x: 0, y: 0, z: 0 } };
const viewport = { width: 600, height: 400 };
const node = (id: string, x: number, y: number, z: number, radius = 15): SpatialWorldNode => ({
  node: { id }, position: { x, y, z }, radius, shape: 'circle',
});

describe('graph spatial projection boundaries', () => {
  it('fits an empty graph to a finite centered camera that accepts later geometry', () => {
    const fitted = fittedGraphCamera([], viewport);
    expect(fitted).to.deep.equal({ yaw: 0, pitch: 0, distance: 500, target: { x: 0, y: 0, z: 0 } });
    const center = projectSpatialPoint({ x: 0, y: 0, z: 0 }, fitted, viewport)!;
    expect([center.x, center.y]).to.deep.equal([300, 200]);
    expect(center.depth).to.be.greaterThan(0);
    expect(pickSpatialScene(projectSpatialScene([node('new', 0, 0, 0)], [], fitted, viewport), 300, 200)?.id).to.equal('new');
  });

  it('omits an edge with no source and paints a dangling target stub without making it selectable', () => {
    const scene = projectSpatialScene([node('source', 0, 0, 0, 1)], [
      { id: 'missing-source', source: 'absent', target: 'source' },
      { id: 'stub', source: 'source', target: 'absent' },
    ], camera, viewport);
    expect(scene.segments.map(segment => segment.id)).to.deep.equal(['stub']);
    expect(scene.segments[0]!.dangling).to.equal(true);
    const end = scene.segments[0]!.b;
    expect(Math.hypot(end.x - 300, end.y - 200)).to.be.greaterThan(12);
    expect(pickSpatialScene(scene, end.x, end.y)).to.equal(undefined);
    expect(new SpatialHitIndex(scene).hit(end.x, end.y)).to.equal(undefined);
  });

  it('projects a closed self-loop away from the node and makes its visible arc selectable', () => {
    const scene = projectSpatialScene([node('self', 0, 0, 0)], [
      { id: 'loop', source: 'self', target: 'self' },
    ], camera, viewport);
    expect(scene.segments.length).to.equal(16);
    const first = scene.segments[0]!, last = scene.segments.at(-1)!;
    expect(last.b.x).to.be.closeTo(first.a.x, 1e-8);
    expect(last.b.y).to.be.closeTo(first.a.y, 1e-8);
    expect(scene.segments.every(segment => !segment.dangling)).to.equal(true);
    const middle = scene.segments.find(segment => segment.middle)!.labelPoint!;
    expect(middle.y).to.be.lessThan(scene.nodes[0]!.y - 2 * scene.nodes[0]!.screenRadius);
    expect(pickSpatialScene(scene, middle.x, middle.y)?.id).to.equal('loop');
    expect(new SpatialHitIndex(scene).hit(middle.x, middle.y)?.id).to.equal('loop');
  });

  it('clips links that emerge from behind the eye to finite positive-depth geometry', () => {
    fc.assert(fc.property(fc.integer({ min: 50, max: 1000 }), fc.integer({ min: 1, max: 200 }), (distance, behind) => {
      const view = { ...camera, distance };
      const scene = projectSpatialScene([
        node('behind', -20, 0, distance + behind), node('visible', 20, 0, 0),
      ], [{ id: 'crossing', source: 'behind', target: 'visible' }], view, viewport);
      expect(scene.nodes.map(entry => entry.node.id)).to.deep.equal(['visible']);
      expect(scene.segments.length).to.be.greaterThan(0);
      const near = Math.max(0.01, distance * 0.0001);
      for (const segment of scene.segments) {
        expect([segment.a.x, segment.a.y, segment.b.x, segment.b.y].every(Number.isFinite)).to.equal(true);
        expect(segment.a.depth).to.be.at.least(near - 1e-8);
        expect(segment.b.depth).to.be.at.least(near - 1e-8);
      }
    }), propertyRuns());
  });

  it('keeps the frontmost node selectable when a depth-changing edge projects to one screen point', () => {
    const scene = projectSpatialScene([node('far', 0, 0, -80), node('near', 0, 0, 80)], [
      { id: 'coincident', source: 'far', target: 'near' },
    ], camera, viewport);
    expect(scene.segments.length).to.be.greaterThan(0);
    expect(scene.segments.every(segment => segment.a.x === segment.b.x && segment.a.y === segment.b.y)).to.equal(true);
    expect(pickSpatialScene(scene, 300, 200)?.id).to.equal('near');
    expect(new SpatialHitIndex(scene).hit(300, 200)?.id).to.equal('near');
  });
});
