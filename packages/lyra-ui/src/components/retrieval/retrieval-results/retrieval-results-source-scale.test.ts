import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sendKeys } from '@web/test-runner-commands';
import { expect, fixture, html, waitUntil, nextFrame } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './retrieval-results.js';
import type { LyraRetrievalResults, RetrievalResultsSource } from './retrieval-results.class.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import type { LyraPagination } from '../../data/pagination/pagination.class.js';
import type { LyraCheckbox } from '../../forms/checkbox/checkbox.class.js';
import type { RetrievalChunk } from '../../../ai/types.js';
const entry = (order: number) => ({ key: `c${order}`, order, value: { id: `c${order}`, text: `Text ${order}`, score: (order % 100) / 100, source: { id: 'source', name: `Source ${order}` } } });
function source(): RetrievalResultsSource { return { revision: 1,
  query: async ({ page, pageSize, query }) => ({ total: 1_000_000, rows: Array.from({ length: Math.min(pageSize, Math.max(0, 1_000_000 - page * pageSize)) }, (_, i) => entry(page * pageSize + i)),
    groups: query.grouping === 'none' ? [] : [{ key: 'source', label: 'Global source', startIndex: 0, itemCount: 1_000_000 }] }),
  lookup: async keys => keys.map(key => entry(Number(key.slice(1)))), locate: async key => Number(key.slice(1)) }; }
