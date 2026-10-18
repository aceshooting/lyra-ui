import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
import { LyraGraph } from './graph.js';
import { countCalls, recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import type { SpatialScene } from './graph-spatial.js';
void LyraGraph;
interface SpatialWork { hit(x: number, y: number): unknown; projectedScene(): SpatialScene; }

it('coalesces a burst of 3D hover work at n=10000 and cancels it on disconnect', async () => {
  const graph = await fixture<LyraGraph>(html`<lr-graph view="3d" .nodes=${Array.from({ length: 10000 }, (_, i) => ({ id: `n${i}` }))}></lr-graph>`);
  await nextFrame();
  const canvas = graph.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!;
  const work = (graph as unknown as { spatial: SpatialWork }).spatial;
  const hit = countCalls(work, 'hit');
  const nativeFrame = window.requestAnimationFrame;
  const nativeCancel = window.cancelAnimationFrame;
  const frames = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  window.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence; };
  window.cancelAnimationFrame = id => { frames.delete(id); };
  try {
    for (let i = 0; i < 20; i++) canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: i, clientY: 20 }));
    expect(hit.calls).to.equal(0);
    const pending = [...frames.values()]; frames.clear();
    for (const callback of pending) callback(performance.now());
    recordScaleMeasurement('lr-graph', 'n=10000 burst of20 spatial pointer moves', { hits: hit.calls });
    expect(hit.calls).to.equal(1);
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 30, clientY: 20 }));
    const obsolete = [...frames.values()]; graph.remove();
    for (const callback of obsolete) callback(performance.now());
    expect(hit.calls).to.equal(1);
  } finally { window.requestAnimationFrame = nativeFrame; window.cancelAnimationFrame = nativeCancel; hit.restore(); }
});

it('picks from nearby projected candidates rather than all n=10000 nodes', async () => {
  const graph = await fixture<LyraGraph>(html`<lr-graph view="3d" .nodes=${Array.from({ length: 10000 }, (_, i) => ({ id: `n${i}` }))}></lr-graph>`);
  await nextFrame();
  const work = (graph as unknown as { spatial: SpatialWork }).spatial;
  const scene = work.projectedScene();
  let visited = 0;
  for (const node of scene.nodes) {
    const x = node.x;
    Object.defineProperty(node, 'x', { configurable: true, get() { visited++; return x; } });
  }
  const canvas = graph.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!;
  const bounds = canvas.getBoundingClientRect();
  work.hit(bounds.left + 1, bounds.top + 1);
  recordScaleMeasurement('lr-graph', 'n=10000 spatial indexed hit', { visited, retained: scene.nodes.length });
  expect(visited).to.be.lessThan(scene.nodes.length / 2);
});

it('retains spatial paint on selection and zoom-bound updates and avoids per-node canvas saves at n=10000', async () => {
  const graph = await fixture<LyraGraph>(html`<lr-graph view="3d" .nodes=${Array.from({ length: 10000 }, (_, i) => ({ id: `n${i}` }))}></lr-graph>`);
  await nextFrame();
  const work = (graph as unknown as { spatial: SpatialWork & { draw(): void; options: { paint(...args: unknown[]): unknown } } }).spatial;
  const paint = countCalls(work.options, 'paint');
  const canvas = graph.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!;
  const saves = countCalls(canvas.getContext('2d')!, 'save');
  try {
    graph.selectedNodeIds = ['n0']; graph.minZoom = 0.2; await graph.updateComplete;
    work.draw();
    recordScaleMeasurement('lr-graph', 'n=10000 spatial selection paint', { paintBuilds: paint.calls, saves: saves.calls });
    expect(paint.calls).to.equal(0);
    expect(saves.calls).to.be.at.most(1);
  } finally { paint.restore(); saves.restore(); }
});

it('culls projected marks outside the spatial viewport at n=10000', async () => {
  const graph = await fixture<LyraGraph>(html`<lr-graph view="3d" node-labels="none" .nodes=${Array.from({ length: 10000 }, (_, i) => ({ id: `n${i}` }))}></lr-graph>`);
  await nextFrame();
  const work = (graph as unknown as { spatial: { draw(): void; drawNode(...args: unknown[]): void } }).spatial;
  const marks = countCalls(work, 'drawNode');
  try {
    graph.camera = { yaw: 0, pitch: 0, distance: 500, target: { x: 1000000, y: 0, z: 0 } };
    await graph.updateComplete;
    work.draw();
    recordScaleMeasurement('lr-graph', 'n=10000 spatial offscreen paint', { marks: marks.calls });
    expect(marks.calls).to.equal(0);
  } finally { marks.restore(); }
});

it('batches consecutive spatial edges with matching paint at n=10000 edges', async () => {
  const graph = await fixture<LyraGraph>(html`<lr-graph view="3d" node-labels="none"
    .nodes=${[{ id: 'a', position: { x: -30, y: 0, z: 0 } }, { id: 'b', position: { x: 30, y: 0, z: 0 } }]}
    .edges=${Array.from({ length: 10000 }, (_, i) => ({ id: `e${i}`, source: 'a', target: 'b' }))}></lr-graph>`);
  await nextFrame();
  const context = graph.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!.getContext('2d')!;
  const strokes = countCalls(context, 'stroke');
  try {
    (graph as unknown as { spatial: { draw(): void } }).spatial.draw();
    recordScaleMeasurement('lr-graph', 'n=10000 spatial same-style edges', { strokes: strokes.calls });
    expect(strokes.calls).to.be.at.most(2);
  } finally { strokes.restore(); }
});

it('reuses admitted dash patterns across spatial frames at n=10000 edges', async () => {
  (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings?.add(collectionTruncationWarningKey('lr-graph', 'edges'));
  const graph = await fixture<LyraGraph>(html`<lr-graph view="3d" node-labels="none"
    .nodes=${[{ id: 'a', position: { x: -30, y: 0, z: 0 } }, { id: 'b', position: { x: 30, y: 0, z: 0 } }]}
    .edges=${Array.from({ length: 10000 }, (_, i) => ({ id: `e${i}`, source: 'a', target: 'b', dash: [4, 2] }))}></lr-graph>`);
  await nextFrame();
  const work = (graph as unknown as { spatial: { draw(): void } }).spatial;
  const context = graph.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!.getContext('2d')!;
  const original = context.setLineDash;
  const retained = new Set<number[]>();
  let first = true, copies = 0;
  context.setLineDash = function (segments: number[]) {
    if (segments.length) {
      if (first) retained.add(segments); else if (!retained.has(segments)) copies++;
    }
    original.call(this, segments);
  };
  try {
    work.draw(); first = false; work.draw();
    recordScaleMeasurement('lr-graph', 'n=10000 spatial dash reuse', { copies, retained: graph.edges.length });
    expect(copies).to.equal(0);
  } finally { context.setLineDash = original; }
});

it('does not rescan an unchanged spatial visibility set per frame', async () => {
  const graph = await fixture<LyraGraph>(html`<lr-graph view="3d" .nodes=${[{ id: 'a' }, { id: 'b' }]} .edges=${[{ source: 'a', target: 'b' }]}></lr-graph>`);
  await nextFrame();
  const work = (graph as unknown as { spatial: SpatialWork & { paint: { visibleEdges: Set<string> } } }).spatial;
  work.projectedScene();
  const scans = countCalls(work.paint.visibleEdges, Symbol.iterator);
  try {
    work.projectedScene(); work.projectedScene();
    expect(scans.calls).to.equal(0);
  } finally { scans.restore(); }
});
