import { expect, fixture, html } from '@open-wc/testing';
import { normalizeLyraSpans, type LyraSpan, type LyraTraceTree } from './trace-tree.js';
import '../span-waterfall/span-waterfall.js';
import '../agent-trace/agent-trace.js';
import type { LyraSpanWaterfall } from '../span-waterfall/span-waterfall.js';
import type { LyraAgentTrace } from '../agent-trace/agent-trace.js';

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
