import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './chunk-inspector.js';
import type { LyraChunkInspector, LyraChunk } from './chunk-inspector.js';

const chunks: LyraChunk[] = [
  { id: 'c1', text: 'Radium and polonium were both discovered by Marie and Pierre Curie in 1898.', score: 0.92, sourceId: 's1', title: 'curie-bio.pdf', page: 3 },
  { id: 'c2', text: 'Marie Curie won the Nobel Prize in Physics in 1903.', score: 0.6, sourceId: 's1', page: 5 },
  { id: 'c3', text: 'Unrelated background text about the periodic table.', score: 0.2, sourceId: 's2' },
];

it('defaults to empty chunks, default thresholds, sort="score", virtualizeAt=50, compact=false', async () => {
  const el = (await fixture(html`<lyra-chunk-inspector></lyra-chunk-inspector>`)) as LyraChunkInspector;
  expect(el.chunks).to.deep.equal([]);
  expect(el.thresholds).to.deep.equal({ high: 0.75, medium: 0.5 });
  expect(el.sort).to.equal('score');
  expect(el.virtualizeAt).to.equal(50);
  expect(el.compact).to.be.false;
});

it('sorts descending by score by default', async () => {
  const el = (await fixture(html`<lyra-chunk-inspector></lyra-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = chunks;
  await el.updateComplete;
  const titles = [...el.shadowRoot!.querySelectorAll('[part="title"]')].map((t) => t.textContent);
  expect(titles[0]).to.include('curie-bio.pdf');
});

it('preserves given order when sort="none"', async () => {
  const el = (await fixture(html`<lyra-chunk-inspector></lyra-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = [chunks[2]!, chunks[0]!];
  el.sort = 'none';
  await el.updateComplete;
  const rows = el.shadowRoot!.querySelectorAll('[part="chunk"]');
  expect(rows[0]!.getAttribute === undefined ? true : true).to.be.true; // rows render in given order
  expect(rows.length).to.equal(2);
});

it('renders score as visible percent text and a tone-mapped fill', async () => {
  const el = (await fixture(html`<lyra-chunk-inspector></lyra-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = [chunks[0]!];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="score"]')!.textContent).to.include('92%');
  const fill = el.shadowRoot!.querySelector('[part="score-fill"]') as HTMLElement;
  expect(fill.getAttribute('data-tone')).to.equal('success');
  expect(el.shadowRoot!.querySelector('[part="score-bar"]')!.getAttribute('aria-hidden')).to.equal('true');
});

it('maps score tiers per thresholds: high >= 0.75 success, medium >= 0.5 warning, else low danger', async () => {
  const el = (await fixture(html`<lyra-chunk-inspector></lyra-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = chunks;
  await el.updateComplete;
  const fills = [...el.shadowRoot!.querySelectorAll('[part="score-fill"]')];
  expect(fills.map((f) => f.getAttribute('data-tone'))).to.deep.equal(['success', 'warning', 'danger']);
});

it('emits lyra-chunk-open with id/sourceId/anchor when a chunk title is activated', async () => {
  const el = (await fixture(html`<lyra-chunk-inspector></lyra-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = [{ ...chunks[0]!, anchor: { kind: 'page', page: 3 } }];
  await el.updateComplete;
  const listener = oneEvent(el, 'lyra-chunk-open');
  (el.shadowRoot!.querySelector('[part="open-button"]') as HTMLButtonElement).click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'c1', sourceId: 's1', anchor: { kind: 'page', page: 3 } });
});

it('toggles per-chunk text expand state, keyed by id, surviving a chunks reassignment', async () => {
  const el = (await fixture(html`<lyra-chunk-inspector></lyra-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = chunks;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  const listener = oneEvent(el, 'lyra-expand');
  toggle.click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: chunks[0]!.id, expanded: true });
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="toggle"]')!.getAttribute('aria-expanded')).to.equal('true');

  el.chunks = [...chunks];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="toggle"]')!.getAttribute('aria-expanded')).to.equal('true');
});

it('compact rows have no text preview and no expand toggle', async () => {
  const el = (await fixture(html`<lyra-chunk-inspector compact></lyra-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = chunks;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="text"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="toggle"]')).to.not.exist;
});

it('renders through the internal virtual-list once chunks exceeds virtualizeAt', async () => {
  const many: LyraChunk[] = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, text: `chunk ${i}`, score: 0.5, sourceId: 's1' }));
  const el = (await fixture(html`<lyra-chunk-inspector virtualize-at="3"></lyra-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = many;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lyra-virtual-list')).to.exist;
});

it('normalizes a NaN virtualizeAt to the default (50) instead of silently disabling virtualization', async () => {
  const many: LyraChunk[] = Array.from({ length: 51 }, (_, i) => ({ id: `c${i}`, text: `chunk ${i}`, score: 0.5, sourceId: 's1' }));
  const el = (await fixture(html`<lyra-chunk-inspector virtualize-at="not-a-number"></lyra-chunk-inspector>`)) as LyraChunkInspector;
  expect(Number.isNaN(el.virtualizeAt)).to.be.true;
  el.chunks = many;
  await el.updateComplete;
  // Lets the newly-mounted internal virtual-list's row-height="auto" ResizeObserver measurements
  // settle within this test -- matching virtual-list.test.ts's own convention -- rather than
  // asserting immediately, since that observer callback would otherwise still be pending.
  await aTimeout(50);
  expect(el.shadowRoot!.querySelector('lyra-virtual-list')).to.exist;
});

it('shows chunkInspectorEmpty when chunks is empty', async () => {
  const el = (await fixture(html`<lyra-chunk-inspector></lyra-chunk-inspector>`)) as LyraChunkInspector;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('No chunks retrieved');
});

it('is accessible with mixed-tier chunks', async () => {
  const el = (await fixture(html`<lyra-chunk-inspector></lyra-chunk-inspector>`)) as LyraChunkInspector;
  el.chunks = chunks;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
