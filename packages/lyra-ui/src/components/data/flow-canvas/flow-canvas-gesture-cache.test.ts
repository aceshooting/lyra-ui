import { expect, fixture, html } from '@open-wc/testing';
import './flow-canvas.js';
import type { LyraFlowCanvas } from './flow-canvas.js';

for (const end of ['pointerup', 'pointercancel']) it(`restores the RTL edge-label mirror after ${end}`, async () => {
  const canvas = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas dir="rtl" orientation="horizontal" nodes-draggable style="width:600px;height:300px"
    .nodes=${[{ id: 'a', position: { x: 0, y: 0 } }, { id: 'b', position: { x: 300, y: 0 } }]}
    .edges=${[{ id: 'edge', source: 'a', target: 'b', label: 'Readable' }]}></lr-flow-canvas>`);
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  canvas.setViewport({ x: 0, y: 0, zoom: 1 }); await canvas.updateComplete;
  const wrapper = canvas.shadowRoot!.querySelector<HTMLElement>('[data-node-id="a"]')!;
  const label = canvas.shadowRoot!.querySelector<SVGTextElement>('[part="edge-label"]')!;
  const transform = label.getAttribute('transform'), x = label.getAttribute('x');
  expect(transform).not.to.equal(null);
  const capture = wrapper.setPointerCapture; wrapper.setPointerCapture = () => {};
  try {
    wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: -40, clientY: 0 }));
    expect(label.getAttribute('x')).not.to.equal(x);
    window.dispatchEvent(new PointerEvent(end, { pointerId: 7, clientX: -40, clientY: 0 }));
    await canvas.updateComplete;
    expect(label.getAttribute('x')).to.equal(x);
    expect(label.getAttribute('transform')).to.equal(transform);
    const matrix = label.getScreenCTM()!;
    expect(matrix.a * matrix.d - matrix.b * matrix.c).to.be.greaterThan(0);
  } finally { wrapper.setPointerCapture = capture; }
});
