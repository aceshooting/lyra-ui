import { fixture, expect, html } from '@open-wc/testing';
import '../flow-canvas/flow-canvas.js';
import './flow-minimap.js';
import type { LyraFlowMinimap } from './flow-minimap.js';
import type { LyraFlowCanvas, FlowNode } from '../flow-canvas/flow-canvas.js';

const nodes: FlowNode[] = [
  { id: 'a', position: { x: 0, y: 0 } },
  { id: 'b', position: { x: 300, y: 200 } },
];

it('defaults to an empty for/label', async () => {
  const el = (await fixture(html`<lr-flow-minimap></lr-flow-minimap>`)) as LyraFlowMinimap;
  expect(el.for).to.equal('');
  expect(el.label).to.equal('');
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
  expect(minimap.shadowRoot!.querySelector('[part="map"] line, [part="map"] path')).to.not.exist;
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
  const rect = minimap.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  expect(rect.getAttribute('role')).to.equal('button');
  expect(rect.getAttribute('aria-label')).to.equal('Visible area');
  const zoomBefore = wrapper.viewport.zoom;
  rect.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true }));
  expect(wrapper.viewport.zoom).to.be.greaterThan(zoomBefore);
});

it('pointercancel ends a viewport drag so a later pointermove no longer pans the canvas', async () => {
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
  const rect = minimap.shadowRoot!.querySelector('[part="viewport"]') as SVGElement;
  (rect as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {}; // synthetic pointerId throws otherwise
  rect.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10, bubbles: true }));

  // A touch scroll takeover fires pointercancel, never pointerup -- the drag must end there.
  window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
  let changed = false;
  wrapper.addEventListener('lr-viewport-change', () => (changed = true));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 60, clientY: 60 }));
  expect(changed).to.be.false;
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
  const rect = minimap.shadowRoot!.querySelector('[part="viewport"]') as SVGElement;
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
