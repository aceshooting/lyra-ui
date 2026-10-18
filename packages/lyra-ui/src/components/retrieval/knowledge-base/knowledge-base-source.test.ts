import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './knowledge-base.js';
import type { KnowledgeBaseSource, KnowledgeSource, LyraKnowledgeBase } from './knowledge-base.class.js';
import type { LyraTable } from '../../data/table/table.class.js';
import type { LyraDropdown } from '../../overlays/overlay/dropdown.class.js';

const row = (id: number): KnowledgeSource => ({ id: `s${id}`, name: `Source ${id}`, syncStatus: 'synced', indexingHealth: 'degraded' });
function provider(total = 10) {
  const calls: { page: number; pageSize: number; sortKey: string | null; sortDir: string }[] = [];
  const source: KnowledgeBaseSource = { revision: 1, lookup: async () => [], locate: async () => null, query: async ({ page, pageSize, query }) => {
    calls.push({ page, pageSize, ...query });
    return { total, summary: { total, synced: total, syncing: 0, attention: total }, rows: Array.from({ length: Math.min(pageSize, Math.max(0, total - page * pageSize)) }, (_, i) => { const order = page * pageSize + i; return { key: `s${order}`, order, value: row(order) }; }) };
  } };
  return { source, calls };
}
async function table(el: LyraKnowledgeBase, first: string) {
  await waitUntil(() => (el.dataSource === undefined || el.sourceTotal !== null) && el.shadowRoot?.querySelector<LyraTable<KnowledgeSource>>('lr-table')?.rows[0]?.id === first);
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector<LyraTable<KnowledgeSource>>('lr-table')!; await grid.updateComplete; return grid;
}
async function failed(el: LyraKnowledgeBase) {
  await waitUntil(() => !!el.shadowRoot?.querySelector<LyraTable<KnowledgeSource>>('lr-table')?.error);
  const grid = el.shadowRoot!.querySelector<LyraTable<KnowledgeSource>>('lr-table')!; await grid.updateComplete; return grid;
}

