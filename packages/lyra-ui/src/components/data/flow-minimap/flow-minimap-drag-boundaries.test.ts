import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-flow-canvas.js';
import '../../lr-flow-minimap.js';
import type { LyraFlowMinimap } from '../../lr-flow-minimap.js';
import type { LyraFlowCanvas, FlowNode } from '../../lr-flow-canvas.js';

const nodes: FlowNode[] = [
  { id: 'a', position: { x: 0, y: 0 } },
  { id: 'b', position: { x: 300, y: 200 } },
];

async function mounted(): Promise<{ canvas: LyraFlowCanvas; minimap: LyraFlowMinimap; hit: SVGElement }> {
  const canvas = await fixture<LyraFlowCanvas>(html`
    <lr-flow-canvas style="width:400px;height:300px" .nodes=${nodes}>
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `);
  const minimap = canvas.querySelector<LyraFlowMinimap>('lr-flow-minimap')!;
  await waitUntil(() => minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') !== null, 'viewport rectangle');
  const hit = minimap.shadowRoot!.querySelector<SVGElement>('[part="viewport-hit-area"]')!;
  (hit as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
  return { canvas, minimap, hit };
}

describe('lr-flow-minimap viewport drag boundaries', () => {
  it('ignores moves and releases from a different pointer during a viewport drag', async () => {
    const { canvas, hit } = await mounted();
    const start = { ...canvas.viewport };
    hit.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 11, clientX: 20, clientY: 20, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 12, clientX: 80, clientY: 80 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 12, clientX: 80, clientY: 80 }));
    expect(canvas.viewport).to.deep.equal(start);
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 11, clientX: 30, clientY: 20 }));
    expect(canvas.viewport.x, 'the owning pointer still pans').to.not.equal(start.x);
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 11, clientX: 30, clientY: 20 }));
  });

  it('does not touch the canvas viewport for a pointermove with no displacement', async () => {
    const { canvas, hit } = await mounted();
    const start = { ...canvas.viewport };
    let calls = 0;
    const original = canvas.setViewport;
    canvas.setViewport = function (this: LyraFlowCanvas, ...args: Parameters<LyraFlowCanvas['setViewport']>) {
      calls++;
      return original.apply(this, args);
    };
    try {
      hit.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 13, clientX: 20, clientY: 20, bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 13, clientX: 20, clientY: 20 }));
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 13, clientX: 20, clientY: 20 }));
      expect(calls).to.equal(0);
      expect(canvas.viewport).to.deep.equal(start);
    } finally {
      canvas.setViewport = original;
    }
  });
});
