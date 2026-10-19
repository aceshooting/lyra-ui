import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sendKeys } from '@web/test-runner-commands';
import { expect, fixture, html, waitUntil, nextFrame } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './thread-list.js';
import type { LyraThreadList, ThreadListSource, LyraChatThread } from './thread-list.class.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import type { LyraPagination } from '../../data/pagination/pagination.class.js';
import type { LyraSourceRecord } from '../../../data-sources.js';
const entry = (order: number): LyraSourceRecord<LyraChatThread> => ({ key: `t${order}`, order, value: { id: `t${order}`, title: `Thread ${order}` } });
function source(): ThreadListSource { return { revision: 1,
  query: async ({ page, pageSize, query }) => ({ total: 1_000_000, rows: Array.from({ length: Math.min(pageSize, Math.max(0, 1_000_000 - page * pageSize)) }, (_, i) => entry(page * pageSize + i)),
    groups: query.grouping === 'none' ? [] : [{ key: 'all', label: 'All threads', startIndex: 0, itemCount: 1_000_000 }] }),
  lookup: async keys => keys.map(key => entry(Number(key.slice(1)))), locate: async key => /^t\d+$/.test(key) && Number(key.slice(1)) < 1_000_000 ? Number(key.slice(1)) : null }; }
async function list(el: LyraThreadList, id: string): Promise<LyraVirtualList> {
  await waitUntil(() => el.sourceTotal !== null && !!el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')?.items.some(item => (item as { thread?: LyraChatThread }).thread?.id === id));
  const result = el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!; await result.updateComplete; return result;
}
it('reaches first, middle and final million-thread pages through a real pager without admitting the inventory', async () => {
  const provider = source(); const query = provider.query; const calls: number[] = [];
  provider.query = request => { calls.push(request.page); return query(request); };
  const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .dataSource=${provider}></lr-thread-list>`);
  await list(el, 't0'); let pager = el.shadowRoot!.querySelector<LyraPagination>('lr-pagination')!; await pager.updateComplete;
  let input = pager.shadowRoot!.querySelector<HTMLInputElement>('[part="page-input"]')!; input.value = '5001'; input.dispatchEvent(new Event('change'));
  await list(el, 't500000'); pager = el.shadowRoot!.querySelector<LyraPagination>('lr-pagination')!; await pager.updateComplete;
  input = pager.shadowRoot!.querySelector<HTMLInputElement>('[part="page-input"]')!; input.value = '10000'; input.dispatchEvent(new Event('change'));
  const virtual = await list(el, 't999999'); virtual.scrollToIndex(99, { align: 'end', behavior: 'auto' });
  await waitUntil(() => el.itemElement('t999999') !== null);
  expect(el.sourceTotal).to.equal(1_000_000); expect(el.sourcePage).to.equal(9999); expect(el.threads.length).to.equal(0);
  expect(calls).to.deep.equal([0, 5000, 9999]); expect(virtual.renderedRows.length).to.be.lessThan(40);
  recordScaleMeasurement('lr-thread-list', 'n=1000000 source first middle final pages', {
    sourceTotal: el.sourceTotal!, retainedThreads: el.threads.length, providerQueries: calls.length, mountedRows: virtual.renderedRows.length,
  });
});
it('keeps late-page collapsed groups expandable without changing record totals or page', async () => {
  const el = await fixture<LyraThreadList>(html`<lr-thread-list .dataSource=${source()} .sourcePage=${5000} .collapsedGroupIds=${['all']}></lr-thread-list>`);
  await waitUntil(() => el.sourceTotal === 1_000_000); await el.updateComplete;
  let virtual = el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!; await virtual.updateComplete;
  expect(virtual.items.length).to.equal(1);
  virtual.shadowRoot!.querySelector<HTMLButtonElement>('[part="group-toggle"]')!.click();
  virtual = await list(el, 't500000'); expect(el.sourcePage).to.equal(5000); expect(el.sourceTotal).to.equal(1_000_000);
  el.addEventListener('lr-group-toggle-request', event => event.preventDefault(), { once: true });
  virtual.shadowRoot!.querySelector<HTMLButtonElement>('[part="group-toggle"]')!.click(); await el.updateComplete;
  expect(el.collapsedGroupIds).to.deep.equal([]); expect(virtual.items.length).to.equal(101);
});
it('locates an off-page active thread once and does not undo later manual paging', async () => {
  const provider = source(); let locates = 0; const locate = provider.locate;
  provider.locate = (...args) => { locates++; return locate(...args); };
  const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .dataSource=${provider}></lr-thread-list>`);
  await list(el, 't0'); el.activeConversationId = 't999999'; await list(el, 't999999');
  await waitUntil(() => el.itemElement('t999999') !== null); expect(locates).to.equal(1);
  el.sourcePage = 1; await list(el, 't100'); expect(el.activeConversationId).to.equal('t999999'); expect(locates).to.equal(1);
});
it('forwards global search callbacks and emits the authoritative count without a local filter pass', async () => {
  const provider = source(); let filterCalls = 0; const filter = () => { filterCalls++; return false; };
  provider.query = async ({ query }) => { expect(query.filter).to.equal(filter); return { total: query.search ? 1 : 1_000_000,
    rows: query.search ? [entry(999)] : Array.from({ length: 100 }, (_, i) => entry(i)) }; };
  const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" searchable .dataSource=${provider} .filter=${filter}></lr-thread-list>`);
  await list(el, 't0'); const counts: number[] = []; el.addEventListener('lr-filter-change', e => counts.push(e.detail.matchCount));
  const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!; input.value = 'remote'; input.dispatchEvent(new Event('input'));
  await list(el, 't999'); expect(counts).to.deep.equal([1]); expect(filterCalls).to.equal(0);
});
it('preserves provider row identity in render hooks and suppresses stale row actions after source removal', async () => {
  const provider = source(); const row = entry(0); provider.query = async () => ({ total: 1, rows: [row] });
  const identities: LyraChatThread[] = [];
  const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .dataSource=${provider} .rowActions=${['pin']} .renderMeta=${(thread: LyraChatThread) => { identities.push(thread); return html`<span>Meta</span>`; }}></lr-thread-list>`);
  const virtual = await list(el, 't0'); await waitUntil(() => el.itemElement('t0') !== null);
  expect(identities.every(value => value === row.value)).to.equal(true);
  const button = virtual.shadowRoot!.querySelector<HTMLButtonElement>('[part="row-action"]')!; let pins = 0;
  el.addEventListener('lr-thread-pin', () => pins++); button.click(); expect(pins).to.equal(1);
  el.dataSource = undefined; await el.updateComplete; button.click(); expect(pins).to.equal(1);
});
it('keeps source precedence over slots and restores legacy slotted mode when removed', async () => {
  const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .dataSource=${source()}><lr-conversation-item conversation-id="slotted" label="Slotted"></lr-conversation-item></lr-thread-list>`);
  await list(el, 't0'); expect(el.sourceTotal).to.equal(1_000_000); el.dataSource = undefined;
  await el.updateComplete; await nextFrame(); expect(el.shadowRoot!.querySelector('lr-virtual-list') === null).to.equal(true);
  expect(el.itemElement('slotted')?.conversationId).to.equal('slotted');
});
it('keeps page work bounded and totals unknown while ignored-abort requests settle', async () => {
  const provider = source(); const pending: { page: number; signal: AbortSignal; release: (result: Awaited<ReturnType<ThreadListSource['query']>>) => void }[] = [];
  provider.query = request => new Promise(release => pending.push({ page: request.page, signal: request.signal, release }));
  const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .dataSource=${provider}></lr-thread-list>`);
  await waitUntil(() => pending.length === 1); for (let i = 1; i <= 100; i++) el.sourcePage = i;
  expect(pending[0]!.signal.aborted).to.equal(true); expect(pending.length).to.equal(1); await el.updateComplete;
  expect(el.sourceTotal).to.equal(null); expect(el.shadowRoot!.querySelector<LyraPagination>('lr-pagination')!.total).to.equal(-1);
  pending[0]!.release({ total: 1_000_000, rows: Array.from({ length: 100 }, (_, i) => entry(i)) });
  await waitUntil(() => pending.length === 2); expect(pending[1]!.page).to.equal(100);
  pending[1]!.release({ total: 1_000_000, rows: Array.from({ length: 100 }, (_, i) => entry(10000 + i)) });
  await list(el, 't10000'); expect(pending.length).to.equal(2);
});
it('keeps500 groups bounded and never invokes complete-group callbacks with partial page data', async () => {
  const provider = source(); let callbacks = 0;
  const forbidden = () => { callbacks++; throw new Error('Do not run partial group callbacks'); };
  provider.query = async ({ page, pageSize, query }) => {
    expect(query.groupBy).to.equal(forbidden); expect(query.getGroupLabel).to.equal(forbidden);
    return { total: 1_000_000, rows: Array.from({ length: pageSize }, (_, i) => entry(page * pageSize + i)),
      groups: Array.from({ length: pageSize }, (_, i) => ({ key: `g${page * pageSize + i}`, label: `Group ${i}`, startIndex: page * pageSize + i, itemCount: 1 })) };
  };
  const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="custom" sticky-groups .dataSource=${provider} .sourcePage=${1000} .sourcePageSize=${500} .groupBy=${forbidden} .getGroupLabel=${forbidden} .renderGroupAdornment=${forbidden}></lr-thread-list>`);
  const virtual = await list(el, 't500499'); expect(virtual.items.length).to.equal(1000); expect(callbacks).to.equal(0);
  virtual.scrollToIndex(999, { align: 'end', behavior: 'auto' }); await waitUntil(() => el.itemElement('t500499') !== null);
  expect(virtual.renderedRows.length).to.be.lessThan(40); expect(el.sourceTotal).to.equal(1_000_000);
});
it('reuses pages for named paints, refreshes same-source/keyless once and replays on reconnect', async () => {
  const provider = source(); const query = provider.query; let queries = 0;
  provider.query = request => { queries++; return query(request); };
  const el = await fixture<LyraThreadList>(html`<lr-thread-list .dataSource=${provider}></lr-thread-list>`);
  await list(el, 't0'); el.label = 'Other label'; el.rowActions = ['pin']; el.size = 's'; await el.updateComplete;
  expect(queries).to.equal(1); el.dataSource = provider; await waitUntil(() => queries === 2); await list(el, 't0');
  el.requestUpdate(); await waitUntil(() => queries === 3); await list(el, 't0');
  const parent = el.parentNode!; el.remove(); parent.appendChild(el); await waitUntil(() => queries === 4); await list(el, 't0');
  expect(queries).to.equal(4);
});
it('retains cancelable current error retry and rejects obsolete error controls after replacement', async () => {
  const provider = source(); let calls = 0; provider.query = () => { calls++; return Promise.reject(undefined); };
  const el = await fixture<LyraThreadList>(html`<lr-thread-list .dataSource=${provider}></lr-thread-list>`);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="retry-button"]') !== null);
  const old = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!;
  el.addEventListener('lr-retry-request', event => event.preventDefault(), { once: true }); old.click(); await el.updateComplete; expect(calls).to.equal(1);
  old.click(); await waitUntil(() => calls === 2); await el.updateComplete;
  const stale = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!;
  el.dataSource = source(); await list(el, 't0'); let requests = 0; el.addEventListener('lr-retry-request', () => requests++);
  stale.click(); await el.updateComplete; expect(requests).to.equal(0); expect(el.sourceTotal).to.equal(1_000_000);
});
it('revokes old source group toggles and reentrant group commits when a listener replaces the source', async () => {
  const el = await fixture<LyraThreadList>(html`<lr-thread-list .dataSource=${source()}></lr-thread-list>`);
  const virtual = await list(el, 't0'); const old = virtual.shadowRoot!.querySelector<HTMLButtonElement>('[part="group-toggle"]')!;
  let commits = 0; el.addEventListener('lr-group-toggle', () => commits++);
  el.addEventListener('lr-group-toggle-request', () => { el.dataSource = source(); }, { once: true });
  old.click(); await list(el, 't0'); expect(el.collapsedGroupIds).to.deep.equal([]); expect(commits).to.equal(0);
  old.click(); await el.updateComplete; expect(commits).to.equal(0);
});
it('locates a controlled active ID again after it was cleared and later restored', async () => {
  const provider = source(); let locates = 0; const locate = provider.locate;
  provider.locate = (...args) => { locates++; return locate(...args); };
  const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .dataSource=${provider}></lr-thread-list>`);
  await list(el, 't0'); el.activeConversationId = 't999999'; await list(el, 't999999');
  el.activeConversationId = ''; await el.updateComplete; el.sourcePage = 0; await list(el, 't0');
  el.activeConversationId = 't999999'; await list(el, 't999999'); expect(locates).to.equal(2);
});
it('rejects missing or incomplete global group metadata instead of grouping a partial page locally', async () => {
  const provider = source(); provider.query = async () => ({ total: 1, rows: [entry(0)] });
  const el = await fixture<LyraThreadList>(html`<lr-thread-list .dataSource=${provider}></lr-thread-list>`);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="retry-button"]') !== null); expect(el.sourceTotal).to.equal(null);
  provider.query = async () => ({ total: 2, rows: [entry(0), entry(1)], groups: [{ key: 'partial', label: 'Partial', startIndex: 0, itemCount: 1 }] });
  el.dataSource = provider; await el.updateComplete; await waitUntil(() => el.shadowRoot!.querySelector('[part="retry-button"]') !== null);
  expect(el.shadowRoot!.querySelector('lr-virtual-list') === null).to.equal(true);
});

for (const boundary of ['replacement', 'removal', 'query', 'disconnect'] as const) {
  it(`does not enqueue a stale source count after filter listener ${boundary}`, async () => {
    const provider = source(); provider.query = async ({ query }) => ({ total: query.search ? 1 : 2, rows: query.search ? [entry(99)] : [entry(0), entry(1)] });
    const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" searchable .dataSource=${provider}></lr-thread-list>`);
    await list(el, 't0');
    const region = el.shadowRoot!.querySelector<LyraLiveRegion>('lr-live-region')!;
    const original = region.announce; const messages: string[] = []; let events = 0;
    region.announce = (text, options) => { messages.push(text); original.call(region, text, options); };
    try {
      el.addEventListener('lr-filter-change', () => {
        events++;
        if (boundary === 'replacement') el.dataSource = source();
        else if (boundary === 'removal') el.dataSource = undefined;
        else if (boundary === 'query') el.withArchived = true;
        else el.remove();
      }, { once: true });
      const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;
      input.value = 'remote'; input.dispatchEvent(new Event('input'));
      await waitUntil(() => events === 1); await el.updateComplete;
      expect(messages.length).to.equal(0);
    } finally { region.announce = original; }
  });
}
it('cancels an off-page active lookup when manual paging supersedes its intent', async () => {
  const provider = source(); let release!: (index: number | null) => void; let signal: AbortSignal | undefined;
  provider.locate = (_key, _query, context) => new Promise(resolve => { signal = context.signal; release = resolve; });
  const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .dataSource=${provider}></lr-thread-list>`);
  await list(el, 't0'); el.activeConversationId = 't999999'; await waitUntil(() => signal !== undefined);
  el.sourcePage = 2; expect(signal!.aborted).to.equal(true); release(999999); await list(el, 't200');
  expect(el.sourcePage).to.equal(2); expect(el.activeConversationId).to.equal('t999999');
});
it('keeps provider row keyboard activation and localized pager controls accessible in RTL', async () => {
  const provider = source(); provider.query = async () => ({ total: 1, rows: [entry(0)] });
  const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" dir="rtl" .strings=${{ paginationLabel: 'Thread pages' }} .dataSource=${provider}></lr-thread-list>`);
  await list(el, 't0'); await waitUntil(() => el.itemElement('t0') !== null); const selected: string[] = [];
  el.addEventListener('lr-select', e => selected.push(e.detail.conversationId));
  await focusByKeyboard(el.itemElement('t0')!.shadowRoot!.querySelector<HTMLButtonElement>('[part="select-button"]')!);
  await sendKeys({ press: 'Enter' }); expect(selected).to.deep.equal(['t0']);
  expect(el.shadowRoot!.querySelector<LyraPagination>('lr-pagination')!.strings.paginationLabel).to.equal('Thread pages');
  await expect(el).to.be.accessible();
});
it('revokes a queued provider reveal when source removal restores the legacy list', async () => {
  const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .threads=${[entry(0).value, entry(1).value]} .dataSource=${source()}></lr-thread-list>`);
  const virtual = await list(el, 't0'); let release!: () => void; let awaited = 0;
  const pending = new Promise<boolean>(resolve => { release = () => resolve(true); });
  Object.defineProperty(virtual, 'updateComplete', { configurable: true, get: () => { awaited++; return pending; } });
  const original = virtual.scrollToIndex; let scrolls = 0;
  virtual.scrollToIndex = (...args) => { scrolls++; original.apply(virtual, args); };
  try {
    el.activeConversationId = 't1'; await waitUntil(() => awaited > 0);
    el.dataSource = undefined; await el.updateComplete;
    scrolls = 0; release(); await nextFrame(); await nextFrame();
    expect(scrolls).to.equal(0);
  } finally {
    Reflect.deleteProperty(virtual, 'updateComplete'); virtual.scrollToIndex = original; release();
  }
});

it('stops obsolete source descriptor capture when an early field navigates pages', async () => {
  const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .sourcePageSize=${1}></lr-thread-list>`);
  let navigated = false; let laterReads = 0;
  const original = entry(0);
  const row = { ...original, value: new Proxy(original.value, { getOwnPropertyDescriptor(target, key) {
    if (key === 'id' && !navigated) { navigated = true; el.sourcePage = 1; }
    else if (key === 'title') laterReads++;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } }) };
  const provider = source();
  provider.query = async ({ page }) => ({ total: 2, rows: [page === 0 ? row : entry(1)] });
  el.dataSource = provider;
  const virtual = await list(el, 't1');
  expect(laterReads).to.equal(0); expect(el.sourcePage).to.equal(1);
  expect(virtual.items.length).to.equal(1); expect(el.shadowRoot!.querySelector('[part="source-retry"]') === null).to.equal(true);
});
