import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import '../flow-canvas/flow-canvas.js';
import './flow-minimap.js';
import type { LyraFlowMinimap } from './flow-minimap.js';
import type { LyraFlowCanvas, FlowNode } from '../flow-canvas/flow-canvas.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

function sinkElement(doc: Document = document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`);
}

function sinkTexts(doc: Document = document): string[] {
  const sink = sinkElement(doc);
  return sink ? Array.from(sink.children, (child) => child.textContent ?? '') : [];
}

const nodes: FlowNode[] = [
  { id: 'a', position: { x: 0, y: 0 } },
  { id: 'b', position: { x: 300, y: 200 } },
];

it('renders the clickable map hover treatment that matches its pointer affordance', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap
        slot="bottom-end"
        style="--lr-color-brand-quiet: rgb(1, 2, 3)"
      ></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const map = minimap.shadowRoot!.querySelector<SVGSVGElement>('[part="map"]')!;
  const rect = map.getBoundingClientRect();

  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + 4), Math.round(rect.top + 4)],
    });
    await waitUntil(
      () => getComputedStyle(map).backgroundColor === 'rgb(1, 2, 3)',
      'the rendered map hover background never appeared',
    );
  } finally {
    await resetMouse();
  }
});

it('defaults to an empty for/label', async () => {
  const el = (await fixture(html`<lr-flow-minimap></lr-flow-minimap>`)) as LyraFlowMinimap;
  expect(el.for).to.equal('');
  expect(el.label).to.equal('');
});

it('gives a live host aria-label precedence over the label property', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-minimap
        slot="bottom-end"
        label="Overview"
        aria-label="Workflow overview"
      ></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const base = minimap.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('aria-label')).to.equal('Workflow overview');
  minimap.setAttribute('aria-label', 'Changed overview');
  await minimap.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Changed overview');
  minimap.removeAttribute('aria-label');
  await minimap.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Overview');
});

it('renders an inert, aria-hidden frame when no canvas can be resolved', async () => {
  const el = (await fixture(html`<lr-flow-minimap></lr-flow-minimap>`)) as LyraFlowMinimap;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-hidden')).to.equal('true');
});

it('resolves the nearest ancestor lr-flow-canvas when slotted into a corner slot', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  // The companion snapshot is delivered rAF-coalesced (see flow-canvas.test.ts's own
  // "registerCompanion delivers a FlowStructureSnapshot rAF-coalesced" case) -- an explicit frame
  // wait is required here, `updateComplete` alone does not span it.
  await new Promise((r) => requestAnimationFrame(r));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  expect(minimap.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(2);
});

it('resolves a canvas by id via the for attribute', async () => {
  const root = (await fixture(html`
    <div>
      <lr-flow-canvas id="wf"></lr-flow-canvas>
      <lr-flow-minimap for="wf"></lr-flow-minimap>
    </div>
  `)) as HTMLElement;
  const canvas = root.querySelector('lr-flow-canvas') as LyraFlowCanvas;
  canvas.nodes = nodes;
  await canvas.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const minimap = root.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  expect(minimap.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(2);
});

it('adopts a same-id replacement canvas instead of retaining the removed target snapshot', async () => {
  const root = (await fixture(html`
    <div>
      <lr-flow-canvas id="wf"></lr-flow-canvas>
      <lr-flow-minimap for="wf"></lr-flow-minimap>
    </div>
  `)) as HTMLElement;
  const original = root.querySelector('lr-flow-canvas') as LyraFlowCanvas;
  original.nodes = nodes;
  await original.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const minimap = root.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  expect(minimap.shadowRoot!.querySelectorAll('[part="node"]')).to.have.lengthOf(2);

  original.remove();
  const replacement = document.createElement('lr-flow-canvas') as LyraFlowCanvas;
  replacement.id = 'wf';
  replacement.nodes = [nodes[0]!];
  root.prepend(replacement);
  await replacement.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await minimap.updateComplete;
  expect(minimap.shadowRoot!.querySelectorAll('[part="node"]')).to.have.lengthOf(1);
});

it('cancels an active viewport drag before binding a same-id replacement canvas', async () => {
  const root = (await fixture(html`
    <div>
      <lr-flow-canvas id="wf" style="width:400px;height:300px"></lr-flow-canvas>
      <lr-flow-minimap for="wf"></lr-flow-minimap>
    </div>
  `)) as HTMLElement;
  const original = root.querySelector('lr-flow-canvas') as LyraFlowCanvas;
  original.nodes = nodes;
  await original.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const minimap = root.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const hitArea = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as SVGElement;
  (hitArea as unknown as { setPointerCapture(): void }).setPointerCapture = () => {};
  hitArea.dispatchEvent(new PointerEvent('pointerdown', {
    pointerId: 305,
    clientX: 10,
    clientY: 10,
    bubbles: true,
  }));
  expect((minimap as unknown as { dragState?: unknown }).dragState).to.exist;

  original.remove();
  const replacement = document.createElement('lr-flow-canvas') as LyraFlowCanvas;
  replacement.id = 'wf';
  replacement.nodes = nodes;
  let replacementMoves = 0;
  (replacement as unknown as { setViewport: LyraFlowCanvas['setViewport'] }).setViewport = () => {
    replacementMoves++;
  };
  root.prepend(replacement);
  await replacement.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await minimap.updateComplete;

  expect((minimap as unknown as { dragState?: unknown }).dragState).to.equal(undefined);
  expect((minimap as unknown as { dragEventWindow?: Window }).dragEventWindow).to.equal(undefined);
  expect((minimap as unknown as { justDraggedViewport: boolean }).justDraggedViewport).to.be.false;
  expect((minimap as unknown as { announceNextSnapshot: boolean }).announceNextSnapshot).to.be.false;
  window.dispatchEvent(new PointerEvent('pointermove', {
    pointerId: 305,
    clientX: 80,
    clientY: 80,
  }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 305 }));
  expect(replacementMoves).to.equal(0);
});

it('draws no edges, only node rects', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  wrapper.edges = [{ id: 'a-b', source: 'a', target: 'b' }];
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  expect(minimap.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(2);
  expect((minimap.shadowRoot!.querySelector('[part="map"] line, [part="map"] path')) == null).to.be.true;
});

it('node rects inherit decoration status tones', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  wrapper.decorations = { a: { status: 'running' } };
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const rect = minimap.shadowRoot!.querySelector('[part="node"]') as SVGElement;
  expect(rect.getAttribute('data-status')).to.equal('running');
});

it('lets each node status color be rethemed without changing shared semantic tokens', async () => {
  const statusNodes: FlowNode[] = [
    { id: 'pending', position: { x: 0, y: 0 } },
    { id: 'running', position: { x: 100, y: 0 } },
    { id: 'success', position: { x: 200, y: 0 } },
    { id: 'error', position: { x: 300, y: 0 } },
    { id: 'denied', position: { x: 400, y: 0 } },
  ];
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-minimap
        slot="bottom-end"
        style="
          --lr-flow-status-pending-color: rgb(1, 2, 3);
          --lr-flow-status-running-color: rgb(4, 5, 6);
          --lr-flow-status-success-color: rgb(7, 8, 9);
          --lr-flow-status-error-color: rgb(10, 11, 12);
          --lr-flow-status-denied-color: rgb(13, 14, 15);
        "
      ></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = statusNodes;
  wrapper.decorations = Object.fromEntries(
    statusNodes.map((node) => [node.id, { status: node.id }]),
  ) as LyraFlowCanvas['decorations'];
  await wrapper.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;

  const expected = new Map([
    ['pending', 'rgb(1, 2, 3)'],
    ['running', 'rgb(4, 5, 6)'],
    ['success', 'rgb(7, 8, 9)'],
    ['error', 'rgb(10, 11, 12)'],
    ['denied', 'rgb(13, 14, 15)'],
  ]);
  for (const rect of minimap.shadowRoot!.querySelectorAll<SVGElement>('[part="node"]')) {
    expect(getComputedStyle(rect).fill).to.equal(
      expected.get(rect.dataset['status'] ?? '')!
    );
  }
});

it('clicking the map centers the canvas viewport there (calls setViewport)', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const map = minimap.shadowRoot!.querySelector('[part="map"]') as SVGSVGElement;
  let changed = false;
  wrapper.addEventListener('lr-viewport-change', () => (changed = true));
  map.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
  expect(changed).to.be.true;
});

it('wheeling over the map zooms in on scroll-down and out on scroll-up', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const map = minimap.shadowRoot!.querySelector('[part="map"]') as SVGSVGElement;

  const zoomBefore = wrapper.viewport.zoom;
  map.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100 }));
  expect(wrapper.viewport.zoom).to.be.greaterThan(zoomBefore);

  const zoomAfterZoomIn = wrapper.viewport.zoom;
  map.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 }));
  expect(wrapper.viewport.zoom).to.be.lessThan(zoomAfterZoomIn);
});

it('the viewport rect is the single focusable stop; +/-/Enter/Home/arrows drive the canvas', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const rect = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as HTMLElement;
  expect(rect.getAttribute('role')).to.equal('group');
  expect(rect.getAttribute('aria-label')).to.equal('Visible area');
  const instructions = minimap.shadowRoot!.querySelector('[part="instructions"]') as HTMLElement;
  expect(rect.getAttribute('aria-describedby')).to.equal(instructions.id);
  expect(instructions.textContent).to.contain('Arrow keys');
  const zoomBefore = wrapper.viewport.zoom;
  rect.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true }));
  expect(wrapper.viewport.zoom).to.be.greaterThan(zoomBefore);
});

it('the "-" key zooms the canvas out', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const rect = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as HTMLElement;
  const zoomBefore = wrapper.viewport.zoom;
  rect.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true, cancelable: true }));
  expect(wrapper.viewport.zoom).to.be.lessThan(zoomBefore);
});

it('Enter and Home both fit the canvas to its content', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const rect = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as HTMLElement;

  wrapper.setViewport({ x: 0, y: 0, zoom: 1 });
  const before = { ...wrapper.viewport };
  rect.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  expect(wrapper.viewport).to.not.deep.equal(before);

  // Reset so the Home-triggered fit() has somewhere to move from (fit() is idempotent for the same
  // nodes/viewport size, so re-pressing without resetting would land on the same values again).
  wrapper.setViewport({ x: 0, y: 0, zoom: 1 });
  const beforeHome = { ...wrapper.viewport };
  rect.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
  expect(wrapper.viewport).to.not.deep.equal(beforeHome);
});

it('arrow keys pan the canvas viewport in each physical direction', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const rect = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as HTMLElement;

  rect.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  expect(wrapper.viewport.x).to.be.lessThan(0);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await minimap.updateComplete;
  expect(minimap.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.contain('Zoom');

  const rightX = wrapper.viewport.x;
  rect.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  expect(wrapper.viewport.x).to.be.greaterThan(rightX);

  rect.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  expect(wrapper.viewport.y).to.be.lessThan(0);

  rect.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  expect(wrapper.viewport.y).to.be.greaterThan(0);
});

it('announces viewport changes as light-DOM additions and keeps an aria-hidden shadow mirror', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const mirror = minimap.shadowRoot!.querySelector('[part="live-region"]') as HTMLElement;
  const rect = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as HTMLElement;
  expect(sinkTexts(), 'the first companion snapshot must stay silent').to.deep.equal([]);
  expect(mirror.getAttribute('aria-hidden')).to.equal('true');
  expect(mirror.getAttribute('role')).to.equal(null);
  expect(mirror.getAttribute('aria-live')).to.equal(null);

  // Pin a stable viewport after the canvas's initial measurement/layout work. That keeps the
  // right/left/right round trip deterministic while still exercising the public keyboard path.
  wrapper.setViewport({ x: 0, y: 0, zoom: 1 });
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await minimap.updateComplete;

  const press = async (key: string): Promise<void> => {
    rect.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await minimap.updateComplete;
  };
  await press('ArrowRight');
  await press('ArrowLeft');
  await press('ArrowRight');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await minimap.updateComplete;
  const messages = sinkTexts();
  expect(messages).to.have.length(3);
  expect(messages[0]).to.equal(messages[2]);
  expect(mirror.textContent?.trim()).to.equal(messages[2]);

  wrapper.remove();
  expect(sinkElement() === null).to.be.true;
});

it('announces click, wheel, and completed pointer-drag viewport changes', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const map = minimap.shadowRoot!.querySelector('[part="map"]') as SVGSVGElement;
  const viewport = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as SVGElement;
  (viewport as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
  expect(sinkTexts(), 'the initial companion snapshot must stay silent').to.deep.equal([]);

  map.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await minimap.updateComplete;
  expect(sinkTexts(), 'click-to-center must announce the applied viewport').to.have.length(1);

  map.dispatchEvent(
    new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100 }),
  );
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await minimap.updateComplete;
  expect(sinkTexts(), 'wheel zoom must announce the applied viewport').to.have.length(2);

  viewport.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 81,
      clientX: 10,
      clientY: 10,
    }),
  );
  window.dispatchEvent(
    new PointerEvent('pointermove', { pointerId: 81, clientX: 30, clientY: 30 }),
  );
  window.dispatchEvent(
    new PointerEvent('pointerup', { pointerId: 81, clientX: 30, clientY: 30 }),
  );
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await minimap.updateComplete;
  expect(sinkTexts(), 'a completed viewport drag must announce its final viewport').to.have.length(3);
});

it('re-targets its shared sink with the canvas when adopted into another document', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument!;
  const frameWindow = iframe.contentWindow!;

  try {
    frameDocument.body.append(wrapper);
    await new Promise((resolve) => frameWindow.requestAnimationFrame(resolve));
    await minimap.updateComplete;
    const rect = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as HTMLElement;
    rect.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await new Promise((resolve) => frameWindow.requestAnimationFrame(resolve));
    await minimap.updateComplete;

    expect(sinkElement() === null, 'the original document must release both adopted holders').to.be.true;
    expect(sinkTexts(frameDocument)).to.have.length(1);
  } finally {
    wrapper.remove();
    iframe.remove();
  }
});

it('cannot pan the canvas through minimap keyboard controls while locked', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const rect = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as HTMLElement;
  wrapper.locked = true;
  await wrapper.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await minimap.updateComplete;
  const before = { ...wrapper.viewport };

  const base = minimap.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-disabled')).to.equal('true');
  expect(base.hasAttribute('data-locked')).to.be.true;
  expect(rect.getAttribute('tabindex')).to.equal('-1');
  expect(rect.getAttribute('aria-disabled')).to.equal('true');
  expect(rect.hasAttribute('aria-keyshortcuts')).to.be.false;
  expect(getComputedStyle(rect).pointerEvents).to.equal('none');

  rect.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));

  expect(wrapper.viewport).to.deep.equal(before);
});

// `LyraFlowCanvas`'s own setViewport/zoomIn/zoomOut/fit already early-return when `locked` --
// asserting only `wrapper.viewport` stays put would pass even if the minimap never checked
// `locked` itself, because the canvas's own guard would still absorb the call. These tests stub
// out that canvas-side guard (so the calls would visibly go through if made) to prove the minimap
// itself never makes the call while paired with a locked canvas: `FlowCanvasLike` callers must not
// rely solely on the far end being well-behaved.
function stubUnguardedCanvasMethods(wrapper: LyraFlowCanvas): { setViewportCalls: number; zoomInCalls: number; zoomOutCalls: number } {
  const calls = { setViewportCalls: 0, zoomInCalls: 0, zoomOutCalls: 0 };
  (wrapper as unknown as { setViewport: LyraFlowCanvas['setViewport'] }).setViewport = () => {
    calls.setViewportCalls += 1;
  };
  (wrapper as unknown as { zoomIn: LyraFlowCanvas['zoomIn'] }).zoomIn = () => {
    calls.zoomInCalls += 1;
  };
  (wrapper as unknown as { zoomOut: LyraFlowCanvas['zoomOut'] }).zoomOut = () => {
    calls.zoomOutCalls += 1;
  };
  return calls;
}

it('cannot click-to-center a locked canvas through the minimap map', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const map = minimap.shadowRoot!.querySelector('[part="map"]') as SVGSVGElement;
  wrapper.locked = true;
  const calls = stubUnguardedCanvasMethods(wrapper);

  map.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));

  expect(calls.setViewportCalls).to.equal(0);
});

it('cannot zoom a locked canvas by wheeling over the minimap map', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const map = minimap.shadowRoot!.querySelector('[part="map"]') as SVGSVGElement;
  wrapper.locked = true;
  const calls = stubUnguardedCanvasMethods(wrapper);

  map.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100 }));

  expect(calls.zoomInCalls).to.equal(0);
  expect(calls.zoomOutCalls).to.equal(0);
});

it('cannot drag the viewport rectangle to pan a locked canvas', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const rect = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as SVGElement;
  (rect as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {}; // synthetic pointerId throws otherwise
  wrapper.locked = true;
  const calls = stubUnguardedCanvasMethods(wrapper);

  rect.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10, bubbles: true }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 60, clientY: 60 }));

  expect(calls.setViewportCalls).to.equal(0);
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 60, clientY: 60 }));
});

it('tracks an adopted iframe viewport drag on its owner window and releases it symmetrically', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const iframe = document.createElement('iframe');
  const loaded = new Promise<void>((resolve) =>
    iframe.addEventListener('load', () => resolve(), { once: true }),
  );
  document.body.append(iframe);
  await loaded;
  const frameDocument = iframe.contentDocument!;
  const frameWindow = iframe.contentWindow!;

  try {
    frameDocument.body.append(frameDocument.adoptNode(wrapper));
    await new Promise((resolve) => frameWindow.requestAnimationFrame(resolve));
    await minimap.updateComplete;
    const rect = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as SVGElement;
    (rect as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
    rect.dispatchEvent(new frameWindow.PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 73,
      clientX: 10,
      clientY: 10,
    }));
    expect(
      (minimap as unknown as { dragEventWindow?: Window }).dragEventWindow === frameWindow,
      'the viewport drag retains its iframe owner window',
    ).to.be.true;

    frameWindow.dispatchEvent(new frameWindow.PointerEvent('pointercancel', { pointerId: 73 }));
    expect((minimap as unknown as { dragState?: unknown }).dragState === undefined).to.be.true;
    expect(
      (minimap as unknown as { dragEventWindow?: Window }).dragEventWindow === undefined,
    ).to.be.true;

    rect.dispatchEvent(new frameWindow.PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 74,
      clientX: 10,
      clientY: 10,
    }));
    wrapper.remove();
    expect(
      (minimap as unknown as { dragEventWindow?: Window }).dragEventWindow === undefined,
      'disconnect releases the exact retained window',
    ).to.be.true;
  } finally {
    wrapper.remove();
    iframe.remove();
  }
});

it('pointercancel ends a viewport drag without swallowing the next genuine map click', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const rect = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as SVGElement;
  const map = minimap.shadowRoot!.querySelector('[part="map"]') as SVGSVGElement;
  (rect as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {}; // synthetic pointerId throws otherwise
  rect.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10, bubbles: true }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 30, clientY: 30 }));

  // A touch scroll takeover fires pointercancel, never pointerup -- the drag must end there.
  window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
  let changes = 0;
  wrapper.addEventListener('lr-viewport-change', () => (changes += 1));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 60, clientY: 60 }));
  expect(changes).to.equal(0);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await minimap.updateComplete;
  expect(sinkTexts(), 'a canceled viewport drag must remain silent').to.deep.equal([]);
  changes = 0;

  map.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 60, clientY: 60 }));
  expect(changes).to.equal(1);
});

it('swallows the browser-synthesized click that follows a viewport-rect drag, so releasing does not re-center', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  const rect = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as SVGElement;
  (rect as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {}; // synthetic pointerId throws otherwise

  rect.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10, bubbles: true }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 30, clientY: 30 }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 30, clientY: 30 }));

  let changed = false;
  wrapper.addEventListener('lr-viewport-change', () => (changed = true));
  // The browser fires a synthetic `click` on the captured element after pointerup when
  // down/up targeted the same element -- it bubbles into the map's own click-to-center handler.
  rect.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 30, clientY: 30 }));
  expect(changed).to.be.false;
});

it('re-resolves against a new for target when the for attribute changes at runtime', async () => {
  const root = (await fixture(html`
    <div>
      <lr-flow-canvas id="wf1"></lr-flow-canvas>
      <lr-flow-canvas id="wf2"></lr-flow-canvas>
      <lr-flow-minimap for="wf1"></lr-flow-minimap>
    </div>
  `)) as HTMLElement;
  const canvas2 = root.querySelector('#wf2') as LyraFlowCanvas;
  canvas2.nodes = nodes;
  await canvas2.updateComplete;
  const minimap = root.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  // Not yet pointed at wf2, so nothing rendered from it.
  expect(minimap.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(0);

  minimap.for = 'wf2';
  await minimap.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  await minimap.updateComplete;
  expect(minimap.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(2);
});

it('reconstructs its canvas watcher against the adopted iframe document on every reconnect', async () => {
  const iframe = document.createElement('iframe');
  const loaded = new Promise<void>((resolve) =>
    iframe.addEventListener('load', () => resolve(), { once: true }),
  );
  document.body.append(iframe);
  await loaded;
  const frameDocument = iframe.contentDocument!;
  const frameWindow = iframe.contentWindow!;
  const OriginalFrameObserver = frameWindow.MutationObserver;
  let documentObservations = 0;
  let disconnects = 0;
  class FrameObserver {
    private readonly inner: MutationObserver;
    constructor(callback: MutationCallback) {
      this.inner = new OriginalFrameObserver(callback);
    }
    observe(target: Node, options?: MutationObserverInit): void {
      if (target === frameDocument) documentObservations += 1;
      this.inner.observe(target, options);
    }
    disconnect(): void {
      disconnects += 1;
      this.inner.disconnect();
    }
    takeRecords(): MutationRecord[] { return this.inner.takeRecords(); }
  }
  frameWindow.MutationObserver = FrameObserver as unknown as typeof MutationObserver;
  let minimap: LyraFlowMinimap | undefined;

  try {
    minimap = (await fixture(html`<lr-flow-minimap></lr-flow-minimap>`)) as LyraFlowMinimap;
    frameDocument.body.append(frameDocument.adoptNode(minimap));
    await minimap.updateComplete;
    expect(documentObservations, 'the canvas watcher observes the iframe document').to.equal(1);

    minimap.remove();
    frameDocument.body.append(minimap);
    await minimap.updateComplete;
    expect(documentObservations, 'reconnect builds a fresh iframe-document watcher').to.equal(2);
    minimap.remove();
    expect(disconnects, 'owner-realm observers are torn down on each disconnect').to.be.greaterThan(0);
  } finally {
    minimap?.remove();
    frameWindow.MutationObserver = OriginalFrameObserver;
    iframe.remove();
  }
});

it('resolves a for-target canvas that mounts into the document after the minimap itself', async () => {
  const root = (await fixture(html`<div><lr-flow-minimap for="late-wf"></lr-flow-minimap></div>`)) as HTMLElement;
  const minimap = root.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  expect(minimap.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-hidden')).to.equal('true');

  const canvas = document.createElement('lr-flow-canvas') as LyraFlowCanvas;
  canvas.id = 'late-wf';
  root.appendChild(canvas);
  canvas.nodes = nodes;
  await canvas.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  // The retry itself is DOM-mutation-driven (a MutationObserver), not another render on the
  // minimap, so give the observer's microtask a turn before checking.
  await new Promise((r) => setTimeout(r, 0));
  await minimap.updateComplete;

  expect(minimap.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(2);
});

it('disconnects an in-flight canvas watcher when the for attribute changes again before it resolves', async () => {
  const root = (await fixture(html`<div><lr-flow-minimap for="missing-one"></lr-flow-minimap></div>`)) as HTMLElement;
  const minimap = root.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  expect(minimap.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-hidden')).to.equal('true');

  // No canvas ever resolved for "missing-one", so a MutationObserver is still watching. Changing
  // `for` again before it resolves must tear down that in-flight watcher (not leak it) and start a
  // fresh resolve attempt for the new target instead.
  minimap.for = 'missing-two';
  await minimap.updateComplete;
  expect(minimap.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-hidden')).to.equal('true');

  const canvas = document.createElement('lr-flow-canvas') as LyraFlowCanvas;
  canvas.id = 'missing-two';
  root.appendChild(canvas);
  canvas.nodes = nodes;
  await canvas.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => setTimeout(r, 0));
  await minimap.updateComplete;
  expect(minimap.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(2);
});

it('ignores a repeated DOM mutation while already watching for an unresolved canvas', async () => {
  const root = (await fixture(html`<div><lr-flow-minimap for="still-missing"></lr-flow-minimap></div>`)) as HTMLElement;
  const minimap = root.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  expect(minimap.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-hidden')).to.equal('true');

  // Trigger an unrelated DOM mutation under the watched root while still unresolved -- the
  // MutationObserver callback re-enters resolveAndAttach() -> watchForCanvas() while a watcher is
  // already active, which must no-op instead of creating a second observer.
  root.appendChild(document.createElement('span'));
  await new Promise((r) => setTimeout(r, 0));
  expect(minimap.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-hidden')).to.equal('true');
});

it('unsubscribes from the canvas companion hook on disconnect', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  minimap.remove();
  wrapper.nodes = [...nodes, { id: 'c', position: { x: 900, y: 900 } }];
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  // No assertion beyond "doesn't throw" -- proves the unsubscribe ran without needing to reach into
  // the private companion-callback set.
});

it('is accessible with a resolved canvas', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
  await minimap.updateComplete;
  await expect(minimap).to.be.accessible();
});

describe('mouse-hover feedback on the viewport rectangle', () => {
  it('renders hover feedback from the transparent hit area onto the visible viewport', async () => {
    const wrapper = (await fixture(html`
      <lr-flow-canvas style="width:400px;height:300px">
        <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
      </lr-flow-canvas>
    `)) as LyraFlowCanvas;
    wrapper.nodes = nodes;
    await wrapper.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
    await minimap.updateComplete;
    const hitArea = minimap.shadowRoot!.querySelector<SVGRectElement>('[part="viewport-hit-area"]')!;
    const viewport = minimap.shadowRoot!.querySelector<SVGRectElement>('[part="viewport"]')!;
    const restingFill = getComputedStyle(viewport).fill;
    const rect = hitArea.getBoundingClientRect();

    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(() => {
        const computed = getComputedStyle(viewport);
        return Number.parseFloat(computed.strokeWidth) === 3 && computed.fill !== restingFill;
      }, 'the visible viewport never painted its hit-area hover feedback');
    } finally {
      await resetMouse();
    }
  });
});

describe('.strings overrides (every localize() key)', () => {
  // `<lr-flow-minimap>` calls this.localize() with 4 keys; each one is proven here to reach the
  // rendered DOM through a `.strings` override, so `registerLyraLocale()` can translate it.
  // Distinctive marker strings, not copies of the production English, so a regression that dropped
  // the override and fell back to DEFAULT_STRINGS would still fail.
  async function mountMinimap(strings: Record<string, string>): Promise<LyraFlowMinimap> {
    const wrapper = (await fixture(html`
      <lr-flow-canvas style="width:400px;height:300px">
        <lr-flow-minimap slot="bottom-end" .strings=${strings}></lr-flow-minimap>
      </lr-flow-canvas>
    `)) as LyraFlowCanvas;
    wrapper.nodes = nodes;
    await wrapper.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
    await minimap.updateComplete;
    return minimap;
  }

  it('routes flowMinimapLabel, flowMinimapViewport and flowMinimapInstructions to the rendered DOM', async () => {
    const minimap = await mountMinimap({
      flowMinimapLabel: 'MINIMAP-LABEL-MARKER',
      flowMinimapViewport: 'VIEWPORT-MARKER',
      flowMinimapInstructions: 'INSTRUCTIONS-MARKER',
    });
    expect(minimap.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'MINIMAP-LABEL-MARKER',
    );
    expect(minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]')!.getAttribute('aria-label')).to.equal(
      'VIEWPORT-MARKER',
    );
    expect(minimap.shadowRoot!.querySelector('[part="instructions"]')!.textContent!.trim()).to.equal(
      'INSTRUCTIONS-MARKER',
    );
  });

  it('routes flowMinimapViewportChanged, including its {x}/{y}/{zoom} placeholders, into the live region', async () => {
    const minimap = await mountMinimap({
      flowMinimapViewportChanged: 'MOVED-MARKER x={x} y={y} z={zoom}',
    });
    const rect = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as HTMLElement;
    rect.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await minimap.updateComplete;
    const live = minimap.shadowRoot!.querySelector('[part="live-region"]')!.textContent!.trim();
    expect(live).to.match(/^MOVED-MARKER x=\S+ y=\S+ z=\S+$/);
  });
});

describe('viewport-rect minimum pointer target', () => {
  // `--lr-flow-minimap-viewport-min-size` inherits, so setting it on the canvas wrapper before
  // mount gives each fixture its floor from the very first render. `0px` disables the floor
  // outright, which is what makes an exact "unclamped" reference rect available to compare against.
  const mount = async (spread: number, minSize?: string): Promise<LyraFlowMinimap> => {
    const style = `width:400px;height:300px${
      minSize === undefined ? '' : `;--lr-flow-minimap-viewport-min-size:${minSize}`
    }`;
    const canvas = (await fixture(html`
      <lr-flow-canvas style=${style}>
        <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
      </lr-flow-canvas>
    `)) as LyraFlowCanvas;
    canvas.nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: spread, y: spread } },
    ];
    await canvas.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const minimap = canvas.querySelector('lr-flow-minimap') as LyraFlowMinimap;
    await minimap.updateComplete;
    return minimap;
  };

  /** The harness page's own root font-size is not necessarily 16px, and the floor token is
   *  rem-based, so every threshold below is derived rather than hardcoded. */
  const floorPx = (rem: number) =>
    rem * parseFloat(getComputedStyle(document.documentElement).fontSize);

  const visibleRectOf = (minimap: LyraFlowMinimap) =>
    minimap.shadowRoot!.querySelector('[part="viewport"]') as SVGGraphicsElement;
  const hitRectOf = (minimap: LyraFlowMinimap) =>
    minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as SVGGraphicsElement;

  const geometry = (rect: SVGGraphicsElement) => {
    return {
      x: Number(rect.getAttribute('x')),
      y: Number(rect.getAttribute('y')),
      width: Number(rect.getAttribute('width')),
      height: Number(rect.getAttribute('height')),
    };
  };

  it('keeps the draggable rect at a usable size when the content dwarfs the viewport', async () => {
    // Node bounds ~20000 user units across inside a 12rem x 8rem map: with no floor the rect --
    // the ONLY pointer-drag affordance for panning -- renders a couple of physical pixels wide.
    const minimap = await mount(20000);
    const box = hitRectOf(minimap).getBoundingClientRect();
    expect(box.width, 'rect width').to.be.at.least(floorPx(1.5) - 0.5);
    expect(box.height, 'rect height').to.be.at.least(floorPx(1.5) - 0.5);
  });

  it('proves the unfloored rect really is unusably small, so the floor is what fixes it', async () => {
    const minimap = await mount(20000, '0px');
    const box = hitRectOf(minimap).getBoundingClientRect();
    expect(box.width).to.be.below(floorPx(1.5) - 0.5);
  });

  it('grows the rect symmetrically, leaving its centre on the true viewport centre', async () => {
    const minimap = await mount(20000);
    const floored = geometry(hitRectOf(minimap));
    const raw = geometry(visibleRectOf(minimap));
    expect(floored.width).to.be.greaterThan(raw.width);
    expect(floored.x + floored.width / 2, 'centre x').to.be.closeTo(raw.x + raw.width / 2, 0.001);
    expect(floored.y + floored.height / 2, 'centre y').to.be.closeTo(raw.y + raw.height / 2, 0.001);
  });

  it('unset-regression: leaves a naturally large rect exactly where the raw viewport puts it', async () => {
    // Content barely larger than the viewport -- the rect already clears the floor, so the clamp
    // must not move or grow it at all.
    const minimap = await mount(50);
    const floored = geometry(hitRectOf(minimap));
    const raw = geometry(visibleRectOf(minimap));
    expect(floored).to.deep.equal(raw);
  });

  it('honours a consumer-raised --lr-flow-minimap-viewport-min-size', async () => {
    const wider = hitRectOf(await mount(20000, '3rem')).getBoundingClientRect();
    expect(wider.width).to.be.at.least(floorPx(3) - 0.5);
  });

  it('keeps the painted viewport exact while only the transparent hit rectangle is floored', async () => {
    const defaultFloor = await mount(20000);
    const noFloor = await mount(20000, '0px');
    expect(geometry(visibleRectOf(defaultFloor))).to.deep.equal(geometry(visibleRectOf(noFloor)));
    expect(hitRectOf(defaultFloor).getBoundingClientRect().width).to.be.greaterThan(
      visibleRectOf(defaultFloor).getBoundingClientRect().width,
    );
    expect(getComputedStyle(hitRectOf(defaultFloor)).fill).to.equal('rgba(0, 0, 0, 0)');
  });
});

describe('explicitly empty host aria-label', () => {
  it('keeps the region explicitly unnamed instead of falling back to the label property', async () => {
    const explicitWrapper = (await fixture(html`
      <lr-flow-canvas>
        <lr-flow-minimap slot="bottom-end" label="Overview" aria-label=""></lr-flow-minimap>
      </lr-flow-canvas>
    `)) as LyraFlowCanvas;
    explicitWrapper.nodes = nodes;
    await explicitWrapper.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const explicit = explicitWrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
    await explicit.updateComplete;
    const base = explicit.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.hasAttribute('aria-label')).to.equal(true);
    expect(base.getAttribute('aria-label')).to.equal('');

    const omittedWrapper = (await fixture(html`
      <lr-flow-canvas>
        <lr-flow-minimap slot="bottom-end" label="Overview"></lr-flow-minimap>
      </lr-flow-canvas>
    `)) as LyraFlowCanvas;
    omittedWrapper.nodes = nodes;
    await omittedWrapper.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const omitted = omittedWrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
    await omitted.updateComplete;
    expect(omitted.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Overview');
  });
});
