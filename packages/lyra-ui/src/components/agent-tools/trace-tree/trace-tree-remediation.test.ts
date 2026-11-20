import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import { expect, fixture, html } from '@open-wc/testing';
import { normalizeLyraSpans, type LyraSpan, type LyraTraceTree } from '../../lr-trace-tree.js';
import '../../lr-span-waterfall.js';
import '../../lr-agent-trace.js';
import type { LyraSpanWaterfall } from '../../lr-span-waterfall.js';
import type { LyraAgentTrace } from '../../lr-agent-trace.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const spans: LyraSpan[] = [
  { id: ' \t\n', name: 'Blank identity', kind: 'tool', startMs: 0, endMs: 1, status: 'success' },
  { id: '\u00a0', name: 'Unicode blank identity', kind: 'tool', startMs: 0, endMs: 1, status: 'success' },
  { id: ' business ', name: 'Retained identity', kind: 'tool', startMs: 0, endMs: 1, status: 'success' },
  { id: ' business ', name: 'Duplicate identity', kind: 'tool', startMs: 0, endMs: 1, status: 'success' },
];

it('omits blank span ids through the public normalizer without trimming admitted business identities', () => {
  const result = normalizeLyraSpans(spans);
  expect(result.spans.map((span) => span.id)).to.deep.equal([' business ']);
  expect(result.spans[0]!.name).to.equal('Retained identity');
  expect([...result.byId.keys()]).to.deep.equal([' business ']);
});

it('uses the same nonblank projection in trace-tree', async () => {
  const el = await fixture<LyraTraceTree>(html`<lr-trace-tree .spans=${spans}></lr-trace-tree>`);
  expect([...el.shadowRoot!.querySelectorAll('[part="row"]')].map((row) => row.getAttribute('data-id'))).to.deep.equal([' business ']);
});

it('uses the same nonblank projection in span-waterfall', async () => {
  const el = await fixture<LyraSpanWaterfall>(html`<lr-span-waterfall .spans=${spans}></lr-span-waterfall>`);
  expect([...el.shadowRoot!.querySelectorAll('[part="bar"]')].map((row) => row.getAttribute('data-id'))).to.deep.equal([' business ']);
});

it('uses the same nonblank projection through the composed agent-trace tree', async () => {
  const el = await fixture<LyraAgentTrace>(html`<lr-agent-trace .spans=${spans}></lr-agent-trace>`);
  const tree = el.shadowRoot!.querySelector<LyraTraceTree>('lr-trace-tree')!;
  await tree.updateComplete;
  expect([...tree.shadowRoot!.querySelectorAll('[part="row"]')].map((row) => row.getAttribute('data-id'))).to.deep.equal([' business ']);
});

it('ignores modified and composing keys on the tree without cancelling them', async () => {
  const el = await fixture<LyraTraceTree>(html`<lr-trace-tree .spans=${[
    { id: 'root', name: 'Root', kind: 'agent', startMs: 0, endMs: 10, status: 'success' },
    { id: 'child', name: 'Child', kind: 'tool', startMs: 1, endMs: 5, status: 'success' },
  ]}></lr-trace-tree>`);
  const tree = el.shadowRoot!.querySelector('[role="tree"]') as HTMLElement;
  for (const init of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }]) {
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true, ...init });
    tree.dispatchEvent(event);
    expect(event.defaultPrevented).to.equal(false);
  }
  const plain = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true });
  tree.dispatchEvent(plain);
  expect(plain.defaultPrevented).to.equal(true);
});

it('paints the active row and bar track with system-colour edges under forced colors', async () => {
  try {
    await setForcedColors('active');
    const el = await fixture<LyraTraceTree>(html`<lr-trace-tree active-span-id="a" .spans=${[
      { id: 'a', name: 'A', kind: 'agent', startMs: 0, endMs: 10, status: 'success' },
    ]}></lr-trace-tree>`);
    const row = el.shadowRoot!.querySelector('[part="row"][data-active]') as HTMLElement;
    const track = el.shadowRoot!.querySelector('[part="bar-track"]') as HTMLElement;
    expect(getComputedStyle(row).outlineStyle).to.equal('solid');
    expect(getComputedStyle(track).outlineStyle).to.equal('solid');
    const fill = track.querySelector('[part="bar"]')!;
    expect(getComputedStyle(fill).borderTopStyle).to.equal('solid');
    expect(getComputedStyle(fill).backgroundColor).to.not.equal(getComputedStyle(track).backgroundColor);
  } finally {
    await setForcedColors('none');
  }
});