describe('knowledge base source', () => {
  it('uses full-source overlapping summary counts and renders the short final server page', async () => {
    const data = provider();
    const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .dataSource=${data.source} .sourcePageSize=${3} .sourcePage=${3}></lr-knowledge-base>`);
    const grid = await table(el, 's9');
    expect(data.calls).to.deep.equal([{ page: 3, pageSize: 3, sortKey: null, sortDir: 'asc' }]);
    expect(grid.rows.length).to.equal(1); expect(grid.paginationMode).to.equal('server'); expect(el.sourceTotal).to.equal(10);
    const stats = [...el.shadowRoot!.querySelectorAll('lr-stat')].map(stat => stat.getAttribute('value'));
    expect(stats).to.deep.equal(['10', '10', '0', '10']);
  });
  it('requires the complete valid summary even when hidden', async () => {
    const source: KnowledgeBaseSource = { revision: 1, lookup: async () => [], locate: async () => null, query: async () => ({ total: 0, rows: [] } as never) };
    const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .dataSource=${source} without-summary></lr-knowledge-base>`);
    await failed(el); expect(el.sourceTotal).to.equal(null); expect(el.error).to.equal(false);
  });
  it('rejects detached row menus when a replacement page reuses the same ID', async () => {
    const data = provider(1); const next = provider(1);
    const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .dataSource=${data.source}></lr-knowledge-base>`);
    const grid = await table(el, 's0');
    const dropdown = grid.shadowRoot!.querySelector<LyraDropdown>('lr-dropdown')!; await dropdown.show();
    const menu = dropdown.querySelector('lr-menu')!;
    let actions = 0; el.addEventListener('lr-source-delete', () => actions++);
    menu.dispatchEvent(new CustomEvent('lr-select', { detail: { item: { value: 'delete' } }, bubbles: true, composed: true })); expect(actions).to.equal(1);
    el.dataSource = next.source;
    menu.dispatchEvent(new CustomEvent('lr-select', { detail: { item: { value: 'delete' } }, bubbles: true, composed: true }));
    await table(el, 's0'); expect(actions).to.equal(1);
  });
  it('keeps the original sort proposal veto and commits one source query', async () => {
    const data = provider(); const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .dataSource=${data.source} .sourcePageSize=${3} .sourcePage=${1}></lr-knowledge-base>`);
    const grid = await table(el, 's3'); const phases: string[] = [];
    const veto = (event: Event) => { phases.push('request'); event.preventDefault(); };
    el.addEventListener('lr-sort-request', veto);
    grid.shadowRoot!.querySelector<HTMLElement>('[role="columnheader"][tabindex]')!.click(); await el.updateComplete;
    expect(data.calls.length).to.equal(1); expect(phases).to.deep.equal(['request']);
    el.removeEventListener('lr-sort-request', veto); el.addEventListener('lr-sort', () => phases.push('commit'));
    grid.shadowRoot!.querySelector<HTMLElement>('[role="columnheader"][tabindex]')!.click(); await table(el, 's0');
    expect(data.calls[1]).to.deep.equal({ page: 0, pageSize: 3, sortKey: 'name', sortDir: 'asc' }); expect(phases).to.deep.equal(['request', 'commit']);
  });
  it('vetoes retry and refuses to refresh a provider replaced in its retry listener', async () => {
    let calls = 0; const source: KnowledgeBaseSource = { revision: 1, lookup: async () => [], locate: async () => null, query: async () => { calls++; throw new Error('private provider failure'); } };
    const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .dataSource=${source}></lr-knowledge-base>`); const grid = await failed(el);
    const veto = (event: Event) => event.preventDefault(); el.addEventListener('lr-retry-request', veto);
    const retry = new CustomEvent<null>('lr-retry-request', { detail: null, cancelable: true, bubbles: true, composed: true }); grid.dispatchEvent(retry);
    expect(retry.defaultPrevented).to.equal(true); expect(calls).to.equal(1); el.removeEventListener('lr-retry-request', veto);
    const next = provider(1); el.addEventListener('lr-retry-request', () => { el.dataSource = next.source; }, { once: true });
    grid.dispatchEvent(new CustomEvent('lr-retry-request', { cancelable: true, bubbles: true, composed: true })); await table(el, 's0'); expect(next.calls.length).to.equal(1);
  });
});

it('preserves the unset legacy path and treats null as a failed source without reading legacy rows', async () => {
  const data = provider(1); const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .sources=${[row(99)]} .dataSource=${data.source}></lr-knowledge-base>`);
  await table(el, 's0'); el.dataSource = null as never;
  await failed(el); expect(el.sourceTotal).to.equal(null); el.dataSource = undefined;
  const grid = await table(el, 's99'); expect(grid.columns.filter(column => column.sortable).length).to.equal(0); expect(el.sources[0]!.id).to.equal('s99');
});
it('coalesces refresh, keeps presentation paints quiet, and refetches locale and revisions', async () => {
  const data = provider(4); const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .dataSource=${data.source}></lr-knowledge-base>`);
  await table(el, 's0'); el.label = 'Changed'; el.withoutCreate = true; await el.updateComplete; expect(data.calls.length).to.equal(1);
  el.requestUpdate(); el.label = 'Again'; await table(el, 's0'); expect(data.calls.length).to.equal(2);
  el.label = 'Third'; el.requestUpdate(); await table(el, 's0'); expect(data.calls.length).to.equal(3);
  el.dataSource = data.source; await table(el, 's0'); expect(data.calls.length).to.equal(4);
  el.lang = 'en-GB'; await table(el, 's0'); expect(data.calls.length).to.equal(5);
  (data.source as { revision: number }).revision = 2; el.label = 'Revision'; await waitUntil(() => data.calls.length === 6); await table(el, 's0');
});
it('stops obsolete domain descriptor reads after page navigation and summary descriptor reentry', async () => {
  const data = provider(3); let el: LyraKnowledgeBase; let laterReads = 0; let triggered = false;
  const original = data.source.query;
  data.source.query = async request => {
    const result = await original(request);
    if (request.page === 0 && !triggered) {
      const value = new Proxy(row(0), { getOwnPropertyDescriptor(target, key) {
        if (key === 'id') { triggered = true; el.sourcePage = 1; }
        if (key === 'name') laterReads++;
        return Reflect.getOwnPropertyDescriptor(target, key);
      } });
      return { ...result, rows: [{ key: 's0', order: 0, value }] };
    }
    return result;
  };
  el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .sourcePageSize=${1}></lr-knowledge-base>`);
  el.dataSource = data.source; await table(el, 's1'); expect(laterReads).to.equal(0);
  let summaryLaterReads = 0;
  data.source.query = async request => {
    const result = await original(request);
    if (request.page === 1) return { ...result, summary: new Proxy(result.summary, { getOwnPropertyDescriptor(target, key) {
      if (key === 'total') el.sourcePage = 2;
      if (key === 'synced') summaryLaterReads++;
      return Reflect.getOwnPropertyDescriptor(target, key);
    } }) };
    return result;
  };
  el.requestUpdate(); await table(el, 's2'); expect(summaryLaterReads).to.equal(0);
});
it('rejects inconsistent counts, unsafe fields and overlong text without invoking accessors', async () => {
  const invalid: ((value: KnowledgeSource, summary: { total: number; synced: number; syncing: number; attention: number }) => void)[] = [
    (_value, summary) => { summary.total = 2; },
    (_value, summary) => { summary.syncing = 1; },
    (_value, summary) => { summary.synced = 0; },
    (_value, summary) => { summary.attention = 0; },
    (_value, summary) => { summary.total = NaN; },
    value => { value.id = 'wrong'; },
    value => { value.syncStatus = 'other' as never; },
    value => { value.permission = 'other' as never; },
    value => { value.indexingHealth = 'other' as never; },
    value => { value.documentCount = 1.5; },
    value => { value.name = 'x'.repeat(65_537); },
    value => { Object.defineProperty(value, 'name', { get() { throw new Error('Accessor executed'); } }); },
  ];
  for (const change of invalid) {
    const value = row(0); const summary = { total: 1, synced: 1, syncing: 0, attention: 1 }; change(value, summary);
    const source: KnowledgeBaseSource = { revision: 1, lookup: async () => [], locate: async () => null, query: async () => ({ total: 1, summary, rows: [{ key: 's0', order: 0, value }] }) };
    const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .dataSource=${source}></lr-knowledge-base>`);
    const grid = await failed(el); expect(grid.rows.length).to.equal(0); expect(el.sourceTotal).to.equal(null); el.remove();
  }
});
it('accepts safe timestamps without calling overridden Date methods and retains invalid-string fallback', async () => {
  const data = provider(2); const original = data.source.query; let calls = 0;
  const timestamp = new Date('2026-01-15T10:30:00Z'); timestamp.getTime = () => { calls++; throw new Error('Override called'); };
  data.source.query = async request => { const result = await original(request); return { ...result, rows: result.rows.map((record, i) => ({ ...record, value: { ...record.value, lastSyncedAt: i === 0 ? timestamp : 'invalid' } })) }; };
  const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .dataSource=${data.source}></lr-knowledge-base>`);
  const grid = await table(el, 's0'); expect(calls).to.equal(0); expect(grid.shadowRoot!.querySelectorAll('[part="sync-timestamp"]')[1]!.textContent!.trim()).to.equal('Never synced');
});
it('corrects an out-of-range page once, normalizes page size, and accepts empty counts', async () => {
  const data = provider(7); const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .sourcePageSize=${3} .sourcePage=${99} .dataSource=${data.source}></lr-knowledge-base>`);
  await table(el, 's6'); expect(data.calls.map(call => call.page)).to.deep.equal([99, 2]); expect(el.sourcePage).to.equal(2);
  el.sourcePageSize = 9_999; await table(el, 's0'); expect(data.calls.at(-1)!.pageSize).to.equal(500); expect(el.sourcePage).to.equal(0);
  const empty = provider(0); el.dataSource = empty.source; await waitUntil(() => el.sourceTotal === 0); await el.updateComplete;
  const grid = el.shadowRoot!.querySelector<LyraTable<KnowledgeSource>>('lr-table')!; await grid.updateComplete;
  expect(grid.error).to.equal(false); expect(grid.rows.length).to.equal(0); expect(el.shadowRoot!.querySelector('[part="create-button"]')).not.to.equal(null);
});
it('keeps only the latest queued page and revokes old menus synchronously on refresh', async () => {
  const data = provider(4); const original = data.source.query; let finish: (() => void) | undefined; let entered = false;
  data.source.query = async request => { if (request.page === 1) { entered = true; await new Promise<void>(resolve => { finish = resolve; }); } return original(request); };
  const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .sourcePageSize=${1} .dataSource=${data.source}></lr-knowledge-base>`);
  const grid = await table(el, 's0'); const dropdown = grid.shadowRoot!.querySelector<LyraDropdown>('lr-dropdown')!; await dropdown.show(); const menu = dropdown.querySelector('lr-menu')!;
  let actions = 0; el.addEventListener('lr-source-sync', () => actions++);
  el.sourcePage = 1; await waitUntil(() => entered); el.sourcePage = 2; el.sourcePage = 3;
  expect(el.sourceTotal).to.equal(null); menu.dispatchEvent(new CustomEvent('lr-select', { detail: { item: { value: 'sync' } } })); expect(actions).to.equal(0);
  finish!(); await table(el, 's3'); expect(data.calls.map(call => call.page)).to.deep.equal([0, 1, 3]);
});
it('rejects replaced-source sort commits and honors current action enablement', async () => {
  const data = provider(1); const next = provider(1); const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .dataSource=${data.source}></lr-knowledge-base>`);
  let grid = await table(el, 's0'); expect(grid.columns.filter(column => column.sortable).map(column => column.key)).to.deep.equal(['name', 'sync', 'health', 'permission']);
  let commits = 0; el.addEventListener('lr-sort', () => commits++); el.addEventListener('lr-sort-request', () => { el.dataSource = next.source; }, { once: true });
  grid.shadowRoot!.querySelector<HTMLElement>('[role="columnheader"][tabindex]')!.click(); grid = await table(el, 's0'); expect(commits).to.equal(0); expect(next.calls[0]!.sortKey).to.equal(null);
  const dropdown = grid.shadowRoot!.querySelector<LyraDropdown>('lr-dropdown')!; await dropdown.show(); const menu = dropdown.querySelector('lr-menu')!;
  let pauses = 0; let syncs = 0; el.addEventListener('lr-source-pause', () => pauses++); el.addEventListener('lr-source-sync', () => syncs++);
  menu.dispatchEvent(new CustomEvent('lr-select', { detail: { item: { value: 'pause' } } })); menu.dispatchEvent(new CustomEvent('lr-select', { detail: { item: { value: 'sync' } } })); expect(pauses).to.equal(0); expect(syncs).to.equal(1);
});
it('retries a current failure and preserves external error copy and retry veto', async () => {
  const data = provider(1); const query = data.source.query; let fail = true;
  data.source.query = async request => { if (fail) throw new Error('private provider failure'); return query(request); };
  const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .dataSource=${data.source} error-heading="Host failure" error-description="Host details"></lr-knowledge-base>`);
  let grid = await failed(el); expect(grid.errorHeading).to.equal('Host failure'); expect(grid.errorDescription).to.equal('Host details');
  expect(el.shadowRoot!.textContent).not.to.contain('private provider failure'); fail = false;
  grid.dispatchEvent(new CustomEvent('lr-retry-request', { cancelable: true, bubbles: true, composed: true })); grid = await table(el, 's0');
  el.error = true; await el.updateComplete; await grid.updateComplete;
  const veto = (event: Event) => event.preventDefault(); el.addEventListener('lr-retry-request', veto);
  grid.dispatchEvent(new CustomEvent('lr-retry-request', { cancelable: true, bubbles: true, composed: true })); expect(el.error).to.equal(true); el.removeEventListener('lr-retry-request', veto);
  grid.dispatchEvent(new CustomEvent('lr-retry-request', { cancelable: true, bubbles: true, composed: true })); expect(el.error).to.equal(false); expect(data.calls.length).to.equal(1);
});
it('reconnects the same provider and prevents old detached menus from regaining authority', async () => {
  const data = provider(1); const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .dataSource=${data.source}></lr-knowledge-base>`);
  const grid = await table(el, 's0'); const dropdown = grid.shadowRoot!.querySelector<LyraDropdown>('lr-dropdown')!; await dropdown.show(); const menu = dropdown.querySelector('lr-menu')!;
  let actions = 0; el.addEventListener('lr-source-delete', () => actions++); const parent = el.parentElement!; el.remove(); parent.append(el); await table(el, 's0');
  menu.dispatchEvent(new CustomEvent('lr-select', { detail: { item: { value: 'delete' } } })); expect(actions).to.equal(0); expect(data.calls.length).to.equal(2);
});
it('retains the retry reentry guard across a synchronous host repaint', async () => {
  const data = provider(1); data.source.query = async () => { throw new Error('hidden'); };
  const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .dataSource=${data.source}></lr-knowledge-base>`);
  const grid = await failed(el); let requests = 0; el.addEventListener('lr-retry-request', () => requests++);
  const nested = new CustomEvent('lr-retry-request', { cancelable: true, bubbles: true, composed: true });
  el.addEventListener('lr-retry-request', event => {
    el.label = 'Updated'; (el as unknown as { performUpdate(): void }).performUpdate(); grid.dispatchEvent(nested); event.preventDefault();
  }, { once: true });
  grid.dispatchEvent(new CustomEvent('lr-retry-request', { cancelable: true, bubbles: true, composed: true }));
  expect(requests).to.equal(1); expect(nested.defaultPrevented).to.equal(true); expect(grid.error).to.equal(true);
});
it('adopts while a request is pending without publishing the old document result', async () => {
  const data = provider(1); const query = data.source.query; let settle!: () => void; let first = true;
  data.source.query = request => { if (!first) return query(request); first = false; return new Promise(resolve => { settle = () => { void Promise.resolve(query(request)).then(resolve); }; }); };
  const wrapper = await fixture<HTMLDivElement>(html`<div><iframe title="New document"></iframe><lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .dataSource=${data.source}></lr-knowledge-base></div>`);
  const el = wrapper.querySelector<LyraKnowledgeBase>('lr-knowledge-base')!; await waitUntil(() => !!settle);
  const doc = wrapper.querySelector('iframe')!.contentDocument!; doc.body.appendChild(doc.adoptNode(el)); settle(); await table(el, 's0');
  expect(el.ownerDocument === doc).to.equal(true); expect(data.calls.length).to.equal(2);
});
it('uses native RTL header navigation and keyboard sorting for source columns', async () => {
  const data = provider(4); const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base dir="rtl" .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .sourcePage=${1} .sourcePageSize=${2} .dataSource=${data.source}></lr-knowledge-base>`);
  const grid = await table(el, 's2'); const headers = [...grid.shadowRoot!.querySelectorAll<HTMLElement>('[role="columnheader"][tabindex]')];
  const { focusByKeyboard } = await import('../../../../test/wtr-focus.js'); const { sendKeys } = await import('@web/test-runner-commands');
  await focusByKeyboard(headers[0]!); await sendKeys({ press: 'ArrowLeft' }); expect(grid.shadowRoot!.activeElement === headers[1]).to.equal(true);
  await sendKeys({ press: 'Enter' }); await table(el, 's0'); expect(data.calls[1]!.sortKey).to.equal('sync'); expect(el.sourcePage).to.equal(0);
});
it('keeps initial failure quiet and announces later page failure exactly once', async () => {
  const { AnnouncementSinkController } = await import('../../../internal/announcer.js');
  const polite = AnnouncementSinkController.prototype.announcePolite; const assertive = AnnouncementSinkController.prototype.announceAssertive; const messages: string[] = [];
  AnnouncementSinkController.prototype.announcePolite = function (message, ...args) { messages.push(message); return polite.call(this, message, ...args); };
  AnnouncementSinkController.prototype.announceAssertive = function (message, ...args) { messages.push(message); return assertive.call(this, message, ...args); };
  try {
    const data = provider(1); const query = data.source.query; let fail = true;
    data.source.query = request => { if (fail) throw new Error('hidden'); return query(request); };
    const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Page failed' }} .dataSource=${data.source}></lr-knowledge-base>`);
    await failed(el); expect(messages.filter(message => message === 'Page failed').length).to.equal(0);
    fail = false; el.dataSource = data.source; await table(el, 's0'); fail = true; el.dataSource = data.source; await failed(el);
    expect(messages.filter(message => message === 'Page failed').length).to.equal(1);
  } finally { AnnouncementSinkController.prototype.announcePolite = polite; AnnouncementSinkController.prototype.announceAssertive = assertive; }
});
it('uses English source-status fallbacks and live overrides without exposing provider errors', async () => {
  const data = provider(1); let reject!: (reason: Error) => void;
  data.source.query = () => new Promise((_resolve, fail) => { reject = fail; });
  const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base lang="en" .dataSource=${data.source}></lr-knowledge-base>`);
  await waitUntil(() => !!reject); expect(el.shadowRoot!.querySelector('[part="source-status"]')!.textContent).to.equal('Loading…');
  el.strings = { loading: 'Wait here' }; await el.updateComplete; expect(el.shadowRoot!.querySelector('[part="source-status"]')!.textContent).to.equal('Wait here');
  reject(new Error('private provider failure')); await failed(el); expect(el.shadowRoot!.querySelector('[part="source-status"]')!.textContent).to.equal('Could not load data');
  el.strings = { tableLoadFailed: 'Unavailable' }; await el.updateComplete; expect(el.shadowRoot!.querySelector('[part="source-status"]')!.textContent).to.equal('Unavailable');
  expect(el.shadowRoot!.textContent).not.to.contain('private provider failure');
});
it('keeps provider identity opaque and never reads inactive legacy rows', async () => {
  const data = provider(1); const source = new Proxy(data.source, { ownKeys() { throw new Error('Provider dictionary walked'); } });
  const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .dataSource=${source}></lr-knowledge-base>`);
  Object.defineProperty(el, 'sources', { configurable: true, get() { throw new Error('Inactive sources read'); } });
  try { await table(el, 's0'); el.label = 'Other'; await el.updateComplete; expect(el.dataSource === source).to.equal(true); }
  finally { delete (el as unknown as { sources?: unknown }).sources; }
});
it('wraps long source status text at a narrow RTL allocation', async () => {
  const data = provider(1); data.source.query = () => new Promise(() => undefined);
  const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base dir="rtl" style="width:320px" .strings=${{ loading: 'x'.repeat(500) }} .dataSource=${data.source}></lr-knowledge-base>`);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.scrollWidth).to.be.at.most(321);
});
