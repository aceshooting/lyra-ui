import { expect, fixture, html } from '@open-wc/testing';
import './flow-minimap.js';
import '../flow-canvas/flow-canvas.js';
import type { LyraFlowCanvas, FlowNode } from '../flow-canvas/flow-canvas.js';
import type { LyraFlowMinimap } from './flow-minimap.js';

const nodes: FlowNode[] = [
  { id: 'a', position: { x: 0, y: 0 } },
  { id: 'b', position: { x: 300, y: 200 } },
];

it('ends an active viewport drag when the canvas becomes readonly', async () => {
  const canvas = await fixture<LyraFlowCanvas>(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `);
  canvas.nodes = nodes;
  await canvas.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const minimap = canvas.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const hitArea = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as SVGElement;
  const captureDescriptor = Object.getOwnPropertyDescriptor(hitArea, 'setPointerCapture');
  (hitArea as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
  const start = { ...canvas.viewport };

  try {
    hitArea.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 19,
      clientX: 10,
      clientY: 10,
    }));
    window.dispatchEvent(new PointerEvent('pointermove', {
      pointerId: 19,
      clientX: 40,
      clientY: 40,
    }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await canvas.updateComplete;
    const activeDragViewport = { ...canvas.viewport };
    expect(activeDragViewport).not.to.deep.equal(start);

    canvas.readonly = true;
    window.dispatchEvent(new PointerEvent('pointermove', {
      pointerId: 19,
      clientX: 40,
      clientY: 40,
    }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await canvas.updateComplete;
    expect(canvas.viewport).to.deep.equal(activeDragViewport);

    canvas.readonly = false;
    window.dispatchEvent(new PointerEvent('pointermove', {
      pointerId: 19,
      clientX: 80,
      clientY: 80,
    }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await canvas.updateComplete;

    expect(canvas.viewport).to.deep.equal(activeDragViewport);
  } finally {
    try {
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 19 }));
    } finally {
      if (captureDescriptor) Object.defineProperty(hitArea, 'setPointerCapture', captureDescriptor);
      else delete (hitArea as unknown as { setPointerCapture?: () => void }).setPointerCapture;
    }
  }
});
