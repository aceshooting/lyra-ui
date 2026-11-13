import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse, sendMouse, sendWheel, settlePointer } from '../../../../test/wtr-mouse.js';
import { FLOW_PALETTE_MIME_TYPE, type LyraFlowCanvas } from './flow-canvas.js';
import './flow-canvas.js';

async function canvas(direction: 'ltr' | 'rtl' = 'ltr') {
  const wrapper = await fixture<HTMLDivElement>(html`<div dir=${direction}>
    <lr-flow-canvas orientation="horizontal" style="inline-size:400px;block-size:300px"></lr-flow-canvas>
  </div>`);
  const host = wrapper.querySelector<LyraFlowCanvas>('lr-flow-canvas')!;
  await host.updateComplete;
  await nextFrame();
  await nextFrame();
  return host;
}

afterEach(async () => { await resetMouse(); });

for (const direction of ['ltr', 'rtl'] as const) {
  it(`zooms out around the native wheel position in ${direction}`, async () => {
    const host = await canvas(direction);
    host.setViewport({ x: 10, y: 20, zoom: 1.2 });
    await nextFrame();
    const surface = host.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
    const bounds = surface.getBoundingClientRect();
    const x = Math.round(bounds.left + 120), y = Math.round(bounds.top + 80);
    const before = host.toContentPoint(x, y);
    await sendMouse({ type: 'move', position: [x, y] });
    await sendWheel({ deltaX: 0, deltaY: 100 });
    await waitUntil(() => host.viewport.zoom < 1.2, 'the native wheel zooms out');
    const after = host.toContentPoint(x, y);
    expect(after.x).to.be.closeTo(before.x, 0.01);
    expect(after.y).to.be.closeTo(before.y, 0.01);
  });

  it(`nudges a focused node by one unit without grid snapping in ${direction}`, async () => {
    const host = await canvas(direction);
    host.nodesDraggable = true;
    host.grid = 0;
    host.nodes = [{ id: 'a', position: { x: 40, y: 40 } }];
    await host.updateComplete;
    const button = host.shadowRoot!.querySelector<HTMLElement>('[data-node-id="a"] [part="node-control"]')!;
    await focusByKeyboard(button);
    const moves: unknown[] = [];
    host.addEventListener('lr-node-move', event => { moves.push(event.detail); });
    await sendKeys({ press: 'Control+ArrowRight' });
    await waitUntil(() => moves.length === 1);
    expect(moves).to.deep.equal([{
      nodeId: 'a', previous: { x: 40, y: 40 }, position: { x: direction === 'rtl' ? 39 : 41, y: 40 },
    }]);
    expect(host.nodes[0]!.position).to.deep.equal({ x: 40, y: 40 });
  });

  it(`keeps unsnapped drop coordinates in ${direction}`, async () => {
    const host = await canvas(direction);
    host.droppable = true;
    host.grid = 0;
    host.setViewport({ x: 0, y: 0, zoom: 1 });
    await host.updateComplete;
    const surface = host.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
    const bounds = surface.getBoundingClientRect();
    const dataTransfer = new DataTransfer();
    dataTransfer.setData(FLOW_PALETTE_MIME_TYPE, JSON.stringify({ type: 'http-request' }));
    const event = new DragEvent('drop', {
      bubbles: true, cancelable: true, clientX: bounds.left + 21, clientY: bounds.top + 13, dataTransfer,
    });
    const expected = host.toContentPoint(event.clientX, event.clientY);
    const additions: unknown[] = [];
    host.addEventListener('lr-node-add', request => { additions.push(request.detail); });
    surface.dispatchEvent(event);
    expect(event.defaultPrevented).to.equal(true);
    expect(additions).to.deep.equal([{ type: 'http-request', position: expected }]);
    expect(expected.y % 8).not.to.equal(0);
    expect(host.nodes).to.deep.equal([]);
  });
}

it('rejects a native background drag while readonly and pans after enabling', async () => {
  const host = await canvas();
  host.readonly = true;
  await host.updateComplete;
  const surface = host.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
  const before = { ...host.viewport };
  let changes = 0;
  host.addEventListener('lr-viewport-change', () => { changes++; });
  const drag = async () => {
    await hoverUntilMatched(surface, 'the empty viewport receives the pointer');
    const bounds = surface.getBoundingClientRect();
    const x = Math.round(bounds.left + bounds.width / 2), y = Math.round(bounds.top + bounds.height / 2);
    await sendMouse({ type: 'down' });
    await sendMouse({ type: 'move', position: [x + 30, y + 20] });
    await sendMouse({ type: 'up' });
    await settlePointer();
  };
  await drag();
  expect(host.viewport).to.deep.equal(before);
  expect(surface.hasAttribute('data-panning')).to.equal(false);
  expect(changes).to.equal(0);
  host.readonly = false;
  await host.updateComplete;
  await drag();
  await waitUntil(() => host.viewport.x !== before.x);
  expect(host.viewport.x).to.be.closeTo(before.x + 30, 1);
  expect(host.viewport.y).to.be.closeTo(before.y + 20, 1);
  expect(changes).to.be.greaterThan(0);
});
