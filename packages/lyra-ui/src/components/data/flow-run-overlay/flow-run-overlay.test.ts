import { fixture, expect, html } from '@open-wc/testing';
import '../flow-canvas/flow-canvas.js';
import './flow-run-overlay.js';
import type { LyraFlowRunOverlay } from './flow-run-overlay.js';
import type { LyraFlowCanvas, FlowNode, FlowRunDecorations } from '../flow-canvas/flow-canvas.js';

const nodes: FlowNode[] = [
  { id: 'fetch', position: { x: 0, y: 0 }, data: { label: 'Fetch data' } },
  { id: 'summarize', position: { x: 200, y: 0 }, data: { label: 'Summarize' } },
];

it('defaults to an empty decorations object, hideSummary false, empty for/label', async () => {
  const el = (await fixture(html`<lr-flow-run-overlay></lr-flow-run-overlay>`)) as LyraFlowRunOverlay;
  expect(el.decorations).to.deep.equal({});
  expect(el.hideSummary).to.be.false;
  expect(el.for).to.equal('');
  expect(el.label).to.equal('');
});

it('mirrors decorations into the resolved canvas on attach and on every change', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-run-overlay slot="top-end" .decorations=${{ fetch: { status: 'running' } } as FlowRunDecorations}></lr-flow-run-overlay>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const overlay = wrapper.querySelector('lr-flow-run-overlay') as LyraFlowRunOverlay;
  await overlay.updateComplete;
  expect(wrapper.decorations).to.deep.equal({ fetch: { status: 'running' } });
  overlay.decorations = { fetch: { status: 'success' } };
  await overlay.updateComplete;
  expect(wrapper.decorations).to.deep.equal({ fetch: { status: 'success' } });
});

it('clears the canvas decorations on disconnect when it still owns them', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-run-overlay slot="top-end" .decorations=${{ fetch: { status: 'running' } } as FlowRunDecorations}></lr-flow-run-overlay>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const overlay = wrapper.querySelector('lr-flow-run-overlay') as LyraFlowRunOverlay;
  await overlay.updateComplete;
  overlay.remove();
  expect(wrapper.decorations).to.equal(null);
});

it('does not clear the canvas decorations on disconnect once something else has overwritten them', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-run-overlay slot="top-end" .decorations=${{ fetch: { status: 'running' } } as FlowRunDecorations}></lr-flow-run-overlay>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const overlay = wrapper.querySelector('lr-flow-run-overlay') as LyraFlowRunOverlay;
  await overlay.updateComplete;
  const foreign: FlowRunDecorations = { fetch: { status: 'error' } };
  wrapper.decorations = foreign;
  overlay.remove();
  expect(wrapper.decorations).to.equal(foreign);
});

it('warns when a foreign decorations value is about to be overwritten', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-run-overlay slot="top-end"></lr-flow-run-overlay>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const overlay = wrapper.querySelector('lr-flow-run-overlay') as LyraFlowRunOverlay;
  await overlay.updateComplete;
  wrapper.decorations = { fetch: { status: 'error' } }; // foreign write, not through the overlay
  const originalWarn = console.warn;
  let warned = false;
  console.warn = (...args: unknown[]) => {
    warned = true;
    void args;
  };
  overlay.decorations = { fetch: { status: 'success' } };
  await overlay.updateComplete;
  console.warn = originalWarn;
  expect(warned).to.be.true;
});

it('renders the "{done} of {total} steps complete" summary and per-status counts', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-run-overlay
        slot="top-end"
        .decorations=${{ fetch: { status: 'success' }, summarize: { status: 'running' } } as FlowRunDecorations}
      ></lr-flow-run-overlay>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const overlay = wrapper.querySelector('lr-flow-run-overlay') as LyraFlowRunOverlay;
  await overlay.updateComplete;
  expect(overlay.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.equal('1 of 2 steps complete');
  const counts = overlay.shadowRoot!.querySelectorAll('[part="count"]');
  expect(counts.length).to.equal(2); // success + running only -- pending/error/denied are all 0
});

it('hideSummary suppresses the visible strip but still mirrors decorations into the canvas', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-run-overlay
        slot="top-end"
        hide-summary
        .decorations=${{ fetch: { status: 'running' } } as FlowRunDecorations}
      ></lr-flow-run-overlay>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const overlay = wrapper.querySelector('lr-flow-run-overlay') as LyraFlowRunOverlay;
  await overlay.updateComplete;
  expect(overlay.shadowRoot!.querySelector('[part="summary"]')).to.not.exist;
  expect(wrapper.decorations).to.deep.equal({ fetch: { status: 'running' } });
});

it('announces a step status transition, not the initial mount', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-run-overlay
        slot="top-end"
        .decorations=${{ fetch: { status: 'running' } } as FlowRunDecorations}
      ></lr-flow-run-overlay>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const overlay = wrapper.querySelector('lr-flow-run-overlay') as LyraFlowRunOverlay;
  await overlay.updateComplete;
  overlay.decorations = { fetch: { status: 'success' } };
  await overlay.updateComplete;
  const liveRegion = overlay.shadowRoot!.querySelector('[part="live-region"]')!;
  expect(liveRegion.textContent).to.equal('Fetch data: success');
});

it('renders extra host chrome from the default slot', async () => {
  const el = (await fixture(
    html`<lr-flow-run-overlay><button type="button">Cancel</button></lr-flow-run-overlay>`,
  )) as LyraFlowRunOverlay;
  expect(el.querySelector('button')!.textContent).to.equal('Cancel');
});

it('is accessible with decorations set', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-run-overlay
        slot="top-end"
        .decorations=${{ fetch: { status: 'running' } } as FlowRunDecorations}
      ></lr-flow-run-overlay>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const overlay = wrapper.querySelector('lr-flow-run-overlay') as LyraFlowRunOverlay;
  await overlay.updateComplete;
  await expect(overlay).to.be.accessible();
});
