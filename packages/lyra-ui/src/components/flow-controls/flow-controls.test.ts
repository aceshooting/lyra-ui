import { fixture, expect, html } from '@open-wc/testing';
import '../flow-canvas/flow-canvas.js';
import './flow-controls.js';
import type { LyraFlowControls } from './flow-controls.js';
import type { LyraFlowCanvas, FlowNode } from '../flow-canvas/flow-canvas.js';

const nodes: FlowNode[] = [{ id: 'a', position: { x: 0, y: 0 } }];

it('defaults to orientation vertical, hideLock false, empty for', async () => {
  const el = (await fixture(html`<lyra-flow-controls></lyra-flow-controls>`)) as LyraFlowControls;
  expect(el.orientation).to.equal('vertical');
  expect(el.hideLock).to.be.false;
  expect(el.for).to.equal('');
});

it('gives every toolbar button the shared minimum hit area', async () => {
  const el = (await fixture(html`<lyra-flow-controls></lyra-flow-controls>`)) as LyraFlowControls;
  for (const part of ['zoom-in', 'zoom-out', 'fit', 'lock']) {
    const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
    expect(getComputedStyle(button).minInlineSize).to.equal('40px');
    expect(getComputedStyle(button).minBlockSize).to.equal('40px');
  }
});

it('disables every button when no canvas can be resolved', async () => {
  const el = (await fixture(html`<lyra-flow-controls></lyra-flow-controls>`)) as LyraFlowControls;
  expect((el.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement).disabled).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="fit"]') as HTMLButtonElement).disabled).to.be.true;
});

it('zoom-in/zoom-out call the resolved canvas methods and fit calls fit()', async () => {
  const wrapper = (await fixture(html`
    <lyra-flow-canvas><lyra-flow-controls slot="bottom-start"></lyra-flow-controls></lyra-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const controls = wrapper.querySelector('lyra-flow-controls') as LyraFlowControls;
  await controls.updateComplete;
  const zoomBefore = wrapper.viewport.zoom;
  (controls.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement).click();
  expect(wrapper.viewport.zoom).to.be.greaterThan(zoomBefore);
});

it('the zoom-out button disables once the canvas viewport reaches minZoom', async () => {
  const wrapper = (await fixture(html`
    <lyra-flow-canvas min-zoom="1"><lyra-flow-controls slot="bottom-start"></lyra-flow-controls></lyra-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const controls = wrapper.querySelector('lyra-flow-controls') as LyraFlowControls;
  await controls.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  await controls.updateComplete;
  expect((controls.shadowRoot!.querySelector('[part="zoom-out"]') as HTMLButtonElement).disabled).to.be.true;
});

it('the lock button toggles the canvas locked attribute and mirrors aria-pressed both ways', async () => {
  const wrapper = (await fixture(html`
    <lyra-flow-canvas><lyra-flow-controls slot="bottom-start"></lyra-flow-controls></lyra-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const controls = wrapper.querySelector('lyra-flow-controls') as LyraFlowControls;
  await controls.updateComplete;
  const lockButton = controls.shadowRoot!.querySelector('[part="lock"]') as HTMLButtonElement;
  expect(lockButton.getAttribute('aria-pressed')).to.equal('false');
  lockButton.click();
  expect(wrapper.locked).to.be.true;
  await new Promise((r) => setTimeout(r, 0));
  await controls.updateComplete;
  expect(lockButton.getAttribute('aria-pressed')).to.equal('true');

  // An externally-set lock (not via this button) stays in sync too.
  wrapper.locked = false;
  await new Promise((r) => setTimeout(r, 0));
  await controls.updateComplete;
  expect(lockButton.getAttribute('aria-pressed')).to.equal('false');
});

it('hide-lock omits the lock button entirely', async () => {
  const el = (await fixture(html`<lyra-flow-controls hide-lock></lyra-flow-controls>`)) as LyraFlowControls;
  expect(el.shadowRoot!.querySelector('[part="lock"]')).to.not.exist;
});

it('the default slot appends extra host buttons to the cluster', async () => {
  const el = (await fixture(
    html`<lyra-flow-controls><button type="button">Export</button></lyra-flow-controls>`,
  )) as LyraFlowControls;
  expect(el.querySelector('button')!.textContent).to.equal('Export');
});

it('re-resolves against a new for target when the for attribute changes at runtime', async () => {
  const root = (await fixture(html`
    <div>
      <lyra-flow-canvas id="wf1"></lyra-flow-canvas>
      <lyra-flow-canvas id="wf2" min-zoom="1"></lyra-flow-canvas>
      <lyra-flow-controls for="wf1"></lyra-flow-controls>
    </div>
  `)) as HTMLElement;
  const canvas2 = root.querySelector('#wf2') as LyraFlowCanvas;
  canvas2.nodes = nodes;
  await canvas2.updateComplete;
  const controls = root.querySelector('lyra-flow-controls') as LyraFlowControls;
  await controls.updateComplete;
  // Still pointed at wf1 (no nodes) -- clicking zoom-in should not touch wf2.
  const zoomBeforeWf2 = canvas2.viewport.zoom;

  controls.for = 'wf2';
  await controls.updateComplete;
  (controls.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement).click();
  expect(canvas2.viewport.zoom).to.be.greaterThan(zoomBeforeWf2);
});

it('resolves a for-target canvas that mounts into the document after the controls element itself', async () => {
  const root = (await fixture(html`<div><lyra-flow-controls for="late-wf"></lyra-flow-controls></div>`)) as HTMLElement;
  const controls = root.querySelector('lyra-flow-controls') as LyraFlowControls;
  expect((controls.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement).disabled).to.be.true;

  const canvas = document.createElement('lyra-flow-canvas') as LyraFlowCanvas;
  canvas.id = 'late-wf';
  root.appendChild(canvas);
  canvas.nodes = nodes;
  await canvas.updateComplete;
  // The retry itself is DOM-mutation-driven (a MutationObserver), not another render on the
  // controls element, so give the observer's microtask a turn first; the button re-render then
  // rides on the rAF-coalesced companion snapshot delivery (see flow-canvas.test.ts's own
  // "registerCompanion delivers a FlowStructureSnapshot rAF-coalesced" case).
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => requestAnimationFrame(r));
  await controls.updateComplete;

  expect((controls.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement).disabled).to.be.false;
});

it('is accessible with a resolved canvas', async () => {
  const wrapper = (await fixture(html`
    <lyra-flow-canvas><lyra-flow-controls slot="bottom-start"></lyra-flow-controls></lyra-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const controls = wrapper.querySelector('lyra-flow-controls') as LyraFlowControls;
  await controls.updateComplete;
  await expect(controls).to.be.accessible();
});

it('renders per-element .strings overrides in the control button labels', async () => {
  const el = (await fixture(html`<lyra-flow-controls></lyra-flow-controls>`)) as LyraFlowControls;
  el.strings = { zoomIn: 'Zoomer', zoomToFit: 'Ajuster', flowControlsLabel: 'Commandes du canevas' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="zoom-in"]')!.getAttribute('aria-label')).to.equal('Zoomer');
  expect(el.shadowRoot!.querySelector('[part="fit"]')!.getAttribute('aria-label')).to.equal('Ajuster');
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Commandes du canevas');
});
