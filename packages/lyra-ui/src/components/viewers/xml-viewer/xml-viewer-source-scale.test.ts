import { captureReentrantUpdateWarning } from '../../../../test/expected-lit-update.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expect, fixture, html, waitUntil, nextFrame } from '@open-wc/testing';
import type { LyraHierarchyQuery, LyraHierarchyRow, LyraHierarchySource, LyraInspectionNode } from '../../../data-sources.js';
import type { LyraXmlViewer } from './xml-viewer.class.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sendKeys } from '@web/test-runner-commands';
import './xml-viewer.js';

type Source = LyraHierarchySource<LyraInspectionNode, LyraHierarchyQuery>;
const strings = { xmlViewerLabel: 'XML document', loading: 'Loading', treeSourceError: 'Unable to load tree data.', treeSourceSummary: '{visible} visible of {total} nodes.',
  noData: 'No data', retry: 'Retry', expand: 'Expand', collapse: 'Collapse', sourceSearchUnavailable: 'Search unavailable' };
function row(index: number, value = `Value ${index}`): LyraHierarchyRow<LyraInspectionNode> {
  return { key: `k${index}`, value: { name: `Key ${index}`, path: `k${index}`, kind: 'scalar', value }, parentKey: null,
    level: 1, position: index + 1, setSize: 1_000_000, childCount: 0, expanded: false, selected: false };
}
function source(count = 1_000_000) {
  const counters = { projects: 0, values: 0, keys: 0, lookups: 0 };
  const provider: Source = { revision: 1, async project(request) {
    counters.projects++;
    const key = request.action.type === 'reveal' ? request.action.key : '';
    return { state: `state-${counters.projects}`, total: count, rows: { count,
      indexOfKey: async (key: string) => { counters.lookups++; return Number(key.slice(1)); },
      async read({ offset, limit }) { return Array.from({ length: limit }, (_, index) => { counters.values++; return row(offset + index); }); },
    }, ...(key && /^k\d+$/.test(key) && Number(key.slice(1)) < count ? { focusIndex: Number(key.slice(1)) } : {}) };
  } };
  return { provider, counters };
}
const ready = (el: LyraXmlViewer) => waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-row"]')));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

it('reaches first middle and actual millionth XML source rows without traversing legacy data', async () => {
  expectDevWarning('virtual-list-scroll-scaling');
  let traversals = 0;
  const originalParse = DOMParser.prototype.parseFromString;
  DOMParser.prototype.parseFromString = function (...args) { traversals++; return originalParse.apply(this, args); };
  try {
  const { provider, counters } = source();
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer style="width:320px" max-height="240px" .strings=${strings}  .treeSource=${provider}></lr-xml-viewer>`);
  await ready(el);
  expect(traversals).to.equal(0);
  for (const key of ['k0', 'k500000', 'k999999']) {
    expect(await el.revealSourceKey(key)).to.equal(true);
    expect(el.shadowRoot!.querySelector(`[data-source-key="${key}"]`)?.textContent).to.include(key.replace('k', 'Value '));
  }
  const last = el.shadowRoot!.querySelector('[data-source-key="k999999"]')!;
  expect(last.getAttribute('aria-posinset')).to.equal('1000000');
  expect(last.getAttribute('aria-setsize')).to.equal('1000000');
  const list = el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;
  expect((list.source as { count: number }).count).to.equal(1_000_000);
  expect(list.projectedRows.length).to.be.at.most(301);
  expect(list.getBoundingClientRect().height).to.be.at.most(240);
  const cache = (el as unknown as { hierarchy: { window: { pages: Map<number, { slots?: unknown[] }> } } }).hierarchy.window;
  const retained = Array.from(cache.pages.values()).reduce((count, page) => count + (page.slots?.length ?? 0), 0);
  recordScaleMeasurement('lr-xml-viewer', 'source-wide@1000000', { logical: (list.source as { count: number }).count, values: counters.values, lookups: counters.lookups, projects: counters.projects, mounted: el.shadowRoot!.querySelectorAll('[part~="source-row"]').length, retained });
  expect(retained).to.be.at.most(400);
  expect(counters.values).to.be.at.most(1200);
  expect(el.shadowRoot!.querySelectorAll('[part="copy-button"]').length).to.equal(0);
  } finally { DOMParser.prototype.parseFromString = originalParse; }
});

it('uses global node hits independently of maxNodes and moves the XML cursor without repeating search', async () => {
  expectDevWarning('virtual-list-scroll-scaling');
  const { provider } = source(); let searches = 0; const queries: string[] = [];
  const project = provider.project;
  provider.project = request => { queries.push(request.query.search); return project(request); };
  provider.search = async request => { searches++; expect(request.limit).to.equal(10000); expect(request.query).to.equal('final');
    return { hits: [{ key: 'k999999' }], total: 1, exhaustive: true }; };
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer max-nodes="1" .strings=${strings} .treeSource=${provider}></lr-xml-viewer>`);
  await ready(el);
  const details: { activeIndex: number; matchCount: number; matchCountExact: boolean }[] = [];
  el.addEventListener('lr-search-change', event => details.push(event.detail));
  expect(await el.search('final')).to.equal(1);
  expect(details.at(-1)).to.include({ activeIndex: 0, matchCount: 1, matchCountExact: true });
  expect(await el.searchNext()).to.equal(true);
  expect(el.shadowRoot!.querySelector('[data-source-key="k999999"]')).not.to.equal(null);
  expect(await el.searchPrevious()).to.equal(true);
  expect(searches).to.equal(1); expect(queries).to.include('final');
  el.clearSearch(); await el.updateComplete;
  expect(details.at(-1)).to.include({ activeIndex: -1, matchCount: 0 });
});

