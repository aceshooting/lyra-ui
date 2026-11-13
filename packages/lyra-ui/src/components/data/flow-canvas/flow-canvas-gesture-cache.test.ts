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

for (const orientation of ['horizontal', 'vertical'] as const) {
  for (const end of ['pointerup', 'pointercancel'] as const) {
    it(`keeps every incident ${orientation} edge attached while dragging its middle node through ${end}`, async () => {
      const canvas = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas orientation=${orientation} nodes-draggable
        .grid=${0} style="width:800px;height:500px"
        .nodes=${[
          { id: 'a', position: { x: 0, y: 0 } },
          { id: 'b', position: { x: 240, y: 100 }, inputs: [{ id: 'first' }, { id: 'second' }], outputs: [{ id: 'first' }, { id: 'second' }] },
          { id: 'c', position: { x: 500, y: 200 } },
        ]}
        .edges=${[
          { id: 'incoming', source: 'a', target: 'b', targetHandle: 'second', label: 'Incoming' },
          { id: 'outgoing', source: 'b', target: 'c', sourceHandle: 'first', label: 'Outgoing' },
          { id: 'loop', source: 'b', target: 'b', sourceHandle: 'second', targetHandle: 'first', label: 'Loop' },
          { id: 'independent', source: 'a', target: 'c' },
        ]}></lr-flow-canvas>`);
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      canvas.setViewport({ x: 0, y: 0, zoom: 1 });
      await canvas.updateComplete;
      const wrapper = canvas.shadowRoot!.querySelector<HTMLElement>('[data-node-id="b"]')!;
      const edges = ['incoming', 'outgoing', 'loop', 'independent'].map(id => {
        const group = canvas.shadowRoot!.querySelector(`[data-edge-id="${id}"]`)!;
        const path = group.querySelector<SVGPathElement>('[part="edge"]')!;
        const start = path.getPointAtLength(0), finish = path.getPointAtLength(path.getTotalLength());
        return { id, path, before: path.getAttribute('d'), start: { x: start.x, y: start.y }, finish: { x: finish.x, y: finish.y },
          label: group.querySelector<SVGTextElement>('[part="edge-label"]') };
      });
      const moves: unknown[] = [];
      canvas.addEventListener('lr-node-move', event => { moves.push(event.detail); });
      const capture = wrapper.setPointerCapture;
      wrapper.setPointerCapture = () => {};
      try {
        wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 71, clientX: 100, clientY: 100, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 72, clientX: 300, clientY: 300 }));
        window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 72 }));
        expect(edges.map(edge => edge.path.getAttribute('d'))).to.deep.equal(edges.map(edge => edge.before));
        expect(moves.length).to.equal(0);
        window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 71, clientX: 132, clientY: 124 }));
        for (const edge of edges) {
          const start = edge.path.getPointAtLength(0), finish = edge.path.getPointAtLength(edge.path.getTotalLength());
          const sourceMoved = edge.id === 'outgoing' || edge.id === 'loop';
          const targetMoved = edge.id === 'incoming' || edge.id === 'loop';
          expect(start.x).to.be.closeTo(edge.start.x + (sourceMoved ? 32 : 0), 0.01);
          expect(start.y).to.be.closeTo(edge.start.y + (sourceMoved ? 24 : 0), 0.01);
          expect(finish.x).to.be.closeTo(edge.finish.x + (targetMoved ? 32 : 0), 0.01);
          expect(finish.y).to.be.closeTo(edge.finish.y + (targetMoved ? 24 : 0), 0.01);
          if (edge.label) {
            expect(Number(edge.label.getAttribute('x'))).to.be.closeTo((start.x + finish.x) / 2, 0.01);
            expect(Number(edge.label.getAttribute('y'))).to.be.closeTo((start.y + finish.y) / 2, 0.01);
          }
        }
        window.dispatchEvent(new PointerEvent(end, { pointerId: 71 }));
        await canvas.updateComplete;
        expect(edges.map(edge => edge.path.getAttribute('d'))).to.deep.equal(edges.map(edge => edge.before));
        expect(canvas.nodes[1]!.position).to.deep.equal({ x: 240, y: 100 });
        expect(moves).to.deep.equal(end === 'pointerup'
          ? [{ nodeId: 'b', previous: { x: 240, y: 100 }, position: { x: 272, y: 124 } }] : []);
      } finally {
        window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 71 }));
        wrapper.setPointerCapture = capture;
      }
    });
  }
}
