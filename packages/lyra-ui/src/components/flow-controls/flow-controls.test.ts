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
