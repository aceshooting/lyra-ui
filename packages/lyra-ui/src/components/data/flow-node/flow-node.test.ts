import { fixture, expect, html } from '@open-wc/testing';
import './flow-node.js';
import type { LyraFlowNode } from './flow-node.js';

it('defaults to empty heading, no status, in/out handles, horizontal orientation', async () => {
  const el = (await fixture(html`<lr-flow-node></lr-flow-node>`)) as LyraFlowNode;
  expect(el.heading).to.equal('');
  expect(el.status).to.equal(null);
  expect(el.progress).to.equal(null);
  expect(el.selected).to.be.false;
  expect(el.inputs).to.deep.equal([{ id: 'in' }]);
  expect(el.outputs).to.deep.equal([{ id: 'out' }]);
  expect(el.orientation).to.equal('horizontal');
});

it('renders the heading text and reflects selected/status', async () => {
  const el = (await fixture(html`<lr-flow-node heading="Fetch data" status="running" selected></lr-flow-node>`)) as LyraFlowNode;
  expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('Fetch data');
  expect(el.getAttribute('status')).to.equal('running');
  expect(el.hasAttribute('selected')).to.be.true;
});

it('shows a visible status chip with text (never color-only) for each status', async () => {
  const el = (await fixture(html`<lr-flow-node status="error"></lr-flow-node>`)) as LyraFlowNode;
  expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent).to.include('Error');
});

it('renders a determinate progress bar only when progress is set', async () => {
  const el = (await fixture(html`<lr-flow-node></lr-flow-node>`)) as LyraFlowNode;
  expect(el.shadowRoot!.querySelector('[part="progress"]')).to.not.exist;
  el.progress = 40;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="progress"]')).to.exist;
});

it('renders one handle per input/output with data-handle-id/data-handle-kind and a native title', async () => {
  const el = (await fixture(
    html`<lr-flow-node .inputs=${[{ id: 'a' }, { id: 'b', label: 'Second input' }]} .outputs=${[{ id: 'out' }]}></lr-flow-node>`,
  )) as LyraFlowNode;
  const inputHandles = el.shadowRoot!.querySelectorAll('[part~="handle-input"]');
  expect(inputHandles.length).to.equal(2);
  expect((inputHandles[0] as HTMLElement).dataset.handleId).to.equal('a');
  expect((inputHandles[0] as HTMLElement).dataset.handleKind).to.equal('input');
  expect((inputHandles[1] as HTMLElement).getAttribute('title')).to.equal('Second input');
  expect(el.shadowRoot!.querySelectorAll('[part~="handle-output"]').length).to.equal(1);
});

it('renders icon/header/toolbar slots and the default body slot', async () => {
  const el = (await fixture(
    html`<lr-flow-node
      ><span slot="icon">i</span><span slot="toolbar">t</span>body</lr-flow-node
    >`,
  )) as LyraFlowNode;
  expect(el.shadowRoot!.querySelector('slot[name="icon"]')).to.exist;
  expect(el.shadowRoot!.querySelector('slot[name="toolbar"]')).to.exist;
  expect(el.shadowRoot!.querySelector('slot:not([name])')).to.exist;
});

it('header slot replaces the built-in heading row entirely', async () => {
  const el = (await fixture(
    html`<lr-flow-node heading="Ignored"><span slot="header">Custom header</span></lr-flow-node>`,
  )) as LyraFlowNode;
  // Removed from the DOM outright (not merely hidden), so it never visually stacks with the
  // slotted replacement -- an author stylesheet's unconditional `[part='header']{display:flex}`
  // rule always beats a `[hidden]` override at equal specificity/origin, so hiding via attribute
  // alone would leave both rows rendered.
  expect(el.shadowRoot!.querySelector('[part="header"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('slot[name="header"]')).to.exist;
});

it('a header child appended after the initial render still replaces the built-in heading row', async () => {
  const el = (await fixture(html`<lr-flow-node heading="Ignored"></lr-flow-node>`)) as LyraFlowNode;
  expect(el.shadowRoot!.querySelector('[part="header"]')).to.exist;

  const span = document.createElement('span');
  span.slot = 'header';
  span.textContent = 'Custom header';
  el.appendChild(span);
  // slotchange fires asynchronously once the browser processes the newly assigned node.
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="header"]')).to.not.exist;
  const slot = el.shadowRoot!.querySelector('slot[name="header"]') as HTMLSlotElement;
  const assigned = slot.assignedElements({ flatten: true });
  expect(assigned.length).to.equal(1);
  expect(assigned[0].textContent).to.equal('Custom header');
});

it('is accessible with a status, progress, and handles', async () => {
  const el = (await fixture(
    html`<lr-flow-node heading="Fetch" status="running" progress="40"></lr-flow-node>`,
  )) as LyraFlowNode;
  await expect(el).to.be.accessible();
});

describe('duration composition', () => {
  it('composes flowStatusWithDuration when both status and durationMs are set', async () => {
    const el = (await fixture(html`<lr-flow-node status="success" duration-ms="812"></lr-flow-node>`)) as LyraFlowNode;
    expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent).to.include('Success (812ms)');
  });

  it('formats a duration at or above 1000ms in seconds', async () => {
    const el = (await fixture(html`<lr-flow-node status="running" duration-ms="2500"></lr-flow-node>`)) as LyraFlowNode;
    expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent).to.include('2.5s');
  });

  it('falls back to the plain status label when durationMs is unset', async () => {
    const el = (await fixture(html`<lr-flow-node status="pending"></lr-flow-node>`)) as LyraFlowNode;
    expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent!.trim()).to.equal('Pending');
  });
});