const insetFocusRing = (el: HTMLElement): boolean => {
  const style = getComputedStyle(el);
  return parseFloat(style.outlineOffset) <= -parseFloat(style.outlineWidth);
};

it('draws the row toggle focus ring inside the scrolling base', async () => {
  const el = await fixture<LyraTraceTree>(html`<lr-trace-tree .spans=${[
    { id: 'root', name: 'Root', kind: 'agent', startMs: 0, endMs: 10, status: 'success' },
    { id: 'child', parentId: 'root', name: 'Child', kind: 'tool', startMs: 1, endMs: 5, status: 'success' },
  ]}></lr-trace-tree>`);
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]:not([hidden])') as HTMLElement;
  await focusByKeyboard(toggle);
  expect(insetFocusRing(toggle)).to.equal(true);
});

it('keeps a near-zero span visible and drops metric tracks that are switched off', async () => {
  const data: LyraSpan[] = [
    { id: 'long', name: 'Long', kind: 'llm', startMs: 0, endMs: 10_000, status: 'success' },
    { id: 'blip', name: 'Blip', kind: 'tool', startMs: 5_000, endMs: 5_000, status: 'success' },
  ];
  const el = await fixture<LyraTraceTree>(html`<lr-trace-tree style="inline-size: 900px" .spans=${data}></lr-trace-tree>`);
  const bar = el.shadowRoot!.querySelector<HTMLElement>('[part="row"][data-id="blip"] [part="bar"]')!;
  expect(bar.getBoundingClientRect().width >= 1.5).to.equal(true);
  const row = el.shadowRoot!.querySelector<HTMLElement>('[part="row"]')!;
  const tracks = () => getComputedStyle(row).gridTemplateColumns.split(' ').length;
  expect(tracks()).to.equal(7);
  const duration = row.querySelector<HTMLElement>('[part="duration"]')!.getBoundingClientRect();
  const rowEnd = row.getBoundingClientRect().right - parseFloat(getComputedStyle(row).paddingRight);
  expect(Math.abs(rowEnd - duration.right) < 1).to.equal(true);
  el.withTokens = true;
  el.withCost = true;
  await el.updateComplete;
  expect(tracks()).to.equal(10);
});

it('uses the host accessible name on its inner region', async () => {
  const el = await fixture(html`<lr-trace-tree aria-label="Run history" label="Visible"></lr-trace-tree>`);
  expect(el.shadowRoot!.querySelector('[role="tree"]')!.getAttribute('aria-label')).to.equal('Run history');
});

it('applies card and plain frames and reflects compact density', async () => {
  const el = await fixture<HTMLElement & { updateComplete: Promise<boolean>; frame: string; size: string }>(html`<lr-trace-tree></lr-trace-tree>`);
  el.frame = 'card';
  el.size = 's';
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(el.getAttribute('size')).to.equal('s');
  expect(getComputedStyle(base).borderTopStyle).to.equal('solid');
  el.frame = 'plain';
  await el.updateComplete;
  expect(getComputedStyle(base).borderTopWidth).to.equal('0px');
});

it('uses the themed row hover color', async () => {
  const el = await fixture(html`<lr-trace-tree .spans=${spans} style="--lr-trace-tree-row-hover-bg: rgb(5, 10, 15)"></lr-trace-tree>`);
  const target = el.shadowRoot!.querySelector<HTMLElement>('[part="row"]')!;
  try {
    await hoverUntilMatched(target, 'row hover');
    expect(getComputedStyle(target).backgroundColor).to.equal('rgb(5, 10, 15)');
  } finally { await resetMouse(); }
});

it('keeps the shortest span inside the timeline at its final timestamp in both directions', async () => {
  const spans: LyraSpan[] = [
    { id: 'range', name: 'Range', kind: 'tool', status: 'success', startMs: 0, endMs: 100 },
    { id: 'end', name: 'End', kind: 'tool', status: 'success', startMs: 100, endMs: 100 },
  ];
  for (const dir of ['ltr', 'rtl']) {
    const el = await fixture<LyraTraceTree>(html`<lr-trace-tree dir=${dir} style="inline-size: 900px" .spans=${spans}></lr-trace-tree>`);
    const track = el.shadowRoot!.querySelector('[data-id="end"] [part="bar-track"]')!;
    const bar = track.firstElementChild!.getBoundingClientRect();
    const bounds = track.getBoundingClientRect();
    expect(bar.width).to.be.at.least(2);
    expect(bar.left).to.be.at.least(bounds.left - 0.1);
    expect(bar.right).to.be.at.most(bounds.right + 0.1);
  }
});
