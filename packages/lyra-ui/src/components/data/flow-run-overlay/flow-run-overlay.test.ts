import { fixture, expect, html } from '@open-wc/testing';
import '../flow-canvas/flow-canvas.js';
import './flow-run-overlay.js';
import type { LyraFlowRunOverlay } from './flow-run-overlay.js';
import type { LyraFlowCanvas, FlowNode, FlowRunDecorations } from '../flow-canvas/flow-canvas.js';
import { styles } from './flow-run-overlay.styles.js';

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

it('adopts a late target and transfers owned decorations when for changes', async () => {
  const host = await fixture(html`<div>
    <lr-flow-run-overlay
      for="first"
      .decorations=${{ fetch: { status: 'running' } } as FlowRunDecorations}
    ></lr-flow-run-overlay>
  </div>`);
  const overlay = host.querySelector('lr-flow-run-overlay') as LyraFlowRunOverlay;
  const first = document.createElement('lr-flow-canvas') as LyraFlowCanvas;
  first.id = 'first';
  host.append(first);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(first.decorations).to.deep.equal({ fetch: { status: 'running' } });

  const second = document.createElement('lr-flow-canvas') as LyraFlowCanvas;
  second.id = 'second';
  host.append(second);
  overlay.for = 'second';
  await overlay.updateComplete;
  expect(first.decorations).to.equal(null);
  expect(second.decorations).to.deep.equal({ fetch: { status: 'running' } });
});

it('adopts a same-id replacement target and releases the removed canvas', async () => {
  const host = (await fixture(html`<div>
    <lr-flow-canvas id="target"></lr-flow-canvas>
    <lr-flow-run-overlay
      for="target"
      .decorations=${{ fetch: { status: 'success' } } as FlowRunDecorations}
    ></lr-flow-run-overlay>
  </div>`)) as HTMLElement;
  const original = host.querySelector('lr-flow-canvas') as LyraFlowCanvas;
  expect(original.decorations).to.deep.equal({ fetch: { status: 'success' } });
  original.remove();
  const replacement = document.createElement('lr-flow-canvas') as LyraFlowCanvas;
  replacement.id = 'target';
  host.prepend(replacement);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(original.decorations).to.equal(null);
  expect(replacement.decorations).to.deep.equal({ fetch: { status: 'success' } });
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
  expect(liveRegion.textContent).to.equal('Fetch data: Success');
});

it('announces every simultaneous step transition in one live-region update', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-run-overlay
        slot="top-end"
        .decorations=${{
          fetch: { status: 'running' },
          summarize: { status: 'pending' },
        } as FlowRunDecorations}
      ></lr-flow-run-overlay>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const overlay = wrapper.querySelector('lr-flow-run-overlay') as LyraFlowRunOverlay;
  overlay.decorations = {
    fetch: { status: 'success' },
    summarize: { status: 'error' },
  };
  await overlay.updateComplete;
  const announcement = overlay.shadowRoot!.querySelector('[part="live-region"]')!.textContent!;
  expect(announcement).to.include('Fetch data: Success');
  expect(announcement).to.include('Summarize: Error');
});

it('locale-formats summary/count numbers and localizes each count as a whole template', async () => {
  const overlay = (await fixture(html`
    <lr-flow-run-overlay
      locale="ar"
      .strings=${{ flowRunStatusCount: '{count} / {status}' }}
      .decorations=${{
        a: { status: 'success' },
        b: { status: 'success' },
        c: { status: 'running' },
      } as FlowRunDecorations}
    ></lr-flow-run-overlay>
  `)) as LyraFlowRunOverlay;
  const number = new Intl.NumberFormat('ar');
  expect(overlay.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.include(number.format(2));
  expect(overlay.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.include(number.format(3));
  const counts = [...overlay.shadowRoot!.querySelectorAll('[part="count"]')].map((item) =>
    item.textContent!.trim(),
  );
  expect(counts).to.include(`${number.format(2)} / Success`);
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

const overlayBaseChrome = (el: LyraFlowRunOverlay) => {
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const s = getComputedStyle(base);
  return {
    paddingTop: s.paddingTop,
    paddingLeft: s.paddingLeft,
    borderTopWidth: s.borderTopWidth,
    borderTopStyle: s.borderTopStyle,
    borderTopLeftRadius: s.borderTopLeftRadius,
    backgroundColor: s.backgroundColor,
    boxShadow: s.boxShadow,
  };
};

it('defaults to appearance="card", rendering identically to that value restated', async () => {
  const implicit = (await fixture(
    html`<lr-flow-run-overlay .decorations=${{ fetch: { status: 'running' } } as FlowRunDecorations}></lr-flow-run-overlay>`,
  )) as LyraFlowRunOverlay;
  const explicit = (await fixture(
    html`<lr-flow-run-overlay
      appearance="card"
      .decorations=${{ fetch: { status: 'running' } } as FlowRunDecorations}
    ></lr-flow-run-overlay>`,
  )) as LyraFlowRunOverlay;

  expect(implicit.appearance).to.equal('card');
  expect(implicit.getAttribute('appearance')).to.equal('card');
  expect(overlayBaseChrome(explicit)).to.deep.equal(overlayBaseChrome(implicit));

  const chrome = overlayBaseChrome(implicit);
  expect(chrome.borderTopWidth).to.equal('1px');
  expect(chrome.borderTopStyle).to.equal('solid');
  expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  expect(chrome.boxShadow).to.not.equal('none');
});

it('drops border, background, shadow, padding and radius under appearance="plain"', async () => {
  const el = (await fixture(
    html`<lr-flow-run-overlay
      appearance="plain"
      .decorations=${{ fetch: { status: 'running' } } as FlowRunDecorations}
    ></lr-flow-run-overlay>`,
  )) as LyraFlowRunOverlay;
  expect(el.getAttribute('appearance')).to.equal('plain');
  const chrome = overlayBaseChrome(el);
  expect(chrome.borderTopWidth).to.equal('0px');
  expect(chrome.borderTopLeftRadius).to.equal('0px');
  expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  expect(chrome.boxShadow).to.equal('none');
  expect(chrome.paddingTop).to.equal('0px');
  expect(chrome.paddingLeft).to.equal('0px');
});

it('is accessible under appearance="plain"', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas>
      <lr-flow-run-overlay
        slot="top-end"
        appearance="plain"
        .decorations=${{ fetch: { status: 'running' }, summarize: { status: 'success' } } as FlowRunDecorations}
      ></lr-flow-run-overlay>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  const overlay = wrapper.querySelector('lr-flow-run-overlay') as LyraFlowRunOverlay;
  await overlay.updateComplete;
  await expect(overlay).to.be.accessible();
});