it('reports unavailable and partial search honestly and rejects oversized source queries', async () => {
  const { provider } = source(10);
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer .strings=${strings} .treeSource=${provider}></lr-xml-viewer>`);
  await ready(el); let detail: { matchCountExact: boolean } | undefined;
  el.addEventListener('lr-search-change', event => { detail = event.detail; });
  expect(await el.search('missing')).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="search-status"]')?.textContent).to.include('Search unavailable');
  expect(detail?.matchCountExact).to.equal(false);
  provider.search = async () => ({ hits: [{ key: 'k9' }], total: null, exhaustive: false });
  expect(await el.search('partial')).to.equal(1); expect(detail?.matchCountExact).to.equal(false);
  expect(el.shadowRoot!.querySelector('[part="search-status"]')).not.to.equal(null);
  expect(await el.search('x'.repeat(4097))).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part~="source-error"]')).not.to.equal(null);
});

it('copies complete provider scopes and suppresses a stale provider result before clipboard effects', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard'); const writes: string[] = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { writes.push(text); } } });
  try {
    const { provider } = source(2); const scopes: string[] = []; let pending: ReturnType<typeof deferred<string>> | undefined;
    provider.copy = async request => { scopes.push(`${request.scope}:${request.key}`); expect(request.maxBytes).to.equal(25 * 1024 * 1024);
      return pending ? pending.promise : `complete:${request.scope}`; };
    const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer copyable .strings=${strings} .treeSource=${provider}></lr-xml-viewer>`);
    await ready(el); let copies = 0; el.addEventListener('lr-copy', () => copies++);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key="k1"] [part="copy-button"]')!.click();
    await waitUntil(() => copies === 1); expect(scopes[0]).to.equal('node:k1'); expect(writes).to.deep.equal(['complete:node']);
    pending = deferred<string>();
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toolbar"] [part="copy-button"]')!.click();
    await waitUntil(() => scopes.length === 2);
    el.clearSearch(); pending.resolve('stale'); await new Promise(resolve => setTimeout(resolve, 30));
    expect(scopes[1]).to.equal('document:null'); expect(writes.length).to.equal(1); expect(copies).to.equal(1);
  } finally { if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard'); }
});