async function list(el: LyraRetrievalResults, id: string): Promise<LyraVirtualList> {
  await waitUntil(() => el.sourceTotal !== null && !!el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')?.items.some(item => (item as RetrievalChunk).id === id));
  const result = el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!; await result.updateComplete; return result;
}
async function checkbox(el: LyraRetrievalResults, id: string): Promise<LyraCheckbox> {
  const virtual = await list(el, id);
  await waitUntil(() => !!virtual.shadowRoot!.querySelector(`[data-chunk-id="${id}"][part="select"]`));
  return virtual.shadowRoot!.querySelector<LyraCheckbox>(`[data-chunk-id="${id}"][part="select"]`)!;
}
it('reaches million-result first middle final pages through the pager preserving provider order', async () => {
  const provider = source(); const query = provider.query; const calls: number[] = [];
  provider.query = request => { calls.push(request.page); return query(request); };
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .dataSource=${provider}></lr-retrieval-results>`);
  let virtual = await list(el, 'c0'); expect((virtual.items[0] as RetrievalChunk).id).to.equal('c0');
  for (const page of [5001, 10000]) { const pager = el.shadowRoot!.querySelector<LyraPagination>('lr-pagination')!; await pager.updateComplete;
    const input = pager.shadowRoot!.querySelector<HTMLInputElement>('[part="page-input"]')!; input.value = String(page); input.dispatchEvent(new Event('change'));
    virtual = await list(el, `c${(page - 1) * 100}`); }
  virtual.scrollToIndex(99, { align: 'end', behavior: 'auto' }); await waitUntil(() => !!virtual.shadowRoot!.querySelector('[data-chunk-id="c999999"]'));
  expect(calls).to.deep.equal([0, 5000, 9999]); expect(el.chunks.length).to.equal(0); expect(virtual.renderedRows.length).to.be.lessThan(40);
  recordScaleMeasurement('lr-retrieval-results', 'n=1000000 source first middle final pages', {
    sourceTotal: el.sourceTotal!, retainedChunks: el.chunks.length, providerQueries: calls.length, mountedRows: virtual.renderedRows.length,
  });
});
it('resolves10000 canonical selected IDs in20 bounded batches independently of page query changes', async () => {
  const provider = source(); const lookup = provider.lookup; const sizes: number[] = [];
  provider.lookup = (keys, context) => { sizes.push(keys.length); return lookup(keys, context); };
  const selected = Array.from({ length: 10000 }, (_, i) => `c${900000 + i}`);
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .selectedChunkIds=${selected} .dataSource=${provider}></lr-retrieval-results>`);
  await list(el, 'c0'); await waitUntil(() => sizes.length === 20 && !el.shadowRoot!.querySelector('[part="source-selection-status"]'));
  expect(sizes).to.deep.equal(Array(20).fill(500)); expect(el.selectedChunkIds.length).to.equal(10000);
  el.sourcePage = 2; await list(el, 'c200'); el.sort = 'none'; await list(el, 'c0'); expect(sizes.length).to.equal(20);
});
it('uses occurrence keys for rows but canonical lookup records and order for selection events', async () => {
  const provider = source(); provider.query = async () => ({ total: 2, rows: [0, 1].map(i => ({ key: `occ${i}`, order: i, value: { ...entry(9).value, text: `Occurrence ${i}` } })) });
  provider.lookup = async keys => keys.map(key => ({ ...entry(Number(key.slice(1))), value: { ...entry(Number(key.slice(1))).value, text: 'Canonical record' } }));
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results without-dedupe .dataSource=${provider}></lr-retrieval-results>`);
  const control = await checkbox(el, 'c9'); const events: RetrievalChunk[][] = []; el.addEventListener('lr-selection-change', e => events.push([...e.detail.chunks]));
  control.click(); await waitUntil(() => events.length === 1); expect(events[0]!.map(c => c.text)).to.deep.equal(['Canonical record']);
  expect(el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!.items.length).to.equal(2); expect(el.selectedChunkIds).to.deep.equal(['c9']);
});
it('locates the final active canonical ID once without overriding manual pages', async () => {
  const provider = source(); let locates = 0; const locate = provider.locate; provider.locate = (...args) => { locates++; return locate(...args); };
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .dataSource=${provider}></lr-retrieval-results>`);
  await list(el, 'c0'); el.activeChunkId = 'c999999'; await list(el, 'c999999');
  await waitUntil(() => !!el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!.shadowRoot!.querySelector('[data-chunk-id="c999999"]'));
  el.sourcePage = 1; await list(el, 'c100'); expect(locates).to.equal(1); expect(el.activeChunkId).to.equal('c999999');
});
it('fails closed for a present invalid source and restores legacy chunks when unset', async () => {
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .chunks=${[entry(1).value]} .dataSource=${{} as RetrievalResultsSource}></lr-retrieval-results>`);
  await waitUntil(() => !!el.shadowRoot!.querySelector('[part="source-retry"]')); expect(el.shadowRoot!.querySelector('[data-chunk-id]') === null).to.equal(true);
  el.dataSource = undefined; await el.updateComplete; expect(el.shadowRoot!.querySelector('[data-chunk-id="c1"]') !== null).to.equal(true); expect(el.sourceTotal).to.equal(null);
});
it('forwards global grouping callbacks without invoking them on page-local rows', async () => {
  const provider = source(); const query = provider.query; let callbacks = 0; const forbidden = () => { callbacks++; throw new Error('Partial group'); };
  provider.query = request => { expect(request.query.groupBy).to.equal(forbidden); expect(request.query.groupLabel).to.equal(forbidden); return query(request); };
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results grouping="custom" .sourcePage=${5000} .dataSource=${provider} .groupBy=${forbidden} .groupLabel=${forbidden}></lr-retrieval-results>`);
  const virtual = await list(el, 'c500000'); expect(callbacks).to.equal(0); expect(virtual.groups![0]!.label).to.equal('Global source');
});
it('keeps unknown totals and stale rows non-actionable while100 ignored-abort pages coalesce', async () => {
  const provider = source(); const query = provider.query; const pending: { page: number; signal: AbortSignal; release: (result: Awaited<ReturnType<RetrievalResultsSource['query']>>) => void }[] = [];
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .dataSource=${provider}></lr-retrieval-results>`);
  const old = await checkbox(el, 'c0'); let events = 0; el.addEventListener('lr-selection-change', () => events++);
  provider.query = request => new Promise(release => pending.push({ page: request.page, signal: request.signal, release }));
  el.sourcePage = 1; await waitUntil(() => pending.length === 1);
  for (let i = 2; i <= 101; i++) el.sourcePage = i;
  old.click(); await el.updateComplete; expect(events).to.equal(0); expect(pending[0]!.signal.aborted).to.equal(true);
  expect(el.sourceTotal).to.equal(null); expect(el.shadowRoot!.querySelector<LyraPagination>('lr-pagination')!.total).to.equal(-1);
  pending[0]!.release(await query({ page: 1, pageSize: 100, query: { sort: 'score', withoutDedupe: false, grouping: 'none', groupBy: undefined, groupLabel: undefined, groupOrder: undefined }, signal: new AbortController().signal, locale: 'en', revision: 1 }));
  await waitUntil(() => pending.length === 2); expect(pending[1]!.page).to.equal(101);
  pending[1]!.release({ total: 1_000_000, rows: Array.from({ length: 100 }, (_, i) => entry(10100 + i)) }); await list(el, 'c10100'); expect(pending.length).to.equal(2);
});
it('keeps pending selection intent and canonical cache through independent page retry and query changes', async () => {
  const provider = source(); let release!: (rows: ReturnType<typeof entry>[]) => void; let lookups = 0;
  provider.lookup = () => { lookups++; return new Promise(resolve => { release = resolve; }); };
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .dataSource=${provider}></lr-retrieval-results>`);
  const control = await checkbox(el, 'c0'); const events: string[][] = []; el.addEventListener('lr-selection-change', e => events.push([...e.detail.selectedChunkIds]));
  control.click(); await waitUntil(() => lookups === 1); el.sort = 'none'; await list(el, 'c0');
  expect(el.shadowRoot!.querySelector('[part="source-selection-status"]') !== null).to.equal(true); expect(events.length).to.equal(0);
  release([entry(0)]); await waitUntil(() => events.length === 1); expect(events).to.deep.equal([['c0']]);
  const query = provider.query; provider.query = () => Promise.reject(new Error('Private failure'));
  el.sourcePage = 1; await waitUntil(() => !!el.shadowRoot!.querySelector('[part="source-retry"]'));
  provider.query = query; el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-retry"]')!.click(); await list(el, 'c100'); expect(lookups).to.equal(1);
});
it('fails canonical lookup identities closed and retries only selection without emitting partial records', async () => {
  const provider = source(); let lookups = 0; let queries = 0; const query = provider.query;
  provider.query = request => { queries++; return query(request); };
  provider.lookup = async () => { lookups++; return [{ ...entry(0), value: entry(1).value }]; };
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results without-dedupe .dataSource=${provider}></lr-retrieval-results>`);
  const control = await checkbox(el, 'c0'); let events = 0; el.addEventListener('lr-selection-change', () => events++); control.click();
  await waitUntil(() => !!el.shadowRoot!.querySelector('[part="source-selection-retry"]')); expect(events).to.equal(0); expect(el.selectedChunkIds).to.deep.equal(['c0']);
  provider.lookup = async () => { lookups++; return [entry(0)]; }; el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-selection-retry"]')!.click();
  await waitUntil(() => events === 1); expect(lookups).to.equal(2); expect(queries).to.equal(1);
});
it('does not transfer pending user selection events to an external controlled assignment', async () => {
  const provider = source(); const pending: { keys: readonly string[]; release: (rows: ReturnType<typeof entry>[]) => void }[] = [];
  provider.lookup = keys => new Promise(release => pending.push({ keys, release }));
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .dataSource=${provider}></lr-retrieval-results>`);
  const control = await checkbox(el, 'c0'); let events = 0; el.addEventListener('lr-selection-change', () => events++); control.click(); await waitUntil(() => pending.length === 1);
  el.selectedChunkIds = ['c9']; await el.updateComplete; pending[0]!.release([entry(0)]); await waitUntil(() => pending.length === 2); pending[1]!.release([entry(9)]);
  await waitUntil(() => !el.shadowRoot!.querySelector('[part="source-selection-status"]')); expect(events).to.equal(0); expect(el.selectedChunkIds).to.deep.equal(['c9']);
});
it('reconciles globally absent selected IDs silently after reconnect with exactly one replay lookup', async () => {
  const provider = source(); let lookups = 0; provider.lookup = async () => { lookups++; return lookups === 1 ? [entry(9)] : []; };
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .selectedChunkIds=${['c9']} .dataSource=${provider}></lr-retrieval-results>`);
  await list(el, 'c0'); await waitUntil(() => !el.shadowRoot!.querySelector('[part="source-selection-status"]')); let events = 0; el.addEventListener('lr-selection-change', () => events++);
  const parent = el.parentNode!; el.remove(); parent.appendChild(el); await waitUntil(() => el.selectedChunkIds.length === 0); expect(lookups).to.equal(2); expect(events).to.equal(0);
});
it('does not emit a pending user transaction after disconnect and authoritative replay', async () => {
  const provider = source(); const pending: ((rows: ReturnType<typeof entry>[]) => void)[] = [];
  provider.lookup = () => new Promise(resolve => pending.push(resolve));
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .dataSource=${provider}></lr-retrieval-results>`);
  const control = await checkbox(el, 'c0'); let events = 0; el.addEventListener('lr-selection-change', () => events++); control.click(); await waitUntil(() => pending.length === 1);
  const parent = el.parentNode!; el.remove(); parent.appendChild(el); pending[0]!([entry(0)]); await waitUntil(() => pending.length === 2); pending[1]!([]);
  await waitUntil(() => el.selectedChunkIds.length === 0); expect(events).to.equal(0);
});
it('suppresses the deprecated alias when a selection listener supersedes source authority', async () => {
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .dataSource=${source()}></lr-retrieval-results>`);
  const control = await checkbox(el, 'c0'); let aliases = 0; let events = 0;
  el.addEventListener('lr-selection-change', () => { events++; el.dataSource = source(); }); el.addEventListener('lr-select', () => aliases++);
  control.click(); await waitUntil(() => events === 1); await list(el, 'c0'); expect(aliases).to.equal(0);
});
it('uses canonical source order for complete selected records while preserving explicit ID order', async () => {
  const provider = source(); provider.lookup = async keys => keys.map(key => entry(Number(key.slice(1)))).reverse();
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .dataSource=${provider} .selectedChunkIds=${['c90', 'c30']}></lr-retrieval-results>`);
  const control = await checkbox(el, 'c0'); await waitUntil(() => !control.disabled);
  const details: { ids: readonly string[]; chunks: readonly RetrievalChunk[] }[] = [];
  el.addEventListener('lr-selection-change', e => details.push({ ids: e.detail.selectedChunkIds, chunks: e.detail.chunks }));
  control.click(); await waitUntil(() => details.length === 1); expect(details[0]!.ids).to.deep.equal(['c90', 'c30', 'c0']); expect(details[0]!.chunks.map(c => c.id)).to.deep.equal(['c0', 'c30', 'c90']);
});
it('does not refresh on named paints and does refresh once on same-source/keyless assignment', async () => {
  const provider = source(); const query = provider.query; let calls = 0; provider.query = request => { calls++; return query(request); };
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results has-more .dataSource=${provider}></lr-retrieval-results>`);
  await list(el, 'c0'); el.presentation = 'compact'; el.label = 'Other'; await el.updateComplete; expect(calls).to.equal(1);
  let loadMore = 0; el.addEventListener('lr-load-more', () => loadMore++); await nextFrame(); expect(loadMore).to.equal(0);
  el.dataSource = provider; await waitUntil(() => calls === 2); await list(el, 'c0'); el.requestUpdate(); await waitUntil(() => calls === 3); await list(el, 'c0'); expect(calls).to.equal(3);
});
it('rejects oversized required text and grouped pages with missing coverage', async () => {
  const provider = source(); provider.query = async () => ({ total: 1, rows: [{ ...entry(0), value: { ...entry(0).value, text: 'x'.repeat(65537) } }] });
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .dataSource=${provider}></lr-retrieval-results>`);
  await waitUntil(() => !!el.shadowRoot!.querySelector('[part="source-retry"]')); expect(el.sourceTotal).to.equal(null);
  provider.query = async () => ({ total: 1, rows: [entry(0)] }); el.grouping = 'source'; el.dataSource = provider;
  await el.updateComplete; await waitUntil(() => !!el.shadowRoot!.querySelector('[part="source-retry"]')); expect(el.shadowRoot!.querySelector('lr-virtual-list') === null).to.equal(true);
});
it('preserves a pending user selection transaction across a failed page retry', async () => {
  const provider = source(); let release!: (rows: ReturnType<typeof entry>[]) => void; let lookups = 0;
  provider.lookup = () => { lookups++; return new Promise(resolve => { release = resolve; }); };
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .dataSource=${provider}></lr-retrieval-results>`);
  const control = await checkbox(el, 'c0'); let events = 0; el.addEventListener('lr-selection-change', () => events++); control.click(); await waitUntil(() => lookups === 1);
  const query = provider.query; provider.query = () => Promise.reject(undefined); el.sourcePage = 1;
  await waitUntil(() => !!el.shadowRoot!.querySelector('[part="source-retry"]')); provider.query = query;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-retry"]')!.click(); await list(el, 'c100');
  release([entry(0)]); await waitUntil(() => !el.shadowRoot!.querySelector('[part="source-selection-status"]'));
  expect(events).to.equal(1); expect(lookups).to.equal(1);
});
it('keeps duplicate canonical selection across occurrence pages and locates the first occurrence', async () => {
  const provider = source(); provider.query = async ({ page }) => ({ total: 2, rows: [{ key: `occ${page}`, order: page, value: entry(9).value }] }); provider.locate = async () => 0;
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results without-dedupe source-page-size="1" .dataSource=${provider}></lr-retrieval-results>`);
  const first = await checkbox(el, 'c9'); first.click(); await waitUntil(() => !first.disabled); el.sourcePage = 1; await list(el, 'c9');
  const second = await checkbox(el, 'c9'); expect(second.checked).to.equal(true);
  el.activeChunkId = 'c9'; await waitUntil(() => el.sourcePage === 0); await list(el, 'c9'); expect(el.selectedChunkIds).to.deep.equal(['c9']);
});
it('uses one corrective request and normalizes the published page after a total shrinks', async () => {
  const provider = source(); const calls: number[] = []; provider.query = async ({ page }) => { calls.push(page); return { total: 1, rows: page === 0 ? [entry(0)] : [] }; };
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results source-page="9999" .dataSource=${provider}></lr-retrieval-results>`);
  await list(el, 'c0'); expect(calls).to.deep.equal([9999, 0]); expect(el.sourcePage).to.equal(0);
});
it('preserves500 bounded provider groups and does not allocate a logical million-row model', async () => {
  const provider = source(); provider.query = async ({ page, pageSize }) => ({ total: 1_000_000,
    rows: Array.from({ length: pageSize }, (_, i) => entry(page * pageSize + i)),
    groups: Array.from({ length: pageSize }, (_, i) => ({ key: `g${i}`, label: `Group ${i}`, startIndex: page * pageSize + i, itemCount: 1 })) });
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results grouping="source" source-page="1000" source-page-size="500" .dataSource=${provider}></lr-retrieval-results>`);
  const virtual = await list(el, 'c500499'); expect(virtual.items.length).to.equal(500); expect(virtual.groups!.length).to.equal(500);
  virtual.scrollToIndex(499, { align: 'end', behavior: 'auto' }); await waitUntil(() => !!virtual.shadowRoot!.querySelector('[data-chunk-id="c500499"]')); expect(virtual.renderedRows.length).to.be.lessThan(40);
});
it('revokes a queued source reveal when source removal restores the legacy list', async () => {
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results virtualize-at="0" .chunks=${[entry(0).value]} .dataSource=${source()}></lr-retrieval-results>`);
  const virtual = await list(el, 'c0'); let release!: () => void; let awaited = 0;
  const pending = new Promise<boolean>(resolve => { release = () => resolve(true); });
  Object.defineProperty(virtual, 'updateComplete', { configurable: true, get: () => { awaited++; return pending; } });
  const original = virtual.scrollToIndex; let scrolls = 0; virtual.scrollToIndex = (...args) => { scrolls++; original.apply(virtual, args); };
  try { el.activeChunkId = 'c1'; await waitUntil(() => awaited > 0); el.dataSource = undefined; await el.updateComplete; scrolls = 0; release(); await nextFrame(); await nextFrame(); expect(scrolls).to.equal(0); }
  finally { Reflect.deleteProperty(virtual, 'updateComplete'); virtual.scrollToIndex = original; release(); }
});
it('supports real keyboard checkbox and chunk-open activation in RTL without leaking child events', async () => {
  const provider = source(); provider.query = async () => ({ total: 1, rows: [entry(0)] });
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results dir="rtl" .dataSource=${provider} .strings=${{ paginationLabel: 'Result pages' }}></lr-retrieval-results>`);
  const control = await checkbox(el, 'c0'); await waitUntil(() => !control.disabled); let selections = 0; const opened: string[] = [];
  el.addEventListener('lr-selection-change', () => selections++); el.addEventListener('lr-chunk-open', e => opened.push(e.detail.chunkId));
  await focusByKeyboard(control); await sendKeys({ press: 'Space' }); await waitUntil(() => selections === 1);
  const virtual = await list(el, 'c0'); const inspector = virtual.shadowRoot!.querySelector('lr-chunk-inspector')!;
  await focusByKeyboard(inspector.shadowRoot!.querySelector<HTMLButtonElement>('[part="open-button"]')!); await sendKeys({ press: 'Enter' });
  expect(opened).to.deep.equal(['c0']); expect(el.shadowRoot!.querySelector<LyraPagination>('lr-pagination')!.strings.paginationLabel).to.equal('Result pages'); await expect(el).to.be.accessible();
});
it('renders localized loading error retry and selection status with no raw provider error', async () => {
  const provider = source(); let reject!: (error: unknown) => void; provider.query = () => new Promise((_resolve, fail) => { reject = fail; });
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .dataSource=${provider} .strings=${{ loading: 'Pending results', tableLoadFailed: 'Result failure', retry: 'Try results', sourceSelectionLoading: 'Pending selection', sourceSelectionFailed: 'Selection failure' }}></lr-retrieval-results>`);
  await waitUntil(() => !!reject); expect(el.shadowRoot!.querySelector('[part="source-status"]')!.textContent).to.include('Pending results');
  reject(new Error('Secret provider message')); await waitUntil(() => !!el.shadowRoot!.querySelector('[part="source-retry"]'));
  expect(el.shadowRoot!.textContent).to.include('Result failure'); expect(el.shadowRoot!.textContent).not.to.include('Secret provider message'); expect(el.shadowRoot!.querySelector('[part="source-retry"]')!.textContent).to.equal('Try results');
  provider.query = async () => ({ total: 1, rows: [entry(0)] }); provider.lookup = () => Promise.reject(undefined);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-retry"]')!.click(); const control = await checkbox(el, 'c0'); control.click();
  await waitUntil(() => !!el.shadowRoot!.querySelector('[part="source-selection-retry"]')); expect(el.shadowRoot!.querySelector('[part="source-selection-status"]')!.textContent).to.include('Selection failure');
});
it('reconciles selection after adoption without stale user events or extra physical lookups', async () => {
  const provider = source(); let lookups = 0; provider.lookup = async () => { lookups++; return lookups === 1 ? [entry(9)] : []; };
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .selectedChunkIds=${['c9']} .dataSource=${provider}></lr-retrieval-results>`);
  await list(el, 'c0'); await waitUntil(() => !el.shadowRoot!.querySelector('[part="source-selection-status"]'));
  let events = 0; el.addEventListener('lr-selection-change', () => events++); const frame = document.createElement('iframe'); document.body.appendChild(frame);
  try { frame.contentDocument!.body.appendChild(frame.contentDocument!.adoptNode(el)); await waitUntil(() => el.selectedChunkIds.length === 0); expect(lookups).to.equal(2); expect(events).to.equal(0); }
  finally { el.remove(); frame.remove(); }
});
it('revokes old row open and retry controls after source replacement', async () => {
  const provider = source(); const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .dataSource=${provider}></lr-retrieval-results>`);
  const virtual = await list(el, 'c0'); await checkbox(el, 'c0'); const inspector = virtual.shadowRoot!.querySelector('lr-chunk-inspector')!; const old = inspector.shadowRoot!.querySelector<HTMLButtonElement>('[part="open-button"]')!;
  let opens = 0; el.addEventListener('lr-chunk-open', () => opens++); el.dataSource = source(); old.click(); await list(el, 'c0'); expect(opens).to.equal(0);
  provider.query = () => Promise.reject(undefined); el.dataSource = provider; await waitUntil(() => !!el.shadowRoot!.querySelector('[part="source-retry"]'));
  const retry = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-retry"]')!; const replacement = source(); let queries = 0; const query = replacement.query;
  replacement.query = request => { queries++; return query(request); }; el.dataSource = replacement; await list(el, 'c0'); retry.click(); await nextFrame(); expect(queries).to.equal(1);
});
it('emits complete canonical records for a10000-ID selection transaction without snapshot-budget loss', async () => {
  const opaque = { payload: { label: 'Caller metadata' } }; const provider = source();
  provider.lookup = async keys => keys.map(key => { const row = entry(Number(key.slice(1))); return { ...row, value: { ...row.value, metadata: opaque } }; });
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .dataSource=${provider} .selectedChunkIds=${Array.from({ length: 10000 }, (_, i) => `c${i}`)}></lr-retrieval-results>`);
  const control = await checkbox(el, 'c0'); await waitUntil(() => !control.disabled);
  let received = false; let detail: { chunks: readonly RetrievalChunk[]; selectedChunkIds: readonly string[] } | null = null;
  el.addEventListener('lr-selection-change', e => { received = true; detail = e.detail; }); control.click(); await waitUntil(() => received);
  expect(detail === null).to.equal(false); const accepted = detail! as { chunks: readonly RetrievalChunk[]; selectedChunkIds: readonly string[] };
  expect(accepted.chunks.length).to.equal(9999); expect(accepted.selectedChunkIds.length).to.equal(9999); expect(accepted.chunks[9998]!.id).to.equal('c9999');
  expect(Object.isFrozen(accepted.chunks)).to.equal(true); expect(Object.isFrozen(accepted.chunks[0])).to.equal(true);
  expect(accepted.chunks[0]!.metadata === opaque).to.equal(true); expect(Object.isFrozen(opaque)).to.equal(false);
});
it('normalizes duplicate and blank controlled IDs without losing unresolved off-page canonical selection', async () => {
  const provider = source(); const requested: string[][] = []; const lookup = provider.lookup;
  provider.lookup = (keys, context) => { requested.push([...keys]); return lookup(keys, context); };
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .dataSource=${provider} .selectedChunkIds=${['c999999', '', 'c999999', '  ']}></lr-retrieval-results>`);
  await list(el, 'c0'); await waitUntil(() => !el.shadowRoot!.querySelector('[part="source-selection-status"]'));
  expect(el.selectedChunkIds).to.deep.equal(['c999999']); expect(requested).to.deep.equal([['c999999']]);
});
it('keeps legacy selection record metadata detached and deeply frozen for both event names', async () => {
  const metadata = { nested: { label: 'Original' } }; const chunk = { ...entry(0).value, metadata };
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .chunks=${[chunk]}></lr-retrieval-results>`);
  const details: { chunks: readonly RetrievalChunk[] }[] = [];
  el.addEventListener('lr-selection-change', e => details.push(e.detail)); el.addEventListener('lr-select', e => details.push(e.detail));
  el.shadowRoot!.querySelector<LyraCheckbox>('[part="select"]')!.click(); expect(details.length).to.equal(2);
  for (const detail of details) {
    expect(detail.chunks[0] === chunk).to.equal(false); expect(detail.chunks[0]!.metadata === metadata).to.equal(false);
    expect(Object.isFrozen(detail.chunks)).to.equal(true); expect(Object.isFrozen(detail.chunks[0])).to.equal(true);
    expect(Object.isFrozen(detail.chunks[0]!.metadata!['nested'])).to.equal(true);
  }
  metadata.nested.label = 'Changed'; expect((details[0]!.chunks[0]!.metadata!['nested'] as { label: string }).label).to.equal('Original');
});
it('preserves legacy null event details when the entire selection exceeds the shared deep-copy budget', async () => {
  const chunks = Array.from({ length: 10000 }, (_, i) => entry(i).value);
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results sort="none" .chunks=${chunks} .selectedChunkIds=${chunks.map(c => c.id)}></lr-retrieval-results>`);
  const virtual = el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!; await virtual.updateComplete;
  const details: unknown[] = []; el.addEventListener('lr-selection-change', e => details.push(e.detail)); el.addEventListener('lr-select', e => details.push(e.detail));
  virtual.shadowRoot!.querySelector<LyraCheckbox>('[data-chunk-id="c0"][part="select"]')!.click();
  expect(details).to.deep.equal([null, null]);
});
for (const virtual of [false, true]) {
  it(`revokes legacy ${virtual ? 'virtual forwarding' : 'footer'} load-more at source entry and preserves current legacy requests`, async () => {
    const chunks = Array.from({ length: virtual ? 100 : 1 }, (_, i) => entry(i).value);
    const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results grouping="none" has-more .chunks=${chunks}></lr-retrieval-results>`);
    const old = el.shadowRoot!.querySelector<HTMLElement>(virtual ? 'lr-virtual-list' : '[part="load-more"]')!;
    const request = (target: HTMLElement) => virtual ? target.dispatchEvent(new CustomEvent('lr-load-more', { bubbles: true, composed: true })) : target.click();
    let events = 0; el.addEventListener('lr-load-more', () => events++); request(old); expect(events).to.equal(1);
    const provider = source(); provider.query = async () => ({ total: 0, rows: [] });
    el.dataSource = provider; request(old); expect(events).to.equal(1);
    await waitUntil(() => el.sourceTotal === 0); await el.updateComplete; request(old); expect(events).to.equal(1);
    el.dataSource = undefined; await el.updateComplete;
    const current = el.shadowRoot!.querySelector<HTMLElement>(virtual ? 'lr-virtual-list' : '[part="load-more"]')!;
    request(old); expect(events).to.equal(1); request(current); expect(events).to.equal(2);
    el.hasMore = false; request(current); expect(events).to.equal(2);
  });
}
it('revokes the selection alias when a revision getter replaces the provider during its final guard', async () => {
  const provider = source(); const replacement = source(); let armed = false; let swaps = 0;
  let el!: LyraRetrievalResults;
  Object.defineProperty(provider, 'revision', { get() { if (armed) { armed = false; swaps++; el.dataSource = replacement; } return 1; } });
  el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .dataSource=${provider}></lr-retrieval-results>`);
  const control = await checkbox(el, 'c0'); await waitUntil(() => !control.disabled); let events = 0; let aliases = 0;
  el.addEventListener('lr-selection-change', () => { events++; armed = true; }); el.addEventListener('lr-select', () => aliases++);
  control.click(); await waitUntil(() => swaps === 1); await el.updateComplete;
  expect(events).to.equal(1); expect(el.dataSource === replacement).to.equal(true); expect(aliases).to.equal(0);
});

it('stops obsolete source descriptor capture when an early field navigates pages', async () => {
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results grouping="none" .sourcePageSize=${1}></lr-retrieval-results>`);
  let navigated = false; let laterReads = 0;
  const row = entry(0);
  row.value = new Proxy(row.value, { getOwnPropertyDescriptor(target, key) {
    if (key === 'id' && !navigated) { navigated = true; el.sourcePage = 1; }
    else if (key === 'text') laterReads++;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  const provider = source();
  provider.query = async ({ page }) => ({ total: 2, rows: [page === 0 ? row : entry(1)] });
  el.dataSource = provider;
  const virtual = await list(el, 'c1');
  expect(laterReads).to.equal(0); expect(el.sourcePage).to.equal(1);
  expect(virtual.items.length).to.equal(1); expect(el.shadowRoot!.querySelector('[part="source-retry"]') === null).to.equal(true);
});
it('keeps canonical selection projection current when its descriptor changes only the page', async () => {
  const provider = source(); const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results .dataSource=${provider}></lr-retrieval-results>`);
  const control = await checkbox(el, 'c0'); let navigated = false; let textReads = 0;
  const row = entry(0);
  row.value = new Proxy(row.value, { getOwnPropertyDescriptor(target, key) {
    if (key === 'id' && !navigated) { navigated = true; el.sourcePage = 1; }
    else if (key === 'text') textReads++;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  provider.lookup = async () => [row];
  const events: string[][] = []; el.addEventListener('lr-selection-change', event => events.push([...event.detail.selectedChunkIds]));
  control.click(); await list(el, 'c100'); await waitUntil(() => events.length === 1);
  expect(textReads).to.equal(1); expect(events).to.deep.equal([['c0']]);
  expect(el.selectedChunkIds).to.deep.equal(['c0']); expect(el.shadowRoot!.querySelector('[part="source-selection-retry"]') === null).to.equal(true);
});
for (const field of ['quote', 'rect'] as const) {
  it(`rejects object-valued locator ${field} scalars before traversing nested caller data`, async () => {
    const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results grouping="none" .sourcePageSize=${1}></lr-retrieval-results>`);
    let nestedReads = 0;
    const nested = new Proxy({ first: 'first', later: 'later' }, { getOwnPropertyDescriptor(target, key) {
      nestedReads++;
      if (key === 'first') el.sourcePage = 1;
      return Reflect.getOwnPropertyDescriptor(target, key);
    } });
    const locator = field === 'quote' ? { kind: 'text-quote', quote: nested } : { kind: 'region', rect: { x: nested, y: 0, width: 1, height: 1 } };
    const old = { ...entry(0), value: { ...entry(0).value, locator } };
    const provider = source();
    provider.query = async ({ page }) => ({ total: 2, rows: [page === 0 ? old : entry(1)] }) as Awaited<ReturnType<RetrievalResultsSource['query']>>;
    el.dataSource = provider;
    await waitUntil(() => el.sourceTotal === 2 || !!el.shadowRoot!.querySelector('[part="source-retry"]'));
    expect(nestedReads).to.equal(0); expect(el.sourcePage).to.equal(0);
    expect(el.sourceTotal).to.equal(null); expect(el.shadowRoot!.querySelectorAll('[part="source-retry"]').length).to.equal(1);
  });
}
it('preserves supported locator scalars, rects and paths while leaving metadata opaque', async () => {
  const locators: NonNullable<RetrievalChunk['locator']>[] = [
    { kind: 'page', page: 3 }, { kind: 'text-quote', quote: 'Quote', prefix: 'Before', suffix: 'After', page: 2 },
    { kind: 'fragment', id: 'heading' }, { kind: 'line-range', start: 2, end: 8 },
    { kind: 'cell-range', sheet: 'Sheet1', range: 'A1:B2' }, { kind: 'cfi', cfi: 'epubcfi(/6/2)' },
    { kind: 'time-range', start: 1.5, end: 4 }, { kind: 'region', page: 2, rect: { x: 1, y: 2, width: 3, height: 4 } },
    { kind: 'node-path', path: ['items', 2, 'name'] },
  ];
  const metadata = { provenance: { id: 'original' } };
  const provider = source(); provider.query = async () => ({ total: locators.length,
    rows: locators.map((locator, index) => ({ ...entry(index), value: { ...entry(index).value, locator, metadata } })) });
  const el = await fixture<LyraRetrievalResults>(html`<lr-retrieval-results grouping="none" .dataSource=${provider}></lr-retrieval-results>`);
  const virtual = await list(el, 'c8');
  expect(virtual.items.map(item => (item as RetrievalChunk).locator)).to.deep.equal(locators);
  expect(virtual.items.every(item => (item as RetrievalChunk).metadata === metadata)).to.equal(true);
});
