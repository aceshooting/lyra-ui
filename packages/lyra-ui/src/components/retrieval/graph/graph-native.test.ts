import { aTimeout, expect, fixture, oneEvent, waitUntil } from '@open-wc/testing';
import { sendMouse, resetMouse } from '../../../../test/wtr-mouse.js';
import { requireWebgl2 } from '../../../../test/native-3d-ui.js';
import { LyraGraph } from './graph.js';
import type { LyraGraphCamera, LyraGraphNode } from './graph-model.js';
void LyraGraph;

const home = (): LyraGraphCamera => ({ yaw: 0, pitch: 0, distance: 400, target: { x: 0, y: 0, z: 0 } });
const nodes = (prefix: string): LyraGraphNode[] => [
  { id: `${prefix}-left`, label: 'Left native label', color: '#ff0000', radius: 18, position: { x: -70, y: 0, z: 0 } },
  { id: `${prefix}-right`, label: 'Right native label', color: '#ff0000', radius: 18, position: { x: 70, y: 0, z: 0 } },
];
async function graph(prefix = 'ordinary', webgl = true): Promise<LyraGraph> {
  const el = document.createElement('lr-graph') as LyraGraph;
  el.style.cssText = 'display:block;inline-size:480px;block-size:360px;--lr-graph-cat-1:rgb(255,0,0);--lr-graph-cat-2:rgb(255,0,0);--lr-graph-cat-3:rgb(0,0,255)';
  el.width = 480; el.height = 360; el.view = '3d';
  if (webgl) el.engine = 'webgl';
  el.camera = home(); el.nodes = nodes(prefix); el.nodeLabels = 'none';
  el.edges = [{ id: `${prefix}-edge`, source: `${prefix}-left`, target: `${prefix}-right`, color: '#0000ff', width: 4 }];
  return fixture(el);
}
async function ready(el: LyraGraph): Promise<HTMLCanvasElement> {
  await waitUntil(() => {
    const surface = el.shadowRoot!.querySelector<HTMLElement>('[data-webgl-host]');
    const canvas = surface?.querySelector<HTMLCanvasElement>('canvas:not([data-graph-labels])');
    return !!surface && !surface.hidden && !!canvas && canvas.width > 0 && canvas.getBoundingClientRect().width > 0 && canvas.getContext('webgl2') !== null;
  }, 'Actual graph companion did not mount a visible WebGL canvas', { timeout: 15000 });
  return el.shadowRoot!.querySelector<HTMLCanvasElement>('[data-webgl-host] canvas:not([data-graph-labels])')!;
}
/** A fresh public camera object schedules a frame without touching the engine or GL state. */
async function capture(el: LyraGraph, canvas: HTMLCanvasElement): Promise<Uint8Array> {
  el.camera = { ...el.camera!, target: { ...el.camera!.target } }; await el.updateComplete;
  return new Promise(resolve => requestAnimationFrame(() => {
    const gl = canvas.getContext('webgl2')!;
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    resolve(pixels);
  }));
}
function screen(el: LyraGraph, id: string): { x: number; y: number } {
  const point = el.getNodeScreenPosition(id); expect(point !== undefined).to.equal(true); return point!;
}
function redAt(el: LyraGraph, canvas: HTMLCanvasElement, pixels: Uint8Array, point: { x: number; y: number }): boolean {
  const host = el.getBoundingClientRect(), box = canvas.getBoundingClientRect();
  const x = Math.round((host.left + point.x - box.left) * canvas.width / box.width);
  const y = Math.round(canvas.height - 1 - (host.top + point.y - box.top) * canvas.height / box.height);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (x + dx < 0 || x + dx >= canvas.width || y + dy < 0 || y + dy >= canvas.height) continue;
    const offset = ((y + dy) * canvas.width + x + dx) * 4;
    if (pixels[offset]! > 200 && pixels[offset + 1]! < 60 && pixels[offset + 2]! < 60 && pixels[offset + 3]! > 200) return true;
  }
  return false;
}
async function click(el: LyraGraph, point: { x: number; y: number }): Promise<void> {
  const box = el.getBoundingClientRect();
  const position: [number, number] = [Math.round(box.left + point.x), Math.round(box.top + point.y)];
  await sendMouse({ type: 'move', position }); await aTimeout(40);
  await sendMouse({ type: 'click', position });
}
async function pick(el: LyraGraph, id: string): Promise<void> {
  const event = oneEvent(el, 'lr-node-activate'); await click(el, screen(el, id));
  expect((await event).detail.nodeId).to.equal(id);
}
function labelPixels(el: LyraGraph): number {
  const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('[data-graph-labels]')!;
  const rgba = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  let count = 0; for (let i = 3; i < rgba.length; i += 4) if (rgba[i]! > 0) count++;
  return count;
}

