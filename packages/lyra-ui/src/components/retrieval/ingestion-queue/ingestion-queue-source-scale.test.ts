import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sendKeys } from '@web/test-runner-commands';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { sinkTexts } from '../../../../test/announcements.js';
import './ingestion-queue.js';
import type { LyraIngestionQueue, IngestionQueueSource, IngestionQueueItem } from './ingestion-queue.class.js';
import type { LyraPagination } from '../../data/pagination/pagination.class.js';
import type { LyraSourceRecord } from '../../../data-sources.js';
const entry = (order: number): LyraSourceRecord<IngestionQueueItem> => ({ key: `q${order}`, order,
  value: { id: `q${order}`, document: { id: `d${order}`, name: `Document ${order}` }, stage: order % 2 ? 'queued' : 'failed', error: `Historical failure ${order}`, attempts: 2 } });
function source(): IngestionQueueSource { return { revision: 1,
  query: async ({ page, pageSize }) => ({ total: 1_000_000, rows: Array.from({ length: Math.min(pageSize, Math.max(0, 1_000_000 - page * pageSize)) }, (_, i) => entry(page * pageSize + i)) }),
  lookup: async keys => keys.map(key => entry(Number(key.slice(1)))), locate: async key => Number(key.slice(1)) }; }
async function page(el: LyraIngestionQueue, name: string): Promise<LyraPagination> {
  await waitUntil(() => el.shadowRoot!.querySelector('[part="item-name"]')?.textContent === name);
  const pager = el.shadowRoot!.querySelector<LyraPagination>('lr-pagination')!; await pager.updateComplete; return pager;
}
it('reaches first, middle and final million-record pages through the mounted queue pager', async () => {
  const provider = source(); const query = provider.query; const pages: number[] = [];
  provider.query = request => { pages.push(request.page); expect(Object.keys(request.query)).to.deep.equal([]); return query(request); };
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .dataSource=${provider}></lr-ingestion-queue>`);
  let pager = await page(el, 'Document 0'); expect(el.sourceTotal).to.equal(1_000_000); expect(el.items.length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(100);
  let input = pager.shadowRoot!.querySelector<HTMLInputElement>('[part="page-input"]')!;
  input.value = '5001'; input.dispatchEvent(new Event('change')); pager = await page(el, 'Document 500000');
  input = pager.shadowRoot!.querySelector<HTMLInputElement>('[part="page-input"]')!;
  input.value = '10000'; input.dispatchEvent(new Event('change')); await page(el, 'Document 999900');
  expect(el.shadowRoot!.querySelectorAll('[part="item-name"]')[99]?.textContent).to.equal('Document 999999');
  expect(el.sourcePage).to.equal(9999); expect(pages).to.deep.equal([0, 5000, 9999]);
  recordScaleMeasurement('lr-ingestion-queue', 'n=1000000 source first middle final pages', {
    sourceTotal: el.sourceTotal!, retainedInputRows: el.items.length, mountedQueueRows: el.shadowRoot!.querySelectorAll('[part="item"]').length,
    providerQueries: pages.length,
  });
});
it('keeps pending totals unknown and exposes no old actionable rows before replacement', async () => {
  const provider = source(); const query = provider.query;
  let release!: (result: Awaited<ReturnType<IngestionQueueSource['query']>>) => void;
  provider.query = request => request.page === 0 ? query(request) : new Promise(resolve => { release = resolve; });
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .dataSource=${provider}></lr-ingestion-queue>`);
  await page(el, 'Document 0'); const oldButton = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!;
  let events = 0; el.addEventListener('lr-retry', () => events++); el.sourcePage = 1; oldButton.click();
  await el.updateComplete; const pager = el.shadowRoot!.querySelector<LyraPagination>('lr-pagination')!;
  expect(el.sourceTotal).to.equal(null); expect(pager.total).to.equal(-1); expect(pager.disabled).to.equal(true);
  expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(0); expect(events).to.equal(0);
  await waitUntil(() => release !== undefined); release({ total: 101, rows: [entry(100)] }); await page(el, 'Document 100');
  expect(el.sourceTotal).to.equal(101);
});
it('leaves historical failures quiet across browsing, explicit refresh and reconnect even with announce', async () => {
  const provider = source(); const query = provider.query; let queries = 0;
  provider.query = request => { queries++; return query(request); };
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue announce .dataSource=${provider}></lr-ingestion-queue>`);
  await page(el, 'Document 0'); el.sourcePage = 1; await page(el, 'Document 100');
  el.requestUpdate(); await waitUntil(() => queries === 3); await page(el, 'Document 100');
  const parent = el.parentNode!; el.remove(); parent.appendChild(el); await waitUntil(() => queries === 4); await page(el, 'Document 100');
  expect(sinkTexts('assertive').some(text => text.includes('Historical failure'))).to.equal(false);
  expect(el.shadowRoot!.querySelector('[part="failure-live"]')?.textContent?.trim() ?? '').to.equal('');
});
it('preserves current row retry/cancel payloads and keeps page retry separate', async () => {
  const provider = source(); let fail = false;
  provider.query = async () => { if (fail) throw new Error('Raw provider detail'); return { total: 2, rows: [entry(0), entry(1)] }; };
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .dataSource=${provider} .strings=${{ tableLoadFailed: 'Queue unavailable', retry: 'Try again' }}></lr-ingestion-queue>`);
  await page(el, 'Document 0'); const retries: unknown[] = []; const cancels: unknown[] = [];
  el.addEventListener('lr-retry', e => retries.push(e.detail)); el.addEventListener('lr-cancel', e => cancels.push(e.detail));
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!.click();
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="cancel-button"]')!.click();
  expect(retries).to.deep.equal([{ itemId: 'q0', attempt: 3 }]); expect(cancels).to.deep.equal([{ itemId: 'q1' }]);
  fail = true; el.requestUpdate(); await waitUntil(() => el.shadowRoot!.querySelector('[part="source-retry"]') !== null);
  expect(el.shadowRoot!.textContent).to.include('Queue unavailable'); expect(el.shadowRoot!.textContent).not.to.include('Raw provider detail');
  fail = false; el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-retry"]')!.click(); await page(el, 'Document 0');
  expect(retries.length).to.equal(1);
});
it('preserves unset defaults and restores legacy items, while invalid present sources fail closed', async () => {
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .items=${[entry(7).value]}></lr-ingestion-queue>`);
  expect(el.dataSource).to.equal(undefined); expect(el.virtualizeAt).to.equal(100);
  expect(el.shadowRoot!.querySelector('[part="item-name"]')?.textContent).to.equal('Document 7');
  el.dataSource = source(); await page(el, 'Document 0'); expect(el.items[0]?.id).to.equal('q7');
  const oldButton = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!;
  let staleActions = 0; el.addEventListener('lr-retry', () => staleActions++);
  el.dataSource = undefined; await el.updateComplete; oldButton.click(); expect(staleActions).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="item-name"]')?.textContent).to.equal('Document 7');
  el.dataSource = {} as IngestionQueueSource; await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="source-retry"]')).not.to.equal(null);
  expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(0);
});
it('bounds ignored-abort page work to one physical request and the latest intent', async () => {
  const provider = source(); const pending: { page: number; signal: AbortSignal; release: (value: Awaited<ReturnType<IngestionQueueSource['query']>>) => void }[] = [];
  provider.query = request => new Promise(release => pending.push({ page: request.page, signal: request.signal, release }));
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .dataSource=${provider}></lr-ingestion-queue>`);
  await waitUntil(() => pending.length === 1);
  for (let i = 1; i <= 100; i++) el.sourcePage = i;
  expect(pending[0]!.signal.aborted).to.equal(true); expect(pending.length).to.equal(1); expect(el.sourceTotal).to.equal(null);
  pending[0]!.release({ total: 1_000_000, rows: Array.from({ length: 100 }, (_, i) => entry(i)) });
  await waitUntil(() => pending.length === 2); expect(pending[1]!.page).to.equal(100);
  pending[1]!.release({ total: 1_000_000, rows: Array.from({ length: 100 }, (_, i) => entry(10000 + i)) });
  await page(el, 'Document 10000'); expect(pending.length).to.equal(2);
});
it('reuses provider pages on named paints and bypasses legacy item normalization', async () => {
  const provider = source(); const query = provider.query; let queries = 0;
  provider.query = request => { queries++; return query(request); };
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .dataSource=${provider}></lr-ingestion-queue>`);
  await page(el, 'Document 0');
  const runtime = el as unknown as { normalizeItems: (value: unknown) => IngestionQueueItem[] };
  const normalize = runtime.normalizeItems; let admissions = 0;
  runtime.normalizeItems = value => { admissions++; return normalize.call(el, value); };
  el.label = 'Queue'; el.strings = { ingestionStageFailed: 'Failed stage' }; await el.updateComplete;
  expect(queries).to.equal(1); expect(admissions).to.equal(0);
  el.dataSource = provider; await waitUntil(() => queries === 2); await page(el, 'Document 0');
  el.requestUpdate(); await waitUntil(() => queries === 3); await page(el, 'Document 0');
  const parent = el.parentNode!; el.remove(); parent.appendChild(el); await waitUntil(() => queries === 4); await page(el, 'Document 0');
  expect(queries).to.equal(4); expect(admissions).to.equal(0);
});
it('corrects a stale page once and keeps a settled empty total distinct from unknown', async () => {
  const provider = source(); const pages: number[] = []; let empty = false;
  provider.query = async ({ page, pageSize }) => { pages.push(page); const total = empty ? 0 : 103;
    return { total, rows: Array.from({ length: Math.min(pageSize, Math.max(0, total - page * pageSize)) }, (_, i) => entry(page * pageSize + i)) }; };
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .dataSource=${provider} .sourcePage=${9999}></lr-ingestion-queue>`);
  await page(el, 'Document 100'); expect(pages).to.deep.equal([9999, 1]); expect(el.sourcePage).to.equal(1);
  empty = true; el.dataSource = provider; await waitUntil(() => el.sourceTotal === 0); await el.updateComplete;
  expect(el.shadowRoot!.querySelector<LyraPagination>('lr-pagination')!.total).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="source-retry"]') === null).to.equal(true);
});
it('fails provider rejections without an Error value visibly instead of treating them as empty', async () => {
  const provider = source(); provider.query = () => Promise.reject(undefined);
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .dataSource=${provider}></lr-ingestion-queue>`);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="source-retry"]') !== null);
  expect(el.sourceTotal).to.equal(null); expect(el.shadowRoot!.querySelector('lr-empty') === null).to.equal(true);
});
it('rejects accessor or oversized source rows without invoking getters or showing a silent prefix', async () => {
  const provider = source(); let getters = 0;
  const row = { ...entry(0).value }; Object.defineProperty(row, 'document', { get() { getters++; return entry(0).value.document; } });
  provider.query = async () => ({ total: 1, rows: [{ ...entry(0), value: row }] });
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .dataSource=${provider}></lr-ingestion-queue>`);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="source-retry"]') !== null); expect(getters).to.equal(0);
  provider.query = async () => ({ total: 1, rows: [{ ...entry(0), value: { ...entry(0).value, error: 'x'.repeat(65537) } }] });
  el.dataSource = provider; await el.updateComplete; await waitUntil(() => el.shadowRoot!.querySelector('[part="source-retry"]') !== null);
  expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(0);
});

