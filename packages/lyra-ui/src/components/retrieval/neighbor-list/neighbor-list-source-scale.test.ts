import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './neighbor-list.js';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraNeighborList } from './neighbor-list.js';
import type { GraphSource } from '../graph/graph.class.js';
import type { LyraGraphSourceQuery } from '../../../data-sources.js';

type List = LyraNeighborList & { graphSource: GraphSource | undefined; centerKey: string | null; sourcePage: number; sourcePageSize: number; sourceDirection: 'in' | 'out' | 'both'; sourceNodeTypes: readonly string[]; readonly sourceTotal: number | null; revealSourceKey(key: string): Promise<boolean> };
function provider() {
  const indices = new Uint32Array(1_000_000); for (let i = 0; i < indices.length; i++) indices[i] = i;
  const queries: { query: LyraGraphSourceQuery; page: number; pageSize: number }[] = [];
  let read = 0, scenes = 0;
  const row = (i: number) => ({ key: `node:${i}`, order: i, value: { kind: 'node' as const, value: { id: String(i), label: `Node ${i}`, type: 'person' } } });
  const source: GraphSource = { revision: 1, records: { revision: 1,
    query: async request => { queries.push(request); const start = request.page * request.pageSize; const values = indices.subarray(start, Math.min(indices.length, start + request.pageSize)); read += values.length;
      return { rows: Array.from(values, row), total: indices.length, summary: { nodes: indices.length, edges: indices.length } }; },
    locate: async key => /^node:\d+$/.test(key) && Number(key.slice(5)) < indices.length ? Number(key.slice(5)) : null,
    lookup: async keys => keys.map(key => row(Number(key.slice(5)))),
  }, scene: async () => { scenes++; throw new Error('Unexpected scene'); } };
  return { source, queries, get read() { return read; }, get scenes() { return scenes; } };
}
function button(list: List, key: string) { return [...list.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-source-key]')].find(node => node.dataset['sourceKey'] === key); }
async function ready(list: List, key = 'node:0') { await waitUntil(() => Boolean(button(list, key)), 'source row', { timeout: 3000 }); await list.updateComplete; }

it('pages an allocated million-node neighborhood and reveals the final key without selecting', async () => {
  const data = provider(); const list = await fixture<List>(html`<lr-neighbor-list .graphSource=${data.source} .centerKey=${'node:center'}></lr-neighbor-list>`);
  await ready(list); list.sourcePage = 5000; await ready(list, 'node:500000');
  const selected: string[] = []; list.addEventListener('lr-entity-select', event => selected.push(event.detail.entityId));
  expect(await list.revealSourceKey('node:999999')).to.equal(true);
  expect(list.shadowRoot!.activeElement === button(list, 'node:999999')).to.equal(true);
  expect(selected).to.deep.equal([]); expect(list.sourceTotal).to.equal(1_000_000);
  expect(data.read).to.equal(300); expect(data.scenes).to.equal(0);
  expect(list.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(100);
  recordScaleMeasurement('lr-neighbor-list', 'n=1000000 source first middle final pages', {
    sourceTotal: list.sourceTotal!, providerQueries: data.queries.length, providerRowsRead: data.read,
    sceneCalls: data.scenes, mountedRows: list.shadowRoot!.querySelectorAll('[data-source-key]').length,
  });
  button(list, 'node:999999')!.click(); expect(selected).to.deep.equal(['999999']);
});
it('uses node scope filters without fabricating relationship metadata', async () => {
  const data = provider(); const list = await fixture<List>(html`<lr-neighbor-list .graphSource=${data.source} .centerKey=${'node:center'} .sourceDirection=${'in'} .sourceNodeTypes=${['person', 'person']} group-by-relation expandable></lr-neighbor-list>`);
  await ready(list); expect(data.queries[0]!.query).to.deep.equal({ kind: 'nodes', search: '', centerKey: 'node:center', direction: 'in', nodeTypes: ['person'] });
  expect(list.shadowRoot!.querySelectorAll('[part="relation"], [part="direction"], [part="group-header"]').length).to.equal(0);
  const expanded: string[] = []; list.addEventListener('lr-node-expand', event => expanded.push(event.detail.nodeId));
  list.shadowRoot!.querySelector<HTMLButtonElement>('[part="expand-button"]')!.click(); expect(expanded).to.deep.equal(['0']);
});
it('does not query without a center and restores legacy rows when unset', async () => {
  const data = provider(); const list = await fixture<List>(html`<lr-neighbor-list .graphSource=${data.source} .rows=${[{ relation: 'knows', direction: 'out', node: { id: 'legacy', label: 'Legacy' } }]}></lr-neighbor-list>`);
  await list.updateComplete; expect(data.queries.length).to.equal(0); expect(list.sourceTotal).to.equal(null);
  list.centerKey = 'node:center'; await ready(list); const rows = list.rows;
  list.graphSource = undefined; await list.updateComplete;
  expect(list.rows === rows).to.equal(true); expect(list.shadowRoot!.textContent).to.contain('Legacy');
});
it('refreshes same-source assignment and makes detached source actions inert', async () => {
  const data = provider(); const list = await fixture<List>(html`<lr-neighbor-list .graphSource=${data.source} .centerKey=${'node:center'}></lr-neighbor-list>`);
  await ready(list); const old = button(list, 'node:0')!; const selected: string[] = [];
  list.addEventListener('lr-entity-select', event => selected.push(event.detail.entityId));
  list.graphSource = data.source; await waitUntil(() => data.queries.length === 2); await ready(list);
  old.click(); expect(selected).to.deep.equal([]);
  list.requestUpdate(); await waitUntil(() => data.queries.length === 3);
});

it('retains one physical query while ignored-abort replacements coalesce to the latest scope', async () => {
  const data = provider(); const original = data.source.records.query;
  let release!: () => void; let calls = 0, active = 0, peak = 0;
  const source: GraphSource = { ...data.source, records: { ...data.source.records, query: async request => {
    calls++; active++; peak = Math.max(peak, active);
    if (calls === 1) await new Promise<void>(resolve => { release = resolve; });
    try { return await original(request); } finally { active--; }
  } } };
  const list = await fixture<List>(html`<lr-neighbor-list .graphSource=${source} .centerKey=${'node:start'}></lr-neighbor-list>`);
  await waitUntil(() => calls === 1);
  list.centerKey = 'node:obsolete'; await list.updateComplete;
  list.centerKey = 'node:latest'; await list.updateComplete;
  expect(calls).to.equal(1); release(); await ready(list);
  expect(calls).to.equal(2); expect(peak).to.equal(1);
  expect(data.queries.at(-1)!.query.centerKey).to.equal('node:latest');
});
it('rejects stale retry buttons after provider replacement and reconnects current scope', async () => {
  const data = provider(); const failing: GraphSource = { ...data.source, records: { ...data.source.records, query: async () => { throw new Error('Private detail'); } } };
  const list = await fixture<List>(html`<lr-neighbor-list .graphSource=${failing} .centerKey=${'node:center'}></lr-neighbor-list>`);
  await waitUntil(() => Boolean(list.shadowRoot!.querySelector('[part="source-retry"]')));
  const retry = list.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-retry"]')!;
  expect(list.shadowRoot!.textContent).not.to.contain('Private detail');
  list.graphSource = data.source; await ready(list); retry.click(); await list.updateComplete;
  expect(data.queries.length).to.equal(1);
  const parent = list.parentNode!; list.remove(); parent.appendChild(list); await ready(list);
  await waitUntil(() => data.queries.length === 2);
});
it('validates type and page envelopes and permits recovery by reassignment', async () => {
  const data = provider(); const list = await fixture<List>(html`<lr-neighbor-list .graphSource=${data.source} .centerKey=${'node:center'}></lr-neighbor-list>`);
  await ready(list); list.sourceNodeTypes = Array.from({ length: 501 }, (_, i) => String(i)); await list.updateComplete;
  expect(list.sourceTotal).to.equal(null); expect(data.queries.length).to.equal(1);
  expect(list.shadowRoot!.querySelector('[part="source-retry"]') !== null).to.equal(true);
  list.sourceNodeTypes = ['b', 'a', 'b']; list.sourcePageSize = 900; await ready(list);
  expect(data.queries.at(-1)!.pageSize).to.equal(500); expect(data.queries.at(-1)!.query.nodeTypes).to.deep.equal(['a', 'b']);
  const oversized: GraphSource = { ...data.source, records: { ...data.source.records, query: async request => ({ ...(await data.source.records.query(request)), rows: Array.from({ length: 501 }, (_, i) => ({ key: `node:${i}`, order: i, value: { kind: 'node', value: { id: String(i) } } })) }) } };
  list.graphSource = oversized; await waitUntil(() => Boolean(list.shadowRoot!.querySelector('[part="source-retry"]')));
  expect(list.sourceTotal).to.equal(null); expect(list.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(0);
});
it('revokes a pending locate when a newer reveal targets an already visible node', async () => {
  const data = provider(); let resolve!: (value: number) => void;
  const source: GraphSource = { ...data.source, records: { ...data.source.records, locate: async key => key === 'node:900000' ? new Promise<number>(done => { resolve = done; }) : Number(key.slice(5)) } };
  const list = await fixture<List>(html`<lr-neighbor-list .graphSource=${source} .centerKey=${'node:center'}></lr-neighbor-list>`);
  await ready(list); const first = list.revealSourceKey('node:900000'); await waitUntil(() => Boolean(resolve));
  const second = list.revealSourceKey('node:0'); resolve(900000);
  expect(await first).to.equal(false); expect(await second).to.equal(true); expect(list.sourcePage).to.equal(0);
  expect(list.shadowRoot!.activeElement === button(list, 'node:0')).to.equal(true);
});
it('does not call an obsolete provider capability after reentrant capability access', async () => {
  const data = provider(); const list = await fixture<List>(html`<lr-neighbor-list .graphSource=${data.source} .centerKey=${'node:center'}></lr-neighbor-list>`);
  await ready(list); let obsolete = 0; const fresh = provider();
  const records = { ...data.source.records, get query() { list.graphSource = fresh.source; return async (...args: Parameters<GraphSource['records']['query']>) => { obsolete++; return data.source.records.query(...args); }; } };
  list.graphSource = { ...data.source, records }; await waitUntil(() => fresh.queries.length === 1); await ready(list);
  expect(obsolete).to.equal(0); expect(list.graphSource === fresh.source).to.equal(true);
});
it('exposes a named populated source list with localized status and bounded narrow layout', async () => {
  const data = provider(); const list = await fixture<List>(html`<lr-neighbor-list style="width:320px" dir="rtl" aria-label="Related entities" .strings=${{ neighborSourceSummary: '{shown} from {total}', neighborSourceChoose: 'Choose a node' }} .graphSource=${data.source} .centerKey=${'node:center'}></lr-neighbor-list>`);
  await ready(list); expect(list.shadowRoot!.querySelector('[part="source-summary"]')!.textContent).to.equal('100 from 1,000,000');
  expect(list.getAttribute('aria-label')).to.equal('Related entities');
  expect(list.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(null);
  expect(list.getBoundingClientRect().width).to.equal(320);
  await expect(list).to.be.accessible();
});

it('restores the latest legacy assignment made while a source is active', async () => {
  const list = await fixture<List>(html`<lr-neighbor-list .rows=${[{ relation: 'old', direction: 'out', node: { id: 'old', label: 'Old' } }]}></lr-neighbor-list>`);
  list.graphSource = provider().source; list.centerKey = 'node:center'; await ready(list);
  list.rows = [{ relation: 'new', direction: 'out', node: { id: 'new', label: 'Newest legacy' } }]; await list.updateComplete;
  list.graphSource = undefined; await list.updateComplete;
  expect(list.shadowRoot!.textContent).to.contain('Newest legacy');
});
it('activates the keyboard-focused exact ID without changing source scope', async () => {
  const data = provider(); const list = await fixture<List>(html`<lr-neighbor-list .graphSource=${data.source} .centerKey=${'node:center'}></lr-neighbor-list>`);
  await ready(list); const selected: string[] = []; list.addEventListener('lr-entity-select', event => selected.push(event.detail.entityId));
  await focusByKeyboard(button(list, 'node:0')!); await sendKeys({ press: 'Enter' });
  expect(selected).to.deep.equal(['0']); expect(data.queries.length).to.equal(1);
});
it('rejects cumulative page text beyond its budget without retaining a partial page', async () => {
  const data = provider(); const source: GraphSource = { ...data.source, records: { ...data.source.records, query: async () => ({
    rows: Array.from({ length: 33 }, (_, i) => ({ key: `node:${i}`, order: i, value: { kind: 'node', value: { id: String(i), label: 'x'.repeat(65_000) } } })), total: 33, summary: { nodes: 33, edges: 0 },
  }) } };
  const list = await fixture<List>(html`<lr-neighbor-list .graphSource=${source} .centerKey=${'node:center'}></lr-neighbor-list>`);
  await waitUntil(() => Boolean(list.shadowRoot!.querySelector('[part="source-retry"]')));
  expect(list.sourceTotal).to.equal(null); expect(list.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(0);
});

it('renders unregistered English center, summary and sanitized failure messages', async () => {
  const data = provider(); const list = await fixture<List>(html`<lr-neighbor-list .graphSource=${data.source}></lr-neighbor-list>`);
  expect(list.shadowRoot!.textContent).to.contain('Select an entity to view its neighbors.');
  list.centerKey = 'node:center'; await ready(list);
  expect(list.shadowRoot!.textContent).to.contain('Showing 100 of 1,000,000 neighbors.');
  list.graphSource = { ...data.source, records: { ...data.source.records, query: async () => { throw new Error('Hidden'); } } };
  await waitUntil(() => Boolean(list.shadowRoot!.querySelector('[part="source-retry"]')));
  expect(list.shadowRoot!.textContent).to.contain('The neighbors could not be loaded.');
  expect(list.shadowRoot!.querySelector('[part="source-retry"]')!.textContent).to.equal('Retry');
});
it('does not invoke an old locate after a revision getter replaces the source', async () => {
  const data = provider(); let armed = false, oldLocates = 0; let list!: List; const fresh = provider();
  const source: GraphSource = { ...data.source, get revision() { if (armed) { armed = false; list.graphSource = fresh.source; } return 1; }, records: { ...data.source.records, locate: async () => { oldLocates++; return 0; } } };
  list = await fixture<List>(html`<lr-neighbor-list .graphSource=${source} .centerKey=${'node:center'}></lr-neighbor-list>`);
  await ready(list); armed = true; await list.revealSourceKey('node:0');
  await waitUntil(() => fresh.queries.length === 1); expect(oldLocates).to.equal(0);
});
it('refreshes the source after document adoption without retaining old controls', async () => {
  const data = provider(); const list = await fixture<List>(html`<lr-neighbor-list .graphSource=${data.source} .centerKey=${'node:center'}></lr-neighbor-list>`);
  await ready(list); const old = button(list, 'node:0')!; let selected = 0; list.addEventListener('lr-entity-select', () => selected++);
  const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Alternate document"></iframe>`);
  frame.contentDocument!.body.appendChild(list); await ready(list); await waitUntil(() => data.queries.length === 2);
  old.click(); expect(selected).to.equal(0); expect(list.ownerDocument === frame.contentDocument).to.equal(true);
});
it('keeps type snapshots bounded and preserves a newer reentrant type assignment', async () => {
  const data = provider(); const list = await fixture<List>(html`<lr-neighbor-list .graphSource=${data.source} .centerKey=${'node:center'}></lr-neighbor-list>`);
  await ready(list);
  list.sourceNodeTypes = Array.from({ length: 32 }, (_, i) => `${i}${'x'.repeat(65_000)}`); await list.updateComplete;
  expect(list.sourceTotal).to.equal(null); expect(data.queries.length).to.equal(1);
  let armed = true;
  list.sourceNodeTypes = new Proxy(['obsolete'], { getOwnPropertyDescriptor(target, key) {
    if (key === '0' && armed) { armed = false; list.sourceNodeTypes = ['new']; }
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  await ready(list); expect(list.sourceNodeTypes).to.deep.equal(['new']);
  expect(data.queries.at(-1)!.query.nodeTypes).to.deep.equal(['new']);
});

it('keeps current row actions live after a successful same-page reveal', async () => {
 const row = {key: 'node:a', order: 0, value: {kind: 'node' as const, value: {id: 'a', label: 'Alpha'}}};
 let queries = 0;
 const source: GraphSource = {revision: 1, records: {revision: 1, query: async () => {queries++; return {rows: [row], total: 1, summary: {nodes: 1, edges: 0}};}, locate: async () => 0, lookup: async () => [row]}, scene: async () => {throw new Error('Unused');}};
 const el = await fixture<LyraNeighborList>(html`<lr-neighbor-list expandable .graphSource=${source} .centerKey=${'node:center'}></lr-neighbor-list>`);
 await waitUntil(() => el.sourceTotal === 1); await el.updateComplete;
 const selected: string[] = [], expanded: string[] = [];
 el.addEventListener('lr-entity-select', event => selected.push(event.detail.entityId));
 el.addEventListener('lr-node-expand', event => expanded.push(event.detail.nodeId));
 expect(await el.revealSourceKey('node:a')).to.equal(true);
 const current = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key]')!;
 expect(el.shadowRoot!.activeElement === current).to.equal(true);
 current.click(); el.shadowRoot!.querySelector<HTMLButtonElement>('[part="expand-button"]')!.click();
 expect(queries).to.equal(1); expect(selected).to.deep.equal(['a']); expect(expanded).to.deep.equal(['a']);
 const previousExpand = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="expand-button"]')!;
 el.sourcePage = 1; current.click(); previousExpand.click();
 expect(selected).to.deep.equal(['a']); expect(expanded).to.deep.equal(['a']);
});