describe('numeric guards', () => {
  it('clamps an out-of-range progress into [0, 100] instead of over/under-filling the bar', async () => {
    const el = (await fixture(html`<lr-flow-node></lr-flow-node>`)) as LyraFlowNode;
    el.progress = 150;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('.progress-fill') as HTMLElement).style.inlineSize).to.equal('100%');

    el.progress = -40;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('.progress-fill') as HTMLElement).style.inlineSize).to.equal('0%');
  });

  it('treats a NaN progress the same as unset -- no progress bar at all', async () => {
    const el = (await fixture(html`<lr-flow-node></lr-flow-node>`)) as LyraFlowNode;
    el.progress = Number.NaN;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="progress"]')).to.not.exist;
  });

  it('clamps a negative durationMs to 0 instead of rendering a negative duration', async () => {
    const el = (await fixture(html`<lr-flow-node status="success" duration-ms="-500"></lr-flow-node>`)) as LyraFlowNode;
    expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent).to.include('0ms');
  });

  it('treats a NaN durationMs the same as unset -- falls back to the plain status label', async () => {
    const el = (await fixture(html`<lr-flow-node status="success"></lr-flow-node>`)) as LyraFlowNode;
    el.durationMs = Number.NaN;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent!.trim()).to.equal('Success');
  });
});

describe('reduced-motion running pulse', () => {
  it('pulses the running status ring by default', async () => {
    const el = (await fixture(html`<lr-flow-node status="running"></lr-flow-node>`)) as LyraFlowNode;
    expect(el.shadowRoot!.querySelector('.card')!.hasAttribute('data-pulse')).to.be.true;
  });

  it('renders a static ring instead under prefers-reduced-motion', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as typeof window.matchMedia;
    try {
      const el = (await fixture(html`<lr-flow-node status="running"></lr-flow-node>`)) as LyraFlowNode;
      expect(el.shadowRoot!.querySelector('.card')!.hasAttribute('data-pulse')).to.be.false;
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

describe('--lr-flow-node-selected-border', () => {
  it('retints the selected card border via the cssprop', async () => {
    const el = (await fixture(html`<lr-flow-node heading="Fetch" selected></lr-flow-node>`)) as LyraFlowNode;
    el.style.setProperty('--lr-flow-node-selected-border', 'rgb(10, 20, 30)');
    await el.updateComplete;
    const card = el.shadowRoot!.querySelector('.card') as HTMLElement;
    expect(getComputedStyle(card).borderTopColor).to.equal('rgb(10, 20, 30)');
  });

  it('renders byte-identically to the brand token default when unset', async () => {
    const el = (await fixture(html`<lr-flow-node heading="Fetch" selected></lr-flow-node>`)) as LyraFlowNode;
    await el.updateComplete;
    const card = el.shadowRoot!.querySelector('.card') as HTMLElement;
    const unset = getComputedStyle(card).borderTopColor;
    el.style.setProperty('--lr-flow-node-selected-border', 'var(--lr-color-brand)');
    expect(getComputedStyle(card).borderTopColor).to.equal(unset);
  });

  it('is accessible with a selected, retinted card', async () => {
    const el = (await fixture(
      html`<lr-flow-node heading="Fetch" status="success" selected></lr-flow-node>`,
    )) as LyraFlowNode;
    el.style.setProperty('--lr-flow-node-selected-border', 'var(--lr-color-brand)');
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