it('refreshes same-identity sources on explicit keyless intent and restores current legacy input on unset', async () => {
  const { provider, counters } = source(1); let value = 'First'; const project = provider.project;
  provider.project = async request => { const result = await project(request); return { ...result, rows: { count: 1,
    keyAt: () => 'k0', indexOfKey: () => 0, itemAt: () => row(0, value) } }; };
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer .xml=${'<old />'} .strings=${strings} .treeSource=${provider}></lr-xml-viewer>`);
  await ready(el); const calls = counters.projects;
  el.maxHeight = '220px'; await el.updateComplete; expect(counters.projects).to.equal(calls);
  value = 'Second'; el.requestUpdate(); el.copyable = true;
  await waitUntil(() => el.shadowRoot!.textContent!.includes('Second')); expect(counters.projects).to.equal(calls + 1);
  el.xml = '<current />'; await el.updateComplete;
  el.treeSource = undefined; await el.updateComplete;
  expect(el.shadowRoot!.textContent).to.include('current'); expect(el.shadowRoot!.querySelector('lr-virtual-list') === null).to.equal(true);
});

it('rejects malformed display records without getters and renders compact million-deep metadata', async () => {
  const { provider } = source(1); const project = provider.project; let getters = 0; let invalid = false;
  provider.project = async request => { const result = await project(request); return { ...result, rows: { count: 1,
    keyAt: () => 'k0', indexOfKey: () => 0, itemAt: () => {
      const record = { ...row(0, 'Deep'), level: 1_000_000 };
      if (invalid) Object.defineProperty(record.value, 'name', { get() { getters++; return 'unsafe'; } });
      return record;
    } } }; };
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer .strings=${strings} .treeSource=${provider}></lr-xml-viewer>`);
  await ready(el); const element = el.shadowRoot!.querySelector<HTMLElement>('[part~="source-row"]')!;
  expect(element.getAttribute('aria-level')).to.equal('1000000'); expect(element.style.getPropertyValue('--source-depth')).to.equal('32');
  invalid = true; el.treeSource = provider;
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]'))); expect(getters).to.equal(0);
});

it('uses shared keyboard navigation to reach the final XML source node', async () => {
  expectDevWarning('virtual-list-scroll-scaling'); const { provider } = source();
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer .strings=${strings} .treeSource=${provider}></lr-xml-viewer>`);
  await ready(el); await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[part~="source-row"]')!);
  await sendKeys({ press: 'End' });
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[data-source-key="k999999"]')));
});


it('repeats same-query search as a new intent and settles coalesced older calls without publishing their hits', async () => {
  const { provider } = source(2); let searches = 0;
  provider.search = async () => { searches++; return { hits: [{ key: 'k1' }], total: 1, exhaustive: true }; };
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer .strings=${strings} .treeSource=${provider}></lr-xml-viewer>`);
  await ready(el);
  expect(await el.search('same')).to.equal(1); expect(await el.search('same')).to.equal(1);
  expect(searches).to.equal(2);
  const old = el.search('old'); const latest = el.search('new');
  expect(await old).to.equal(0); expect(await latest).to.equal(1);
});

it('holds one physical provider search across supersession and rejects malformed whole hit replies', async () => {
  const { provider } = source(2); const pending = deferred<{ hits: { key: string }[]; total: number; exhaustive: boolean }>(); let searches = 0;
  provider.search = async () => { searches++; return searches === 1 ? pending.promise : { hits: [{ key: 'k1' }], total: 1, exhaustive: true }; };
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer .strings=${strings} .treeSource=${provider}></lr-xml-viewer>`);
  await ready(el);
  const old = el.search('old'); await waitUntil(() => searches === 1);
  const latest = el.search('latest'); expect(await old).to.equal(0); expect(searches).to.equal(1);
  pending.resolve({ hits: [{ key: 'k0' }], total: 1, exhaustive: true });
  expect(await latest).to.equal(1); expect(searches).to.equal(2);
  provider.search = async () => ({ hits: Array.from({ length: 10001 }, (_, i) => ({ key: `k${i}` })), total: 10001, exhaustive: true });
  expect(await el.search('overflow')).to.equal(0);
  expect(await el.searchNext()).to.equal(false);
});

it('revokes provider search on replacement, unset, disconnect, adoption and locale changes', async () => {
  for (const boundary of ['replace', 'unset', 'disconnect', 'adopt', 'locale']) {
    const { provider } = source(2); const pending = deferred<{ hits: { key: string }[]; total: number; exhaustive: boolean }>(); let called = false;
    provider.search = () => { called = true; return pending.promise; };
    const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer .xml=${'<restored />'} .strings=${strings} .treeSource=${provider}></lr-xml-viewer>`);
    await ready(el); const task = el.search('old'); await waitUntil(() => called);
    if (boundary === 'replace') el.treeSource = source(2).provider;
    if (boundary === 'unset') el.treeSource = undefined;
    if (boundary === 'disconnect') el.remove();
    if (boundary === 'locale') el.lang = 'fr';
    if (boundary === 'adopt') {
      const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
      frame.contentDocument!.body.appendChild(frame.contentDocument!.adoptNode(el));
    }
    pending.resolve({ hits: [{ key: 'k1' }], total: 1, exhaustive: true });
    expect(await task, boundary).to.equal(0); el.remove();
  }
});

