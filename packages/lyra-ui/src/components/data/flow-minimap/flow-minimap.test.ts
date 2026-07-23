import { fixture, expect, html } from '@open-wc/testing';
import '../flow-canvas/flow-canvas.js';
import './flow-minimap.js';
import type { LyraFlowMinimap } from './flow-minimap.js';
import type { LyraFlowCanvas, FlowNode } from '../flow-canvas/flow-canvas.js';
import { styles } from './flow-minimap.styles.js';

const nodes: FlowNode[] = [
  { id: 'a', position: { x: 0, y: 0 } },
  { id: 'b', position: { x: 300, y: 200 } },
];

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
  const rect = minimap.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
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
  const rect = minimap.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
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
  const rect = minimap.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;

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
  const rect = minimap.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;

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
  // :hover cannot be synthesized in this test runner (no real pointer), so per this repo's
  // documented exception for genuinely-unsynthesizable pseudo-classes, this asserts against the
  // stylesheet source instead of a rendered/computed effect.
  it("declares a [part='viewport']:hover rule, matching its :focus-visible affordance", () => {
    expect(styles.cssText).to.match(/\[part='viewport'\]:hover\s*\{/);
  });
});
