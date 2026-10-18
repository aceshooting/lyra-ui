import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sendKeys } from '@web/test-runner-commands';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './document-library.js';
import type { LyraDocumentLibrary, DocumentLibrarySource, LibraryDocument } from './document-library.class.js';
import type { LyraTable } from '../table/table.class.js';
import type { LyraSourceRecord } from '../../../data-sources.js';
const entry = (order: number): LyraSourceRecord<LibraryDocument> => ({ key: `d${order}`, order, value: { id: `d${order}`, name: `Document ${order}`, tags: ['row-tag'] } });
const tags = { total: 1, values: [{ key: 'global', label: 'Global tag' }], unavailableSelected: [] };
function source(): DocumentLibrarySource { return { revision: 1,
  query: async ({ page, pageSize }) => ({ total: 1_000_000, rows: Array.from({ length: Math.min(pageSize, 1_000_000 - page * pageSize) }, (_, i) => entry(page * pageSize + i)), tags }),
  lookup: async keys => keys.map(key => entry(Number(key.slice(1)))), locate: async key => Number(key.slice(1)) }; }
async function table(el: LyraDocumentLibrary, first: string) {
  await waitUntil(() => el.shadowRoot?.querySelector<LyraTable<LibraryDocument>>('lr-table')?.rows[0]?.id === first);
  const result = el.shadowRoot!.querySelector<LyraTable<LibraryDocument>>('lr-table')!; await result.updateComplete; return result;
}
it('reaches first, middle and final million-source pages through the mounted document table', async () => {
  const provider = source(); const calls: number[] = []; const query = provider.query;
  provider.query = request => { calls.push(request.page); return query(request); };
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library .dataSource=${provider}></lr-document-library>`);
  const grid = await table(el, 'd0'); expect(el.sourceTotal).to.equal(1_000_000); expect(grid.rows.length).to.equal(100);
  const pager = grid.shadowRoot!.querySelector('lr-pagination')!;
  const jump = pager.shadowRoot!.querySelector<HTMLInputElement>('[part="page-input"]')!;
  jump.value = '5001'; jump.dispatchEvent(new Event('change')); await table(el, 'd500000');
  const finalJump = grid.shadowRoot!.querySelector('lr-pagination')!.shadowRoot!.querySelector<HTMLInputElement>('[part="page-input"]')!;
  finalJump.value = '10000'; finalJump.dispatchEvent(new Event('change')); await table(el, 'd999900');
  expect(grid.rows[99]?.id).to.equal('d999999'); expect(el.sourcePage).to.equal(9999); expect(grid.page).to.equal(10000);
  expect(calls).to.deep.equal([0, 5000, 9999]); expect(el.documents.length).to.equal(0);
  expect(el.shadowRoot!.querySelector('lr-option')?.textContent).to.include('Global tag');
  recordScaleMeasurement('lr-document-library', 'n=1000000 source first middle final pages', {
    sourceTotal: el.sourceTotal!, retainedDocuments: el.documents.length, pageRows: grid.rows.length, providerQueries: calls.length,
  });
});
it('preserves off-page selections using twenty lookup batches and does not refetch on named paints', async () => {
  const provider = source(); let queries = 0; const batches: number[] = []; const query = provider.query;
  provider.query = request => { queries++; return query(request); };
  provider.lookup = async keys => { batches.push(keys.length); return keys.map(key => entry(Number(key.slice(1)))); };
  const ids = Array.from({ length: 10_000 }, (_, i) => `d${900_000 + i}`);
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library .selectedDocumentIds=${ids} .dataSource=${provider}></lr-document-library>`);
  await table(el, 'd0'); await waitUntil(() => batches.length === 20); await el.updateComplete;
  expect(el.selectedDocumentIds.length).to.equal(10_000); expect(batches).to.deep.equal(Array(20).fill(500));
  el.loading = true; await el.updateComplete; el.loading = false; await el.updateComplete;
  expect(queries).to.equal(1); el.sourcePage = 5000; await table(el, 'd500000');
  expect(el.selectedDocumentIds.length).to.equal(10_000); expect(batches.length).to.equal(20);
});
it('uses global provider query/order/count without applying legacy filtering or sorting', async () => {
  const provider = source(); let filterCalls = 0; const counts: number[] = [];
  const filter = () => { filterCalls++; return false; };
  provider.query = async request => ({ total: request.query.searchTerm ? 2 : 1_000_000,
    rows: request.query.searchTerm ? [entry(9), entry(1)] : Array.from({ length: 100 }, (_, i) => entry(i)), tags });
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library .dataSource=${provider} .filter=${filter}></lr-document-library>`);
  await table(el, 'd0'); el.addEventListener('lr-filter-change', e => counts.push(e.detail.matchCount));
  const input = el.shadowRoot!.querySelector('lr-input')!;
  input.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'not-in-any-row' } }));
  const grid = await table(el, 'd9'); expect(grid.rows.map(row => row.id)).to.deep.equal(['d9', 'd1']);
  expect(filterCalls).to.equal(0); expect(counts).to.deep.equal([2]);
});
it('keeps legacy input unchanged when source is unset, restores it on removal and fails a present invalid source closed', async () => {
  const legacy = [{ id: 'legacy', name: 'Legacy' }];
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library .documents=${legacy}></lr-document-library>`);
  await table(el, 'legacy'); expect(el.dataSource).to.equal(undefined);
  el.dataSource = source(); await table(el, 'd0'); expect(el.documents[0]?.id).to.equal('legacy');
  el.dataSource = undefined; await table(el, 'legacy');
  el.dataSource = {} as DocumentLibrarySource; await el.updateComplete;
  const grid = el.shadowRoot!.querySelector<LyraTable>('lr-table')!; await grid.updateComplete;
  expect(grid.error).to.equal(true); expect(grid.rows.length).to.equal(0);
});

