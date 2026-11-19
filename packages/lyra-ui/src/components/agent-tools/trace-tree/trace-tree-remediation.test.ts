import { expect, fixture, html } from '@open-wc/testing';
import { normalizeLyraSpans, type LyraSpan, type LyraTraceTree } from './trace-tree.js';
import '../span-waterfall/span-waterfall.js';
import '../agent-trace/agent-trace.js';
import type { LyraSpanWaterfall } from '../span-waterfall/span-waterfall.js';
import type { LyraAgentTrace } from '../agent-trace/agent-trace.js';
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