it('copies containers as complete subtrees and suppresses clipboard feedback after a later source wins', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard'); const write = deferred<void>(); let writes = 0;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => { writes++; return write.promise; } } });
  try {
    const { provider } = source(1); const project = provider.project; let scope = '';
    provider.project = async request => { const result = await project(request); return { ...result, rows: { count: 1,
      keyAt: () => 'k0', indexOfKey: () => 0, itemAt: () => ({ ...row(0), childCount: 1, value: { name: 'Container', path: 'k0', kind: 'object' as const } }) } }; };
    provider.copy = async request => { scope = request.scope; return '{"complete":true}'; };
    const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer copyable .strings=${strings} .treeSource=${provider}></lr-xml-viewer>`);
    await ready(el); let copied = 0; el.addEventListener('lr-copy', () => copied++);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="source-row"] [part="copy-button"]')!.click();
    await waitUntil(() => writes === 1); expect(scope).to.equal('subtree');
    el.treeSource = source(1).provider; write.resolve();
    await el.updateComplete; await new Promise(resolve => setTimeout(resolve, 20)); expect(copied).to.equal(0);
  } finally { if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard'); }
});

it('does not write clipboard when a clipboard capability getter replaces provider authority', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard'); let writes = 0; let el!: LyraXmlViewer;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, get() {
    el.treeSource = source(1).provider;
    return { writeText: async () => { writes++; } };
  } });
  try {
    const { provider } = source(1); provider.copy = async () => 'old';
    el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer copyable .strings=${strings} .treeSource=${provider}></lr-xml-viewer>`);
    await ready(el);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toolbar"] [part="copy-button"]')!.click();
    await new Promise(resolve => setTimeout(resolve, 30)); expect(writes).to.equal(0);
  } finally { if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard'); }
});