it('corrects an obsolete page once without querying again after internal repaint', async () => {
  const provider = source(); const pages: number[] = [];
  provider.query = async ({ page, pageSize }) => { pages.push(page); return { total: 123,
    rows: Array.from({ length: Math.min(pageSize, Math.max(0, 123 - page * pageSize)) }, (_, i) => entry(page * pageSize + i)), tags }; };
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library .dataSource=${provider} .sourcePage=${9000}></lr-document-library>`);
  await table(el, 'd100'); await el.updateComplete; await new Promise(resolve => setTimeout(resolve, 30));
  expect(el.sourcePage).to.equal(1); expect(pages).to.deep.equal([9000, 1]);
});
it('refreshes same-source and keyless updates once, then reconnects without stale rows', async () => {
  const provider = source(); let queries = 0; const query = provider.query;
  provider.query = request => { queries++; return query(request); };
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library .dataSource=${provider}></lr-document-library>`);
  await table(el, 'd0'); const parent = el.parentNode!;
  el.dataSource = provider; await table(el, 'd0'); await waitUntil(() => queries === 2);
  el.requestUpdate(); await waitUntil(() => queries === 3); await table(el, 'd0');
  el.remove(); parent.appendChild(el); await waitUntil(() => queries === 4); await table(el, 'd0');
  expect(queries).to.equal(4);
});
it('keeps complete off-page selection when page-select-all toggles mounted checkboxes', async () => {
  const provider = source(); provider.query = async () => ({ total: 2, rows: [entry(0), entry(1)], tags });
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library .dataSource=${provider} .selectedDocumentIds=${['d99']}></lr-document-library>`);
  const grid = await table(el, 'd0'); await waitUntil(() => !el.shadowRoot!.querySelector('[part="selection-status"]'));
  const select = grid.shadowRoot!.querySelector<HTMLElement>('lr-checkbox')!;
  const changes: readonly string[][] = []; el.addEventListener('lr-selection-change', e => (changes as string[][]).push([...e.detail.documentIds]));
  select.click(); await waitUntil(() => changes.length === 1);
  expect(changes[0]).to.deep.equal(['d99', 'd0', 'd1']);
  expect(select.getAttribute('aria-label')).to.equal('Select documents on this page');
});
it('aborts old query authority immediately and never commits its late results or count event', async () => {
  const provider = source(); let release!: (value: Awaited<ReturnType<DocumentLibrarySource['query']>>) => void;
  let signal: AbortSignal | undefined;
  provider.query = request => request.query.searchTerm === 'new' ? Promise.resolve({ total: 1, rows: [entry(8)], tags }) : new Promise(resolve => { release = resolve; signal = request.signal; });
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library .dataSource=${provider}></lr-document-library>`);
  await waitUntil(() => signal !== undefined); el.searchTerm = 'new'; expect(signal!.aborted).to.equal(true);
  expect(el.sourceTotal).to.equal(null); release({ total: 1, rows: [entry(0)], tags });
  const grid = await table(el, 'd8'); expect(grid.rows[0]?.id).to.equal('d8');
});
it('revokes selection interaction notifications when their provider is replaced before lookup completes', async () => {
  const provider = source(); provider.query = async () => ({ total: 1, rows: [entry(0)], tags });
  let release!: (rows: readonly LyraSourceRecord<LibraryDocument>[]) => void;
  provider.lookup = () => new Promise(resolve => { release = resolve; });
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library .dataSource=${provider}></lr-document-library>`);
  const grid = await table(el, 'd0'); await waitUntil(() => !el.shadowRoot!.querySelector('[part="selection-status"]'));
  let events = 0; el.addEventListener('lr-selection-change', () => events++);
  grid.shadowRoot!.querySelector<HTMLElement>('lr-checkbox')!.click(); await waitUntil(() => release !== undefined);
  const replacement = source(); replacement.query = async () => ({ total: 1, rows: [entry(0)], tags });
  el.dataSource = replacement; release([entry(0)]); await table(el, 'd0');
  await waitUntil(() => !el.shadowRoot!.querySelector('[part="selection-status"]'));
  expect(events).to.equal(0); expect(el.selectedDocumentIds).to.deep.equal(['d0']);
});
it('keeps the legacy sortable header connected after a local sort', async () => {
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library .documents=${[{ id: 'b', name: 'B' }, { id: 'a', name: 'A' }]}></lr-document-library>`);
  const grid = el.shadowRoot!.querySelector<LyraTable>('lr-table')!; const header = grid.shadowRoot!.querySelector<HTMLElement>('th[data-col-key="name"]')!;
  header.click(); await el.updateComplete;
  expect(el.sortDir).to.equal('desc');
  expect(header.isConnected).to.equal(true);
  header.click(); await el.updateComplete;
  expect(el.sortDir).to.equal('asc');
});

