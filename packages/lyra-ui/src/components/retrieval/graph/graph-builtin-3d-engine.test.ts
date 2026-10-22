import { expect, fixture, html } from '@open-wc/testing';
import { GraphBuiltin3dEngine, type GraphBuiltin3dFrame } from './graph-builtin-3d-engine.js';
import { graphLinkIdentity } from './graph-model.js';
import { projectSpatialPoint, type SpatialWorldNode } from './graph-spatial.js';

async function setup() {
  const canvas = await fixture<HTMLCanvasElement>(html`<canvas style="width: 320px; height: 240px"></canvas>`);
  const context = canvas.getContext('2d')!;
  const node: SpatialWorldNode = { node: { id: 'a', label: 'Alpha' }, position: { x: 0, y: 0, z: 0 }, radius: 30, shape: 'circle' };
  const frame: GraphBuiltin3dFrame = { world: [node], edges: [], camera: { yaw: 0, pitch: 0, distance: 500, target: { x: 0, y: 0, z: 0 } },
    viewport: { width: 320, height: 240 }, fittedDistance: 500,
    paint: { nodes: new Map([['a', '#ff0000']]), edges: new Map(), visibleEdges: new Set(), text: '#ffffff', selected: '#0000ff', font: 'sans-serif', fontSize: 12, dimmedOpacity: 0.25 },
    selectedNodeIds: [], selectedEdgeIds: [], dimmedNodeIds: [], dimmedEdgeIds: [], focusNodeId: null,
    nodeLabels: 'none', withEdgeLabels: false, edgeLabelMinZoom: 0.6 };
  const engine = new GraphBuiltin3dEngine(canvas, context);
  const sample = (x: number, y: number) => [...context.getImageData(Math.round(x * canvas.width / frame.viewport.width), Math.round(y * canvas.height / frame.viewport.height), 1, 1).data];
  return { canvas, context, node, frame, engine, sample };
}

describe('builtin graph spatial renderer extraction', () => {
  it('keeps body fill, circular selection ring and configured alpha on real canvas pixels', async () => {
    const f = await setup(); f.engine.draw({ ...f.frame, selectedNodeIds: ['a'], dimmedNodeIds: ['a'] });
    const center = projectSpatialPoint(f.node.position, f.frame.camera, f.frame.viewport)!;
    const body = f.sample(center.x, center.y);
    const ring = f.sample(center.x + f.node.radius * center.scale + 4, center.y);
    expect(body[0]! > 240 && body[1]! < 10 && body[2]! < 10).to.equal(true);
    expect(body[3]! >= 60 && body[3]! <= 68).to.equal(true);
    expect(ring[2]! > 240 && ring[0]! < 10 && ring[3]! > 0).to.equal(true);
    f.engine.dispose();
  });

  it('renders and hits area-matched square and diamond geometry', async () => {
    const f = await setup(); const center = projectSpatialPoint(f.node.position, f.frame.camera, f.frame.viewport)!;
    const radius = f.node.radius * center.scale;
    const square = { ...f.frame, world: [{ ...f.node, shape: 'square' as const }] };
    f.engine.draw(square);
    expect(f.sample(center.x + radius * 0.8, center.y + radius * 0.8)[3]! > 240).to.equal(true);
    const bounds = f.canvas.getBoundingClientRect();
    expect(f.engine.hit(bounds.left + center.x + radius * 0.8, bounds.top + center.y + radius * 0.8, square)?.id).to.equal('a');
    const diamond = { ...f.frame, world: [{ ...f.node, shape: 'diamond' as const }] };
    f.engine.draw(diamond);
    expect(f.sample(center.x + radius * 0.7, center.y + radius * 0.7)[3]).to.equal(0);
    expect(f.sample(center.x + radius * 1.1, center.y)[3]! > 240).to.equal(true);
    expect(f.engine.hit(bounds.left + center.x + radius * 0.7, bounds.top + center.y + radius * 0.7, diamond)?.id).to.equal(undefined);
    f.engine.dispose();
  });

  it('retains painted dangling stubs while excluding dangling and zero-width links from picking', async () => {
    const f = await setup(); const edge = { source: 'a', target: 'missing' };
    const frame = { ...f.frame, edges: [edge], paint: { ...f.frame.paint, visibleEdges: new Set([graphLinkIdentity(edge)]), edges: new Map([[graphLinkIdentity(edge), '#ffffff']]) } };
    f.engine.draw(frame);
    const endpoint = projectSpatialPoint({ x: 28, y: -28, z: 0 }, frame.camera, frame.viewport)!;
    const bounds = f.canvas.getBoundingClientRect();
    expect(f.engine.hit(bounds.left + endpoint.x, bounds.top + endpoint.y, frame)?.kind).to.equal(undefined);
    let painted = false;
    for (let t = 0.78; t <= 1; t += 0.02) {
      const point = projectSpatialPoint({ x: 28 * t, y: -28 * t, z: 0 }, frame.camera, frame.viewport)!;
      const sample = f.sample(point.x, point.y);
      if (sample[0]! > 200 && sample[1]! > 200 && sample[2]! > 200 && sample[3]! > 0) painted = true;
    }
    expect(painted).to.equal(true);
    const real = { source: 'a', target: 'b', width: 0 };
    const other: SpatialWorldNode = { ...f.node, node: { id: 'b' }, position: { x: 100, y: 0, z: 0 } };
    const zero = { ...frame, world: [f.node, other], edges: [real], paint: { ...frame.paint, visibleEdges: new Set([graphLinkIdentity(real)]) } };
    const middle = projectSpatialPoint({ x: 50, y: 0, z: 0 }, zero.camera, zero.viewport)!;
    expect(f.engine.hit(bounds.left + middle.x, bounds.top + middle.y, zero)?.kind).to.equal(undefined);
    f.engine.dispose();
  });

  it('refreshes projection for camera and visibility changes, including hits before drawing', async () => {
    const f = await setup(); const bounds = f.canvas.getBoundingClientRect();
    expect(f.engine.hit(bounds.left + 160, bounds.top + 120, f.frame)?.id).to.equal('a');
    const shifted = { ...f.frame, camera: { ...f.frame.camera, target: { x: 100, y: 0, z: 0 } } };
    expect(f.engine.hit(bounds.left + 160, bounds.top + 120, shifted)?.id).to.equal(undefined);
    expect(f.engine.hit(bounds.left + 160, bounds.top + 120, { ...f.frame, world: [] })?.id).to.equal(undefined);
    f.engine.invalidate();
    expect(f.engine.hit(bounds.left + 160, bounds.top + 120, f.frame)?.id).to.equal('a');
    f.engine.dispose(); f.engine.dispose();
    expect(f.engine.hit(bounds.left + 160, bounds.top + 120, f.frame)?.id).to.equal(undefined);
    const before = [...f.context.getImageData(0, 0, 1, 1).data]; f.engine.draw(f.frame);
    expect([...f.context.getImageData(0, 0, 1, 1).data]).to.deep.equal(before);
  });
});