describe('lr-graph actual optional companion binding', function () {
  this.timeout(30000);
  before(requireWebgl2);
  afterEach(resetMouse);

  it('G01 preserves builtin default then paints and picks ordinary nodes through the native companion', async () => {
    const el = await graph('ordinary', false);
    expect(el.engine).to.equal('builtin');
    expect(el.shadowRoot!.querySelectorAll('[data-webgl-host] canvas').length).to.equal(0);
    el.engine = 'webgl'; const canvas = await ready(el);
    expect(redAt(el, canvas, await capture(el, canvas), screen(el, 'ordinary-left'))).to.equal(true);
    const event = oneEvent(el, 'lr-node-activate'); await click(el, screen(el, 'ordinary-left'));
    expect((await event).detail).to.deep.equal({ nodeId: 'ordinary-left', x: -70, y: 0, z: 0 });
    expect(el.getNodePosition3d('ordinary-left')).to.deep.equal({ x: -70, y: 0, z: 0 });
  });

  it('G02 keeps typed node and original edge identities after category filtering compacts renderer rows', async () => {
    const el = await graph(); await ready(el);
    const columns = { ids: ['hidden', 'keep-left', 'keep-right'], labels: ['Hidden', 'Left', 'Right'],
      x: new Float32Array([0, -70, 70]), y: new Float32Array([70, 0, 0]), z: new Float32Array(3),
      size: new Float32Array([36, 36, 36]), category: new Uint16Array([0, 1, 1]), categories: ['excluded', 'kept', 'links'], edgeCategory: new Uint16Array([2, 2]),
      source: new Uint32Array([0, 1]), target: new Uint32Array([1, 2]) };
    el.graphColumns = columns; await el.updateComplete; const canvas = await ready(el);
    expect(el.getNodePosition3d('ordinary-left')).to.equal(undefined);
    expect(redAt(el, canvas, await capture(el, canvas), screen(el, 'keep-left'))).to.equal(true);
    const hiddenPosition = screen(el, 'hidden');
    el.hiddenTypes = ['excluded']; await el.updateComplete;
    const filteredPixels = await capture(el, canvas);
    expect(redAt(el, canvas, filteredPixels, hiddenPosition)).to.equal(false);
    expect(el.getNodePosition3d('hidden')).to.equal(undefined);
    await pick(el, 'keep-right');
    const left = screen(el, 'keep-left'), right = screen(el, 'keep-right');
    const edge = oneEvent(el, 'lr-edge-activate'); await click(el, { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 });
    expect((await edge).detail).to.deep.equal({ sourceNodeId: 'keep-left', targetNodeId: 'keep-right', edgeId: 'column-edge-1' });
    expect(Array.from(columns.source)).to.deep.equal([0, 1]); expect(Array.from(columns.x)).to.deep.equal([0, -70, 70]);
    expect(columns.ids).to.deep.equal(['hidden', 'keep-left', 'keep-right']);
  });

  it('G03 binds authored camera and ordinary label paint while preserving silent writes and toolbar events', async () => {
    const el = await graph(); const canvas = await ready(el);
    let cameraEvents = 0; el.addEventListener('lr-camera-change', () => { cameraEvents++; });
    const initial = screen(el, 'ordinary-left');
    el.nodeLabels = 'always'; el.camera = { ...home(), target: { x: 45, y: 0, z: 0 } };
    const pixels = await capture(el, canvas); const moved = screen(el, 'ordinary-left');
    expect(Math.abs(moved.x - initial.x)).to.be.greaterThan(15);
    expect(redAt(el, canvas, pixels, moved)).to.equal(true);
    await waitUntil(() => labelPixels(el) > 20, 'Ordinary labels must be painted by the component overlay');
    expect(cameraEvents).to.equal(0);
    el.nodeLabels = 'none'; await el.updateComplete;
    await waitUntil(() => labelPixels(el) === 0, 'Suppressed labels must clear their pixels');
    expect(await ready(el) === canvas).to.equal(true);
    const control = el.shadowRoot!.querySelector<HTMLElement>('[data-spatial-action="zoom-in"]')!;
    const box = control.getBoundingClientRect(), host = el.getBoundingClientRect();
    const event = oneEvent(el, 'lr-camera-change');
    await click(el, { x: box.left - host.left + box.width / 2, y: box.top - host.top + box.height / 2 });
    expect((await event).detail.camera.distance).to.be.lessThan(400);
    expect(cameraEvents).to.equal(1);
  });

  it('G04 restores native context with the latest authored camera and stable node picking', async () => {
    const el = await graph(); const canvas = await ready(el);
    expect(redAt(el, canvas, await capture(el, canvas), screen(el, 'ordinary-left'))).to.equal(true);
    const initial = screen(el, 'ordinary-left');
    const gl = canvas.getContext('webgl2')!, extension = gl.getExtension('WEBGL_lose_context');
    expect(extension !== null).to.equal(true);
    const lost = oneEvent(el, 'lr-engine-fallback'); extension!.loseContext();
    expect((await lost).detail.reason).to.equal('context-lost');
    let cameraEvents = 0; el.addEventListener('lr-camera-change', () => { cameraEvents++; });
    el.camera = { ...home(), target: { x: 45, y: 0, z: 0 } }; await el.updateComplete;
    // wait-reason: give the native renderer real frames to present before sampling its output
    const restored = oneEvent(canvas, 'webglcontextrestored'); await aTimeout(100); extension!.restoreContext(); await restored;
    expect(await ready(el) === canvas).to.equal(true);
    // Check restored projection before the redraw write, so it cannot repair a stale camera.
    const moved = screen(el, 'ordinary-left');
    expect(Math.abs(moved.x - initial.x)).to.be.greaterThan(15);
    const pixels = await capture(el, canvas);
    expect(redAt(el, canvas, pixels, moved)).to.equal(true); expect(cameraEvents).to.equal(0);
    await pick(el, 'ordinary-right');
  });

  it('G05 retires replaced and disconnected surfaces and picks only current identities after reconnect', async () => {
    const el = await graph('old'); const first = await ready(el);
    el.nodes = nodes('new'); el.edges = []; await el.updateComplete;
    const current = await ready(el); await capture(el, current);
    expect(el.getNodePosition3d('old-left')).to.equal(undefined); await pick(el, 'new-left');
    el.view = 'list'; await el.updateComplete;
    expect(first.isConnected).to.equal(false); expect(current.isConnected).to.equal(false);
    el.view = '3d'; const second = await ready(el);
    expect(second === current).to.equal(false);
    const parent = el.parentNode!; el.remove();
    expect(second.isConnected).to.equal(false);
    el.nodes = nodes('reconnected'); parent.append(el); await el.updateComplete;
    const third = await ready(el); expect(third === second).to.equal(false);
    expect(redAt(el, third, await capture(el, third), screen(el, 'reconnected-left'))).to.equal(true);
    expect(el.getNodePosition3d('new-left')).to.equal(undefined); await pick(el, 'reconnected-right');
  });
});
