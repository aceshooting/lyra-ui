import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sinkTexts } from '../../../../test/announcements.js';
import { LyraGraph } from './graph.js';
import { projectSpatialPoint } from './graph-spatial.js';
void LyraGraph;

async function readyGraph(): Promise<LyraGraph> {
  const graph = await fixture<LyraGraph>(html`<lr-graph .nodes=${[{ id: 'a' }]}></lr-graph>`);
  await waitUntil(() => graph.getAttribute('aria-busy') === 'false', 'force ready', { timeout: 10000 });
  return graph;
}

it('recovers the force surface after an optional layered module failure', async () => {
  const graph = await readyGraph();
  (graph as unknown as { loadLayeredLayout(): Promise<never> }).loadLayeredLayout = () => Promise.reject(new Error('unavailable'));
  graph.layout = 'layered'; await graph.updateComplete;
  expect(graph.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
  graph.layout = 'force'; await graph.updateComplete;
  expect(graph.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
  expect(graph.shadowRoot!.querySelector('[part="node"]') !== null).to.equal(true);
});

it('recovers the existing2D dependency after an optional spatial module failure', async () => {
  const graph = await readyGraph();
  (graph as unknown as { loadSpatialController(): Promise<never> }).loadSpatialController = () => Promise.reject(new Error('unavailable'));
  graph.view = '3d'; await graph.updateComplete;
  expect(graph.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
  graph.view = '2d'; await graph.updateComplete;
  expect(graph.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
  expect(graph.shadowRoot!.querySelector('[part="node"]') !== null).to.equal(true);
});

it('announces a spatial module failure through the separate light-DOM sink', async () => {
  const graph = await readyGraph();
  graph.strings = { graphSpatialUnavailable: 'Spatial renderer unavailable' };
  const before = sinkTexts('assertive').filter(text => text === 'Spatial renderer unavailable').length;
  (graph as unknown as { loadSpatialController(): Promise<never> }).loadSpatialController = () => Promise.reject(new Error('unavailable'));
  graph.view = '3d'; await graph.updateComplete;
  expect(graph.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('Spatial renderer unavailable');
  await waitUntil(() => sinkTexts('assertive').filter(text => text === 'Spatial renderer unavailable').length === before + 1, 'separate failure announcement', { timeout: 1000 });
  graph.requestUpdate(); await graph.updateComplete;
  expect(sinkTexts('assertive').filter(text => text === 'Spatial renderer unavailable').length).to.equal(before + 1);
});

for (const z of [0, 40]) it(`anchors a spatial edge label at its actual midpoint with depth difference ${z}`, async () => {
  const camera = { yaw: 0, pitch: 0, distance: 300, target: { x: 0, y: 0, z: 0 } };
  const graph = await fixture<LyraGraph>(html`<lr-graph view="3d" with-edge-labels .camera=${camera}
    .nodes=${[{ id: 'a', position: { x: -50, y: 0, z: 0 } }, { id: 'b', position: { x: 50, y: 0, z } }]}
    .edges=${[{ source: 'a', target: 'b', label: 'edge midpoint' }]}></lr-graph>`);
  await graph.updateComplete;
  const canvas = graph.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!;
  const ctx = canvas.getContext('2d')!;
  const original = ctx.fillText;
  const labels: number[] = [];
  ctx.fillText = function (text, x, y, maxWidth) { if (text === 'edge midpoint') labels.push(x); if (maxWidth === undefined) original.call(this, text, x, y); else original.call(this, text, x, y, maxWidth); };
  try {
    (graph as unknown as { spatial: { draw(): void } }).spatial.draw();
    const expected = projectSpatialPoint({ x: 0, y: 0, z: z / 2 }, camera, { width: canvas.clientWidth, height: canvas.clientHeight })!;
    expect(labels.length).to.equal(1);
    expect(labels[0]).to.be.closeTo(expected.x, 0.001);
  } finally { ctx.fillText = original; }
});

for (const flushed of [false, true]) it(`commits the latest canvas drag position before force release (flushed=${flushed})`, async () => {
  const graph = await readyGraph(); graph.renderer = 'canvas'; await graph.updateComplete;
  type Node = { id: string; x: number; y: number; fx: number | null; fy: number | null };
  const work = graph as unknown as { simulation: { stop(): void; tick(): void }; drawCanvas(): void; canvasScene: { nodes: { x: number; y: number }[] }; simNodes: Node[]; canvasDragNode?: Node; canvasPointerId?: number; flushCanvasDrag(): void; finishCanvasNodeDrag(pointer: number, capture: boolean): void };
  work.simulation.stop();
  const node = work.simNodes[0]!; node.x = 10; node.y = 20; node.fx = 10; node.fy = 20;
  work.canvasDragNode = node; work.canvasPointerId = 7;
  const canvas = graph.shadowRoot!.querySelector('canvas')!;
  const bounds = canvas.getBoundingClientRect;
  canvas.getBoundingClientRect = () => new DOMRect(0, 0, 400, 300);
  try {
    canvas.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 130, clientY: 90 }));
    if (flushed) { work.simulation.tick(); work.flushCanvasDrag(); }
    work.finishCanvasNodeDrag(7, false);
    expect({ x: node.x, y: node.y }).to.deep.equal({ x: 130, y: 90 });
    expect(node.fx).to.equal(null); expect(node.fy).to.equal(null);
    work.drawCanvas();
    expect({ x: work.canvasScene.nodes[0]!.x, y: work.canvasScene.nodes[0]!.y }).to.deep.equal({ x: 130, y: 90 });
  } finally { canvas.getBoundingClientRect = bounds; }
});

it('keeps a real d3 failure visible when changing an optional layout', async () => {
  const graph = new LyraGraph();
  (graph as unknown as { loadLibrary(): Promise<null> }).loadLibrary = () => Promise.resolve(null);
  await fixture(graph);
  await waitUntil(() => graph.shadowRoot!.querySelector('[part="error"]') !== null, 'missing force dependency', { timeout: 10000 });
  graph.layout = 'layered'; await graph.updateComplete;
  graph.layout = 'force'; await graph.updateComplete;
  expect(graph.getAttribute('aria-busy')).to.equal('false');
  expect(graph.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
});

it('drops queued canvas drag movement on disconnect', async () => {
  const graph = await readyGraph(); graph.renderer = 'canvas'; await graph.updateComplete;
  type Node = { id: string; x: number; y: number; fx: number | null; fy: number | null };
  const work = graph as unknown as { simulation: { stop(): void }; simNodes: Node[]; canvasDragNode?: Node; canvasPointerId?: number };
  work.simulation.stop();
  const node = work.simNodes[0]!; node.x = 10; node.y = 20; node.fx = 10; node.fy = 20;
  work.canvasDragNode = node; work.canvasPointerId = 7;
  graph.shadowRoot!.querySelector('canvas')!.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 130, clientY: 90 }));
  graph.remove();
  expect({ x: node.x, y: node.y }).to.deep.equal({ x: 10, y: 20 });
  expect(node.fx).to.equal(null); expect(node.fy).to.equal(null);
});