it('reaches a real million-deep ranged hierarchy by compact keys and reveals a collapsed descendant', async () => {
  expectDevWarning('virtual-list-scroll-scaling');
  let reads = 0; let maximum = 0; let inFlight = 0; let values = 0;
  const provider: Source = { revision: 1, async project(request) {
    let closed = request.state === null ? -1 : Number(request.state);
    if (request.action.type === 'reset' || request.action.type === 'reveal') closed = -1;
    if (request.action.type === 'toggle') closed = request.action.expanded ? -1 : Number(request.action.key.slice(1));
    const visible = closed < 0 ? 1_000_000 : closed + 1;
    return { state: String(closed), total: 1_000_000, rows: { count: visible,
      indexOfKey: async (key: string) => { const index = Number(key.slice(1)); return index < visible ? index : null; },
      read: async request => {
        reads++; inFlight++; maximum = Math.max(maximum, inFlight); await Promise.resolve(); inFlight--;
        return Array.from({ length: request.limit }, (_, offset) => {
          const index = request.offset + offset; values++;
          return { ...row(index), parentKey: index ? `k${index - 1}` : null, level: index + 1, position: 1, setSize: 1,
            childCount: index < 999999 ? 1 : 0, expanded: index !== closed && index < 999999 };
        });
      },
    }, ...(request.action.type === 'reveal' ? { focusIndex: Number(request.action.key.slice(1)) } : {}) };
  } };
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer max-height="200px" .strings=${strings} .treeSource=${provider}></lr-xml-viewer>`);
  await ready(el);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key="k0"] [part~="source-toggle"]')!.click();
  await waitUntil(() => el.shadowRoot!.querySelector('[data-source-key="k0"]')?.getAttribute('aria-expanded') === 'false');
  expect(await el.revealSourceKey('k999999')).to.equal(true);
  const last = el.shadowRoot!.querySelector('[data-source-key="k999999"]')!;
  expect(last.getAttribute('aria-level')).to.equal('1000000');
  expect(last.getAttribute('aria-setsize')).to.equal('1');
  expect(el.shadowRoot!.querySelectorAll('[part~="source-row"]').length).to.be.at.most(301);
  recordScaleMeasurement('lr-xml-viewer', 'source-deep@1000000', { logical: 1_000_000, reads, values, maximum, mounted: el.shadowRoot!.querySelectorAll('[part~="source-row"]').length });
  expect(maximum).to.be.at.most(2); expect(reads).to.be.lessThan(20); expect(values).to.be.lessThan(2000);
});

it('rejects oversized fields and a viewport whose individually valid records exceed aggregate payload', async () => {
  for (const overflow of ['field', 'aggregate']) {
    const { provider } = source(400); let reads = 0;
    provider.project = async () => ({ state: 'state', total: 400, rows: overflow === 'aggregate' ? { count: 400,
      indexOfKey: async (key: string) => Number(key.slice(1)),
      read: async request => { reads++; return Array.from({ length: request.limit }, (_, offset) => row(request.offset + offset, 'x'.repeat(65536))); },
    } : { count: 400,
      keyAt: (index: number) => `k${index}`, indexOfKey: (key: string | number) => Number(String(key).slice(1)),
      itemAt: (index: number) => { reads++; return row(index, 'x'.repeat(overflow === 'field' ? 65537 : 65536)); },
    } });
    const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer max-height="12000px" .strings=${strings} .treeSource=${provider}></lr-xml-viewer>`);
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
    for (let frame = 0; frame < 12; frame++) { await el.updateComplete; await el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')?.updateComplete; await nextFrame(); }
    const before = reads; for (let frame = 0; frame < 8; frame++) await nextFrame();
    expect(reads).to.equal(before);
    expect(el.shadowRoot!.querySelectorAll('[part~="source-row"]').length).to.be.lessThan(31);
    el.remove();
  }
});

it('rejects provider copy overflow without clipboard or clipboard-error events', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard'); let writes = 0;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { writes++; } } });
  try {
    const { provider } = source(1); provider.copy = async () => 'é'.repeat(13 * 1024 * 1024);
    const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer copyable .strings=${strings} .treeSource=${provider}></lr-xml-viewer>`);
    await ready(el); let clipboardErrors = 0; el.addEventListener('lr-error', () => clipboardErrors++);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toolbar"] [part="copy-button"]')!.click();
    await waitUntil(() => el.shadowRoot!.querySelector('[part="toolbar"]')?.textContent?.includes('Copy failed') === true, 'bounded copy failure', { timeout: 5000 });
    expect(writes).to.equal(0); expect(clipboardErrors).to.equal(0);
  } finally { if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard'); }
});


it('uses unregistered English source fallbacks and accepts instance overrides', async () => {
  const { provider } = source(1);
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer lang="en" .treeSource=${provider}></lr-xml-viewer>`);
  await ready(el);
  expect(el.shadowRoot!.querySelector('[part~="source-status"]')?.textContent).to.include('1 visible of 1 nodes.');
  expect(await el.search('missing')).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="search-status"]')?.textContent).to.include('Search is unavailable for this data source.');
  el.strings = { sourceSearchUnavailable: 'Custom unavailable' }; await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="search-status"]')?.textContent).to.include('Custom unavailable');
});