it('keeps source row tag DOM bounded while displaying every admitted tag', async () => {
  const provider = source(); const row = entry(0);
  provider.query = async () => ({ total: 1, rows: [{ ...row, value: { ...row.value, tags: Array.from({ length: 500 }, (_, i) => `tag${i}`) } }], tags });
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library .dataSource=${provider}></lr-document-library>`);
  const grid = await table(el, 'd0');
  expect(grid.shadowRoot!.querySelectorAll('lr-chip').length).to.equal(0);
  expect(grid.shadowRoot!.textContent).to.include('tag499');
});

it('keeps provider row activation keyboard accessible in RTL and forwards selection status overrides', async () => {
  const provider = source(); provider.query = async () => ({ total: 1, rows: [entry(0)], tags });
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library dir="rtl" .dataSource=${provider} .strings=${{ sourceSelectionLoading: 'Resolving choice', sourceSelectionFailed: 'Choice failed' }}></lr-document-library>`);
  const grid = await table(el, 'd0'); const opened: string[] = [];
  el.addEventListener('lr-open', e => opened.push(e.detail.documentId));
  const button = grid.shadowRoot!.querySelector<HTMLElement>('[part="document-name"]')!;
  await focusByKeyboard(button); await sendKeys({ press: 'Enter' }); expect(opened).to.deep.equal(['d0']);
  let reject!: (reason: unknown) => void;
  provider.lookup = () => new Promise((_resolve, fail) => { reject = fail; });
  el.selectedDocumentIds = ['d99']; await waitUntil(() => el.shadowRoot!.textContent!.includes('Resolving choice'));
  reject(new Error('Do not display raw provider errors'));
  await waitUntil(() => el.shadowRoot!.textContent!.includes('Choice failed'));
  expect(el.shadowRoot!.textContent).not.to.include('Do not display raw provider errors');
});
it('retries a failed page without invalidating the independent selected-key cache', async () => {
  const provider = source(); const query = provider.query; let fail = false; let lookups = 0;
  provider.query = request => fail ? Promise.reject(new Error('Page unavailable')) : query(request);
  provider.lookup = async keys => { lookups++; return keys.map(key => entry(Number(key.slice(1)))); };
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library .dataSource=${provider} .selectedDocumentIds=${['d999999']}></lr-document-library>`);
  const grid = await table(el, 'd0'); await waitUntil(() => !el.shadowRoot!.querySelector('[part="selection-status"]'));
  fail = true; el.sourcePage = 1; await waitUntil(() => grid.error);
  fail = false; grid.dispatchEvent(new CustomEvent('lr-retry-request', { detail: null, bubbles: true, composed: true, cancelable: true }));
  await table(el, 'd100'); expect(lookups).to.equal(1);
  expect(el.selectedDocumentIds).to.deep.equal(['d999999']);
});
it('reconciles globally absent selected documents after reconnect lookup', async () => {
  const provider = source(); let exists = true; let lookups = 0;
  provider.query = async () => ({ total: 1, rows: [entry(0)], tags });
  provider.lookup = async () => { lookups++; return exists ? [entry(0)] : []; };
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library .dataSource=${provider} .selectedDocumentIds=${['d0']}></lr-document-library>`);
  await table(el, 'd0'); await waitUntil(() => lookups === 1 && !el.shadowRoot!.querySelector('[part="selection-status"]'));
  const parent = el.parentNode!; el.remove(); exists = false; parent.appendChild(el);
  await waitUntil(() => lookups === 2 && !el.shadowRoot!.querySelector('[part="selection-status"]'));
  expect(el.selectedDocumentIds).to.deep.equal([]); expect(lookups).to.equal(2);
});
it('keeps an external controlled selection silent when it supersedes a pending user transaction', async () => {
  const provider = source(); provider.query = async () => ({ total: 1, rows: [entry(0)], tags });
  const pending: ((rows: readonly LyraSourceRecord<LibraryDocument>[]) => void)[] = [];
  provider.lookup = () => new Promise(resolve => pending.push(resolve));
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library .dataSource=${provider}></lr-document-library>`);
  const grid = await table(el, 'd0'); await waitUntil(() => !el.shadowRoot!.querySelector('[part="selection-status"]'));
  let events = 0; el.addEventListener('lr-selection-change', () => events++);
  grid.shadowRoot!.querySelector<HTMLElement>('lr-checkbox')!.click(); await waitUntil(() => pending.length === 1);
  el.selectedDocumentIds = ['d99']; pending[0]!([entry(0)]);
  await waitUntil(() => pending.length === 2); pending[1]!([entry(99)]);
  await waitUntil(() => !el.shadowRoot!.querySelector('[part="selection-status"]'));
  expect(el.selectedDocumentIds).to.deep.equal(['d99']); expect(events).to.equal(0);
});
it('revokes a pending user-selection notification across disconnect and reconnect', async () => {
  const provider = source(); provider.query = async () => ({ total: 1, rows: [entry(0)], tags });
  const pending: ((rows: readonly LyraSourceRecord<LibraryDocument>[]) => void)[] = [];
  provider.lookup = () => new Promise(resolve => pending.push(resolve));
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library .dataSource=${provider}></lr-document-library>`);
  const grid = await table(el, 'd0'); await waitUntil(() => !el.shadowRoot!.querySelector('[part="selection-status"]'));
  let events = 0; el.addEventListener('lr-selection-change', () => events++);
  grid.shadowRoot!.querySelector<HTMLElement>('lr-checkbox')!.click(); await waitUntil(() => pending.length === 1);
  const parent = el.parentNode!; el.remove(); parent.appendChild(el); pending[0]!([entry(0)]);
  await waitUntil(() => pending.length === 2); pending[1]!([]);
  await waitUntil(() => !el.shadowRoot!.querySelector('[part="selection-status"]'));
  expect(el.selectedDocumentIds).to.deep.equal([]); expect(events).to.equal(0);
});