it('bounds a raised page size to500 and virtualizes the admitted page independently of the global count', async () => {
  const provider = source(); const query = provider.query; const sizes: number[] = [];
  provider.query = request => { sizes.push(request.pageSize); return query(request); };
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .dataSource=${provider} .sourcePageSize=${900000}></lr-ingestion-queue>`);
  await waitUntil(() => el.sourceTotal === 1_000_000); await el.updateComplete;
  const list = el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!; await list.updateComplete;
  expect(sizes).to.deep.equal([500]); expect(list.items.length).to.equal(500); expect(list.renderedRows.length).to.be.lessThan(100);
  el.sourcePage = 2; await waitUntil(() => sizes.length === 2); el.sourcePageSize = 1;
  await page(el, 'Document 0'); expect(el.sourcePage).to.equal(0); expect(sizes[sizes.length - 1]).to.equal(1);
});
it('keeps source actions keyboard accessible in RTL and forwards pager strings without leaking child events', async () => {
  const provider = source(); provider.query = async () => ({ total: 1, rows: [entry(0)] });
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue dir="rtl" .dataSource=${provider} .strings=${{ paginationLabel: 'Queue pages' }}></lr-ingestion-queue>`);
  const pager = await page(el, 'Document 0'); let retries = 0; let leaked = 0;
  el.addEventListener('lr-retry', () => retries++); el.addEventListener('lr-activate', () => leaked++);
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!;
  await focusByKeyboard(button); await sendKeys({ press: 'Enter' }); expect(retries).to.equal(1);
  expect(pager.strings.paginationLabel).to.equal('Queue pages');
  pager.dispatchEvent(new CustomEvent('lr-activate', { bubbles: true, composed: true, detail: { value: 1 } })); expect(leaked).to.equal(0);
  await expect(el).to.be.accessible();
});
it('repaints a nonstring failure fallback after a strings override without refetching source rows', async () => {
  const provider = source(); let queries = 0;
  provider.query = async () => { queries++; return { total: 1, rows: [{ ...entry(0), value: { ...entry(0).value, error: {} as string } }] }; };
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .dataSource=${provider} .strings=${{ ingestionStageFailed: 'Initial failure' }}></lr-ingestion-queue>`);
  await page(el, 'Document 0'); expect(el.shadowRoot!.querySelector('[part="item-error"]')?.textContent).to.equal('Initial failure');
  el.strings = { ingestionStageFailed: 'Updated failure' }; await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="item-error"]')?.textContent).to.equal('Updated failure'); expect(queries).to.equal(1);
});
it('revokes retained provider retry controls after replacement, clear and disconnect', async () => {
  const failed = source(); failed.query = () => Promise.reject(undefined);
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue .dataSource=${failed}></lr-ingestion-queue>`);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="source-retry"]') !== null);
  const obsolete = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-retry"]')!;
  const replacement = source(); const query = replacement.query; let calls = 0;
  replacement.query = request => { calls++; return query(request); };
  el.dataSource = replacement; await page(el, 'Document 0'); obsolete.click(); await el.updateComplete;
  await new Promise(resolve => setTimeout(resolve, 20)); expect(calls).to.equal(1);
  let failures = 0; failed.query = () => { failures++; return Promise.reject(undefined); };
  el.dataSource = failed; await el.updateComplete; await waitUntil(() => el.shadowRoot!.querySelector('[part="source-retry"]') !== null);
  const current = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-retry"]')!;
  const parent = el.parentNode!; el.remove(); current.click(); parent.appendChild(el);
  await waitUntil(() => failures === 2); await el.updateComplete;
  const disconnectedCalls = failures; current.click(); await el.updateComplete;
  await new Promise(resolve => setTimeout(resolve, 20)); expect(failures).to.equal(disconnectedCalls);
  const live = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-retry"]')!;
  live.click(); await waitUntil(() => failures === disconnectedCalls + 1);
  await el.updateComplete; el.dataSource = undefined; await el.updateComplete; live.click(); await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-pagination') === null).to.equal(true); expect(failures).to.equal(disconnectedCalls + 1);
});

it('stops old row descriptor reads when an early descriptor changes the source page', async () => {
  const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue></lr-ingestion-queue>`);
  const provider = source(); const query = provider.query;
  let invalidated = false; let laterReads = 0;
  const value = new Proxy(entry(0).value, {
    getOwnPropertyDescriptor(target, key) {
      if (key === 'id' && !invalidated) { invalidated = true; el.sourcePage = 1; }
      if (key === 'document') laterReads++;
      return Reflect.getOwnPropertyDescriptor(target, key);
    }
  });
  provider.query = request => request.page === 0
    ? Promise.resolve({ total: 1_000_000, rows: [{ ...entry(0), value }, ...Array.from({ length: 99 }, (_, i) => entry(i + 1))] })
    : query(request);
  el.dataSource = provider;
  await page(el, 'Document 100');
  expect(invalidated).to.equal(true); expect(laterReads).to.equal(0);
  expect(el.sourcePage).to.equal(1); expect(el.sourceTotal).to.equal(1_000_000);
});