it('suppresses a legacy clipboard completion after provider display takes authority', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard'); const pending = deferred<void>(); let writes = 0;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => { writes++; return pending.promise; } } });
  try {
    const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer copyable .xml=${'<legacy />'}></lr-xml-viewer>`);
    let copies = 0; el.addEventListener('lr-copy', () => copies++);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toolbar"] [part="copy-button"]')!.click();
    await waitUntil(() => writes === 1);
    el.treeSource = source(1).provider; await ready(el); pending.resolve();
    await new Promise(resolve => setTimeout(resolve, 20)); expect(copies).to.equal(0);
  } finally { if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard'); }
});

it('keeps inline XML parsing synchronous while provider display bypasses src fetch and restores current inline input', async () => {
  const originalFetch = window.fetch; let fetches = 0;
  window.fetch = async () => { fetches++; return new Response('<fetched />'); };
  try {
    const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer src="/ignored.xml" .strings=${strings} .treeSource=${source(1).provider}></lr-xml-viewer>`);
    await ready(el); expect(fetches).to.equal(0); expect(el.source).to.deep.equal({ kind: 'url', url: '/ignored.xml' });
    let failures = 0; el.addEventListener('lr-render-error', () => failures++);
    el.xml = '<broken>'; expect(failures).to.equal(1);
    el.xml = '<current attr="yes" />'; await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part~="source-row"]')).not.to.equal(null);
    el.treeSource = undefined; await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.include('current'); expect(fetches).to.equal(0);
    el.treeSource = source(1).provider; await ready(el); el.xml = undefined;
    await el.updateComplete; expect(fetches).to.equal(0);
    el.treeSource = undefined; await waitUntil(() => el.shadowRoot!.textContent!.includes('fetched'));
    expect(fetches).to.equal(1);
  } finally { window.fetch = originalFetch; }
});

function canonicalSource() {
  const keys = ['[]', '[0]', '[0,"@id"]']; const reveals: string[] = [];
  const provider: Source = { revision: 1, async project(request) {
    if (request.action.type === 'reveal') reveals.push(request.action.key);
    const focus = request.action.type === 'reveal' ? keys.indexOf(request.action.key) : -1;
    return { state: 'canonical', total: 3, rows: { count: 3, keyAt: index => keys[index]!, indexOfKey: (key: string | number) => keys.indexOf(String(key)),
      itemAt: index => ({ ...row(index), key: keys[index]!, value: { name: index === 2 ? 'id' : index ? 'child' : 'root', path: keys[index]!, kind: index === 2 ? 'attribute' : 'element', value: index === 2 ? 'exact attribute' : undefined } }) }, ...(focus < 0 ? {} : { focusIndex: focus }) };
  } };
  return { provider, reveals };
}

it('resolves canonical element and exact attribute anchors and paints only their matching highlights', async () => {
  const { provider, reveals } = canonicalSource();
  const highlight = { id: 'attribute', anchor: { kind: 'node-path' as const, path: [0, '@id'] }, label: 'Exact attribute' };
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer .strings=${strings} .treeSource=${provider} .highlights=${[highlight]}></lr-xml-viewer>`);
  await ready(el);
  expect(await el.scrollToAnchor({ kind: 'node-path', path: [0, '@id'] })).to.equal(true);
  expect(reveals.at(-1)).to.equal('[0,"@id"]');
  const attribute = Array.from(el.shadowRoot!.querySelectorAll('[part~="source-row"]')).find(row => row.getAttribute('data-source-key') === '[0,"@id"]')!;
  expect(attribute.querySelector('[part="attribute"][data-active]')).not.to.equal(null);
  expect(attribute.querySelector('[data-highlight]')).not.to.equal(null);
  expect(el.shadowRoot!.querySelectorAll('[part="highlight-action"]').length).to.equal(1);
  let id = ''; el.addEventListener('lr-highlight-activate', event => { id = event.detail.highlightId; });
  attribute.querySelector<HTMLButtonElement>('[part="highlight-action"]')!.click(); expect(id).to.equal('attribute');
  expect(await el.scrollToAnchor({ kind: 'node-path', path: [] })).to.equal(true);
});

it('cancels pending anchor retries on query, clear, replacement and direct provider reveal', async () => {
  for (const boundary of ['query', 'clear', 'replace', 'reveal']) {
    const { provider } = canonicalSource(); const project = provider.project; let pending = false;
    const gate = deferred<Awaited<ReturnType<Source['project']>>>();
    provider.project = request => {
      if (request.action.type === 'reveal' && request.action.key === '[9]') { pending = true; return gate.promise; }
      return project(request);
    };
    const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer .strings=${strings} .treeSource=${provider}></lr-xml-viewer>`);
    await ready(el); const anchor = el.scrollToAnchor({ kind: 'node-path', path: [9] }); await waitUntil(() => pending);
    if (boundary === 'query') void el.search('new');
    if (boundary === 'clear') el.clearSearch();
    if (boundary === 'replace') el.treeSource = canonicalSource().provider;
    if (boundary === 'reveal') void el.revealSourceKey('[]');
    gate.resolve(await project({ revision: 1, locale: 'en', action: { type: 'reset' }, state: null, query: { search: '', hiddenKinds: [] }, signal: new AbortController().signal }));
    expect(await anchor, boundary).to.equal(false); el.remove();
  }
});