it('stops old row descriptor reads when an early descriptor changes the source page', async () => {
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library></lr-document-library>`);
  const provider = source(); const query = provider.query;
  let invalidated = false; let laterReads = 0;
  const value = new Proxy(entry(0).value, {
    getOwnPropertyDescriptor(target, key) {
      if (key === 'id' && !invalidated) { invalidated = true; el.sourcePage = 1; }
      if (key === 'name') laterReads++;
      return Reflect.getOwnPropertyDescriptor(target, key);
    }
  });
  provider.query = request => request.page === 0
    ? Promise.resolve({ total: 1_000_000, rows: [{ ...entry(0), value }, ...Array.from({ length: 99 }, (_, i) => entry(i + 1))], tags })
    : query(request);
  el.dataSource = provider;
  await table(el, 'd100');
  expect(invalidated).to.equal(true); expect(laterReads).to.equal(0);
  expect(el.sourcePage).to.equal(1); expect(el.sourceTotal).to.equal(1_000_000);
});
it('keeps same-revision selection projection current when its descriptor changes only the page', async () => {
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library></lr-document-library>`);
  const provider = source(); let changedPage = false; let nameReads = 0;
  const value = new Proxy(entry(900).value, {
    getOwnPropertyDescriptor(target, key) {
      if (key === 'id' && !changedPage) { changedPage = true; el.sourcePage = 1; }
      if (key === 'name') nameReads++;
      return Reflect.getOwnPropertyDescriptor(target, key);
    }
  });
  provider.lookup = async () => [{ ...entry(900), value }];
  const runtime = el as unknown as { sourcePages: { state: { selectionPending: boolean; selectionError: unknown }; cache: Map<string, LyraSourceRecord<LibraryDocument> | null> } };
  el.selectedDocumentIds = ['d900']; el.dataSource = provider;
  await table(el, 'd100');
  await waitUntil(() => !runtime.sourcePages.state.selectionPending && runtime.sourcePages.cache.get('d900')?.value.name === 'Document 900');
  await el.updateComplete;
  expect(runtime.sourcePages.state.selectionError).to.equal(undefined);
  expect(el.shadowRoot!.querySelectorAll('[part="selection-status"]').length).to.equal(0);
  expect(changedPage).to.equal(true); expect(nameReads).to.equal(1);
  expect(el.selectedDocumentIds).to.deep.equal(['d900']);
});
