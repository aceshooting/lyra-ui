import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraGraph } from './graph.js';
import { countCalls, recordScaleMeasurement } from '../../../../test/scale-budgets.js';
void LyraGraph;

it('coalesces drag geometry reads and uses the latest canvas bounds', async () => {
  const graph = await fixture<LyraGraph>(html`<lr-graph renderer="canvas" .nodes=${[{ id: 'a' }]}></lr-graph>`);
  await waitUntil(() => graph.shadowRoot!.querySelector('canvas') !== null, 'canvas ready', { timeout: 10000 });
  const work = graph as unknown as { canvasDragNode?: { id: string }; canvasPointerId?: number; simNodes: { id: string; fx?: number; fy?: number }[]; simulation?: { stop(): void } };
  work.simulation?.stop(); work.canvasDragNode = work.simNodes[0]; work.canvasPointerId = 1;
  const canvas = graph.shadowRoot!.querySelector('canvas')!;
  const nativeBounds = canvas.getBoundingClientRect;
  let left = 0;
  canvas.getBoundingClientRect = () => new DOMRect(left, 0, 400, 300);
  const reads = countCalls(canvas, 'getBoundingClientRect');
  const nativeFrame = window.requestAnimationFrame, nativeCancel = window.cancelAnimationFrame;
  const frames = new Map<number, FrameRequestCallback>(); let id = 0;
  window.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
  window.cancelAnimationFrame = handle => { frames.delete(handle); };
  try {
    for (let i = 0; i < 20; i++) canvas.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 + i, clientY: 50 }));
    expect(reads.calls).to.equal(0);
    left = 30;
    const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(performance.now());
    recordScaleMeasurement('lr-graph', 'burst of20 canvas drag moves', { reads: reads.calls });
    expect(reads.calls).to.equal(1);
    expect(work.simNodes[0]!.fx).to.equal(89);
  } finally { reads.restore(); canvas.getBoundingClientRect = nativeBounds; window.requestAnimationFrame = nativeFrame; window.cancelAnimationFrame = nativeCancel; }
});