it('does not emit clipboard failure events after localization installs a newer source', async () => {
 const original=Object.getOwnPropertyDescriptor(navigator,'clipboard');
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied');}}});
 try {
  const {provider}=source(1);provider.copy=async()=> 'old';
  const el=await fixture<LyraXmlViewer>(html`<lr-xml-viewer copyable .treeSource=${provider}></lr-xml-viewer>`);await ready(el);
  let errors=0;el.addEventListener('lr-error',()=>errors++);
  const seam = el as unknown as { localize(key: string, ...args: unknown[]): string };
  const localize=seam.localize.bind(el);let replaced=false;
  seam.localize=((key: string, ...args: unknown[])=>{if(key==='copyFailed'&&!replaced){replaced=true;el.treeSource=source(1).provider;}return (localize as Function)(key,...args);}) as typeof seam.localize;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toolbar"] [part="copy-button"]')!.click();
  await waitUntil(()=>replaced);await nextFrame();expect(errors).to.equal(0);
 } finally {if(original)Object.defineProperty(navigator,'clipboard',original);else Reflect.deleteProperty(navigator,'clipboard');}
});
it('does not run a detached source row copy after a newer projection commits', async()=>{
 const original=Object.getOwnPropertyDescriptor(navigator,'clipboard');Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}});
 try {
  const {provider}=source(2);const project=provider.project;provider.project=async request=>request.action.type==='reveal'?{state:'new',total:2,rows:{count:1,keyAt:()=> 'k1',indexOfKey:()=>0,itemAt:()=>row(1)},focusIndex:0}:project(request);let copies=0;provider.copy=async()=>{copies++;return 'value';};
  const el=await fixture<LyraXmlViewer>(html`<lr-xml-viewer copyable .treeSource=${provider}></lr-xml-viewer>`);await ready(el);
  const old=el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="source-row"] [part="copy-button"]')!;
  expect(await el.revealSourceKey('k1')).to.equal(true);await el.updateComplete;
  expect(old.isConnected).to.equal(false);old.click();await nextFrame();expect(copies).to.equal(0);
 } finally {if(original)Object.defineProperty(navigator,'clipboard',original);else Reflect.deleteProperty(navigator,'clipboard');}
});
it('does not publish a superseded source search navigation', async()=>{
 const {provider}=source(3);provider.search=async()=>({hits:[{key:'k0'},{key:'k1'}],total:2,exhaustive:true});
 const project=provider.project;const pending=deferred<Awaited<ReturnType<Source['project']>>>();let held=false;let hold=false;
 provider.project=async req=>{const result=await project(req);if(req.action.type==='reveal'&&req.action.key==='k1'&&hold){held=true;return pending.promise;}return result;};
 const el=await fixture<LyraXmlViewer>(html`<lr-xml-viewer .treeSource=${provider}></lr-xml-viewer>`);await ready(el);expect(await el.search('x')).to.equal(2);hold=true;
 let events=0;el.addEventListener('lr-search-change',()=>events++);
 const old=el.searchNext();await waitUntil(()=>held);const current=el.searchNext();
 expect(await old).to.equal(false);expect(events).to.equal(0);
 pending.resolve(await project({revision:1,locale:'en',signal:new AbortController().signal,state:null,query:{search:'x',hiddenKinds:[]},action:{type:'reveal',key:'k0'}}));
 expect(await current).to.equal(true);expect(events).to.equal(1);
});