it('preserves a d3 failure that follows a failed initial layered import', async () => {
  const graph = new LyraGraph(); graph.layout = 'layered';
  (graph as unknown as { loadLibrary(): Promise<null> }).loadLibrary = () => Promise.resolve(null);
  (graph as unknown as { loadLayeredLayout(): Promise<never> }).loadLayeredLayout = () => Promise.reject(new Error('optional unavailable'));
  await fixture(graph);
  await waitUntil(() => graph.shadowRoot!.querySelector('[part="error"]') !== null, 'dependency failure', { timeout: 10000 });
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  graph.layout = 'force'; await graph.updateComplete;
  expect(graph.getAttribute('aria-busy')).to.equal('false');
  expect(graph.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
});

it('loads a healthy spatial renderer after a d3 failure', async () => {
  const graph = new LyraGraph();
  (graph as unknown as { loadLibrary(): Promise<null> }).loadLibrary = () => Promise.resolve(null);
  await fixture(graph);
  await waitUntil(() => graph.shadowRoot!.querySelector('[part="error"]') !== null, 'dependency failure', { timeout: 10000 });
  graph.view = '3d'; await graph.updateComplete;
  expect(graph.shadowRoot!.querySelector('[part="spatial-canvas"]') !== null).to.equal(true);
  expect(graph.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
});

it('preserves a failed spatial dependency when switching between spatial views', async () => {
  const graph = await readyGraph();
  (graph as unknown as { loadSpatialController(): Promise<never> }).loadSpatialController = () => Promise.reject(new Error('unavailable'));
  graph.view = '3d'; await graph.updateComplete;
  expect(graph.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
  graph.view = 'list'; await graph.updateComplete;
  expect(graph.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
  expect(graph.getAttribute('aria-busy')).to.equal('false');
});

it('keeps a pending layered import busy when returning from a spatial view', async () => {
  const graph = await readyGraph();
  graph.view = '3d'; await graph.updateComplete;
  type LayeredModule = typeof import('../../../internal/layered-layout.js');
  let resolve!: (module: LayeredModule) => void;
  (graph as unknown as { loadLayeredLayout(): Promise<LayeredModule> }).loadLayeredLayout =
    () => new Promise(done => { resolve = done; });
  graph.layout = 'layered'; await graph.updateComplete;
  graph.view = '2d'; await Promise.resolve();
  try {
    expect(graph.getAttribute('aria-busy')).to.equal('true');
    expect(graph.shadowRoot!.querySelector('.loading-label') !== null).to.equal(true);
  } finally {
    resolve(await import('../../../internal/layered-layout.js'));
    await graph.updateComplete;
  }
  expect(graph.shadowRoot!.querySelector('[part="node"]') !== null).to.equal(true);
});

it('admits ready d3 independently of a canceled initial layered import', async () => {
  const ready = await readyGraph();
  const modules = (ready as unknown as { d3: unknown }).d3;
  type LayeredModule = typeof import('../../../internal/layered-layout.js');
  let resolve!: (module: LayeredModule) => void;
  const graph = new LyraGraph(); graph.nodes = [{ id: 'a' }]; graph.layout = 'layered';
  (graph as unknown as { loadLibrary(): Promise<unknown> }).loadLibrary = () => Promise.resolve(modules);
  (graph as unknown as { loadLayeredLayout(): Promise<LayeredModule> }).loadLayeredLayout =
    () => new Promise(done => { resolve = done; });
  const host = await fixture<HTMLElement>(html`<div></div>`);
  host.append(graph);
  await waitUntil(() => !!resolve, 'layered import begins');
  await new Promise<void>(done => setTimeout(done, 0));
  expect(graph.getAttribute('aria-busy')).to.equal('true');
  expect(graph.shadowRoot!.querySelector('.loading-label') !== null).to.equal(true);
  graph.layout = 'force'; await graph.updateComplete;
  try {
    await waitUntil(() => graph.shadowRoot!.querySelector('[part="node"]') !== null,
      'force graph must not wait for the obsolete layered import', { timeout: 1000 });
    expect(graph.getAttribute('aria-busy')).to.equal('false');
  } finally {
    resolve(await import('../../../internal/layered-layout.js'));
    await graph.updateComplete;
  }
});