it('does not let a pending canonical anchor regain focus after user keyboard navigation', async () => {
  const { provider } = canonicalSource(); const project = provider.project;
  const gate = deferred<Awaited<ReturnType<Source['project']>>>(); let held = false;
  provider.project = request => { if (request.action.type === 'reveal') { held = true; return gate.promise; } return project(request); };
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer .strings=${strings} .treeSource=${provider}></lr-xml-viewer>`);
  await ready(el); const first = el.shadowRoot!.querySelector<HTMLElement>('[part~="source-row"]')!;
  await focusByKeyboard(first);
  const pending = el.scrollToAnchor({ kind: 'node-path', path: [0, '@id'] }); await waitUntil(() => held);
  await sendKeys({ press: 'Home' });
  gate.resolve(await project({ revision: 1, locale: 'en', action: { type: 'reveal', key: '[0,"@id"]' }, state: null, query: { search: '', hiddenKinds: [] }, signal: new AbortController().signal }));
  expect(await pending).to.equal(false); await new Promise(resolve => setTimeout(resolve, 30));
  const active = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(active?.getAttribute('data-source-key')).to.equal('[]');
});

it('accepts an initial canonical anchor property and rejects bounded malformed paths', async () => {
  const { provider, reveals } = canonicalSource();
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer .strings=${strings} .treeSource=${provider} .anchor=${{ kind: 'node-path', path: [0, '@id'] }}></lr-xml-viewer>`);
  await ready(el); await waitUntil(() => reveals.includes('[0,"@id"]'));
  const seam = el as unknown as { anchorTimeoutMs: number; anchorRetryIntervalMs: number };
  seam.anchorTimeoutMs = 30; seam.anchorRetryIntervalMs = 10;
  for (const path of [[-1], [0.5], ['@'], Array.from({ length: 257 }, () => 0)]) {
    expect(await el.scrollToAnchor({ kind: 'node-path', path })).to.equal(false);
  }
  expect(reveals.every(key => key === '[0,"@id"]')).to.equal(true);
});

it('checks complete UTF-8 provider copy against normalized XML maxBytes', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard'); let writes = 0;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { writes++; } } });
  try {
    const { provider } = source(1); let limit = 0;
    provider.copy = async request => { limit = request.maxBytes; return 'ééé'; };
    const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer copyable max-bytes="5" .treeSource=${provider}></lr-xml-viewer>`);
    await ready(el); let errors = 0; el.addEventListener('lr-error', () => errors++);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toolbar"] [part="copy-button"]')!.click();
    await waitUntil(() => el.shadowRoot!.querySelector('[part="toolbar"]')?.textContent?.includes('Copy failed') === true);
    expect(limit).to.equal(5); expect(writes).to.equal(0); expect(errors).to.equal(0);
  } finally { if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard'); }
});

it('rejects a detached source highlight action after a replacement projection', async () => {
  const {provider}=canonicalSource();
  const highlight={id:'old',anchor:{kind:'node-path' as const,path:[0,'@id']},label:'old'};
  const el=await fixture<LyraXmlViewer>(html`<lr-xml-viewer .treeSource=${provider} .highlights=${[highlight]}></lr-xml-viewer>`);await ready(el);
  const button=el.shadowRoot!.querySelector<HTMLButtonElement>('[part="highlight-action"]')!;
  expect(Boolean(button)).to.equal(true);
  el.treeSource=source(1).provider;await ready(el);await el.updateComplete;
  await waitUntil(()=>!button.isConnected);
  let count=0;el.addEventListener('lr-highlight-activate',()=>count++);button.click();
  expect(count).to.equal(0);
});
it('suppresses an obsolete source error after a localization callback replaces it',async()=>{
 const el=await fixture<LyraXmlViewer>(html`<lr-xml-viewer .treeSource=${source(1).provider}></lr-xml-viewer>`);await ready(el);
 const seam=el as unknown as {localize(key:string,...args:unknown[]):string;hierarchy:{error:unknown}};
 const original=seam.localize.bind(el);let count=0;let replaced=false;let errorLabels=0;
 el.addEventListener('lr-render-error',()=>count++);
 seam.localize=((key:string,...args:unknown[])=>{if(key==='treeSourceError'&&seam.hierarchy.error&&!replaced&&++errorLabels===2){replaced=true;el.treeSource=source(1).provider;}return (original as Function)(key,...args);}) as typeof seam.localize;
 const warnings=await captureReentrantUpdateWarning('lr-xml-viewer',async()=>{
  el.treeSource={revision:1,project:async()=>{throw new Error('old');}};
  await waitUntil(()=>replaced);await nextFrame();expect(count).to.equal(0);
 });
 expect(warnings).to.equal(1);
});
