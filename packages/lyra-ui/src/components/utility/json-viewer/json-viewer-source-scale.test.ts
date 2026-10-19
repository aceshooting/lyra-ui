import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expect, fixture, html, waitUntil, nextFrame } from '@open-wc/testing';
import type { LyraHierarchyQuery, LyraHierarchyRow, LyraHierarchySource, LyraInspectionNode } from '../../../data-sources.js';
import type { LyraJsonViewer } from './json-viewer.class.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sendKeys } from '@web/test-runner-commands';
import './json-viewer.js';

type Source = LyraHierarchySource<LyraInspectionNode, LyraHierarchyQuery>;
const strings = { jsonValue: 'JSON value', loading: 'Loading', treeSourceError: 'Unable to load tree data.', treeSourceSummary: '{visible} visible of {total} nodes.',
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
      keyAt: i => { counters.keys++; return `k${i}`; },
      indexOfKey: (key: string | number) => { counters.lookups++; return Number(String(key).slice(1)); },
      itemAt: i => { counters.values++; return row(i); },
    }, ...(key && /^k\d+$/.test(key) && Number(key.slice(1)) < count ? { focusIndex: Number(key.slice(1)) } : {}) };
  } };
  return { provider, counters };
}
const ready = (el: LyraJsonViewer) => waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-row"]')));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

it('reaches first middle and actual millionth JSON source rows without traversing legacy data', async () => {
  expectDevWarning('virtual-list-scroll-scaling');
  let traversals = 0;
  const data = new Proxy({}, { ownKeys() { traversals++; throw new Error('Legacy traversal'); } });
  const { provider, counters } = source();
  const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer style="width:320px" max-height="240px" .strings=${strings} .data=${data} .treeSource=${provider}></lr-json-viewer>`);
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
  recordScaleMeasurement('lr-json-viewer', 'source-wide@1000000', { logical: (list.source as { count: number }).count, values: counters.values, keys: counters.keys, lookups: counters.lookups, projects: counters.projects, mounted: el.shadowRoot!.querySelectorAll('[part~="source-row"]').length, retained: (el as unknown as { hierarchy: { window: { local: Map<number, unknown> } } }).hierarchy.window.local.size });
  expect(counters.values).to.be.lessThan(1000);
  expect(el.shadowRoot!.querySelectorAll('[part="copy-button"]').length).to.equal(0);
});

it('uses global node hits independently of maxNodes and moves the JSON cursor without repeating search', async () => {
  expectDevWarning('virtual-list-scroll-scaling');
  const { provider } = source(); let searches = 0; const queries: string[] = [];
  const project = provider.project;
  provider.project = request => { queries.push(request.query.search); return project(request); };
  provider.search = async request => { searches++; expect(request.limit).to.equal(10000); expect(request.query).to.equal('final');
    return { hits: [{ key: 'k999999' }], total: 1, exhaustive: true }; };
  const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer max-nodes="1" .strings=${strings} .treeSource=${provider}></lr-json-viewer>`);
  await ready(el);
  const details: { activeIndex: number; matchCount: number; matchCountExact: boolean }[] = [];
  el.addEventListener('lr-search-change', event => details.push(event.detail));
  expect(await el.runSearch('final')).to.equal(1);
  expect(details.at(-1)).to.include({ activeIndex: -1, matchCount: 1, matchCountExact: true });
  expect(await el.searchNext()).to.equal(true);
  expect(el.shadowRoot!.querySelector('[data-source-key="k999999"]')).not.to.equal(null);
  expect(await el.searchPrevious()).to.equal(true);
  expect(searches).to.equal(1); expect(queries).to.include('final');
  el.clearSearch(); await el.updateComplete;
  expect(details.at(-1)).to.include({ activeIndex: -1, matchCount: 0 });
});

it('reports unavailable and partial search honestly and rejects oversized source queries', async () => {
  const { provider } = source(10);
  const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer .strings=${strings} .treeSource=${provider}></lr-json-viewer>`);
  await ready(el); let detail: { matchCountExact: boolean } | undefined;
  el.addEventListener('lr-search-change', event => { detail = event.detail; });
  expect(await el.runSearch('missing')).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="search-status"]')?.textContent).to.include('Search unavailable');
  expect(detail?.matchCountExact).to.equal(false);
  provider.search = async () => ({ hits: [{ key: 'k9' }], total: null, exhaustive: false });
  expect(await el.runSearch('partial')).to.equal(1); expect(detail?.matchCountExact).to.equal(false);
  expect(el.shadowRoot!.querySelector('[part="search-status"]')).not.to.equal(null);
  expect(await el.runSearch('x'.repeat(4097))).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part~="source-error"]')).not.to.equal(null);
});

it('copies complete provider scopes and suppresses a stale provider result before clipboard effects', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard'); const writes: string[] = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { writes.push(text); } } });
  try {
    const { provider } = source(2); const scopes: string[] = []; let pending: ReturnType<typeof deferred<string>> | undefined;
    provider.copy = async request => { scopes.push(`${request.scope}:${request.key}`); expect(request.maxBytes).to.equal(25 * 1024 * 1024);
      return pending ? pending.promise : `complete:${request.scope}`; };
    const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer copyable .strings=${strings} .treeSource=${provider}></lr-json-viewer>`);
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
  const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer .data=${{ legacy: 'old' }} .strings=${strings} .treeSource=${provider}></lr-json-viewer>`);
  await ready(el); const calls = counters.projects;
  el.maxHeight = '220px'; await el.updateComplete; expect(counters.projects).to.equal(calls);
  value = 'Second'; el.requestUpdate(); el.copyable = true;
  await waitUntil(() => el.shadowRoot!.textContent!.includes('Second')); expect(counters.projects).to.equal(calls + 1);
  el.data = { legacy: 'current' }; await el.updateComplete;
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
  const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer .strings=${strings} .treeSource=${provider}></lr-json-viewer>`);
  await ready(el); const element = el.shadowRoot!.querySelector<HTMLElement>('[part~="source-row"]')!;
  expect(element.getAttribute('aria-level')).to.equal('1000000'); expect(element.style.getPropertyValue('--source-depth')).to.equal('32');
  invalid = true; el.treeSource = provider;
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]'))); expect(getters).to.equal(0);
});

it('uses shared keyboard navigation to reach the final JSON source node', async () => {
  expectDevWarning('virtual-list-scroll-scaling'); const { provider } = source();
  const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer .strings=${strings} .treeSource=${provider}></lr-json-viewer>`);
  await ready(el); await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[part~="source-row"]')!);
  await sendKeys({ press: 'End' });
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[data-source-key="k999999"]')));
});

it('repeats same-query search as a new intent and settles coalesced older calls without publishing their hits', async () => {
  const { provider } = source(2); let searches = 0;
  provider.search = async () => { searches++; return { hits: [{ key: 'k1' }], total: 1, exhaustive: true }; };
  const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer .strings=${strings} .treeSource=${provider}></lr-json-viewer>`);
  await ready(el);
  expect(await el.runSearch('same')).to.equal(1); expect(await el.runSearch('same')).to.equal(1);
  expect(searches).to.equal(2);
  const old = el.runSearch('old'); const latest = el.runSearch('new');
  expect(await old).to.equal(0); expect(await latest).to.equal(1);
});

it('holds one physical provider search across supersession and rejects malformed whole hit replies', async () => {
  const { provider } = source(2); const pending = deferred<{ hits: { key: string }[]; total: number; exhaustive: boolean }>(); let searches = 0;
  provider.search = async () => { searches++; return searches === 1 ? pending.promise : { hits: [{ key: 'k1' }], total: 1, exhaustive: true }; };
  const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer .strings=${strings} .treeSource=${provider}></lr-json-viewer>`);
  await ready(el);
  const old = el.runSearch('old'); await waitUntil(() => searches === 1);
  const latest = el.runSearch('latest'); expect(await old).to.equal(0); expect(searches).to.equal(1);
  pending.resolve({ hits: [{ key: 'k0' }], total: 1, exhaustive: true });
  expect(await latest).to.equal(1); expect(searches).to.equal(2);
  provider.search = async () => ({ hits: Array.from({ length: 10001 }, (_, i) => ({ key: `k${i}` })), total: 10001, exhaustive: true });
  expect(await el.runSearch('overflow')).to.equal(0);
  expect(await el.searchNext()).to.equal(false);
});

it('revokes provider search on replacement, unset, disconnect, adoption and locale changes', async () => {
  for (const boundary of ['replace', 'unset', 'disconnect', 'adopt', 'locale']) {
    const { provider } = source(2); const pending = deferred<{ hits: { key: string }[]; total: number; exhaustive: boolean }>(); let called = false;
    provider.search = () => { called = true; return pending.promise; };
    const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer .data=${{ restored: true }} .strings=${strings} .treeSource=${provider}></lr-json-viewer>`);
    await ready(el); const task = el.runSearch('old'); await waitUntil(() => called);
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
    const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer copyable .strings=${strings} .treeSource=${provider}></lr-json-viewer>`);
    await ready(el); let copied = 0; el.addEventListener('lr-copy', () => copied++);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="source-row"] [part="copy-button"]')!.click();
    await waitUntil(() => writes === 1); expect(scope).to.equal('subtree');
    el.treeSource = source(1).provider; write.resolve();
    await el.updateComplete; await new Promise(resolve => setTimeout(resolve, 20)); expect(copied).to.equal(0);
  } finally { if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard'); }
});

it('does not write clipboard when a clipboard capability getter replaces provider authority', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard'); let writes = 0; let el!: LyraJsonViewer;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, get() {
    el.treeSource = source(1).provider;
    return { writeText: async () => { writes++; } };
  } });
  try {
    const { provider } = source(1); provider.copy = async () => 'old';
    el = await fixture<LyraJsonViewer>(html`<lr-json-viewer copyable .strings=${strings} .treeSource=${provider}></lr-json-viewer>`);
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
  const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer max-height="200px" .strings=${strings} .treeSource=${provider}></lr-json-viewer>`);
  await ready(el);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key="k0"] [part~="source-toggle"]')!.click();
  await waitUntil(() => el.shadowRoot!.querySelector('[data-source-key="k0"]')?.getAttribute('aria-expanded') === 'false');
  expect(await el.revealSourceKey('k999999')).to.equal(true);
  const last = el.shadowRoot!.querySelector('[data-source-key="k999999"]')!;
  expect(last.getAttribute('aria-level')).to.equal('1000000');
  expect(last.getAttribute('aria-setsize')).to.equal('1');
  expect(el.shadowRoot!.querySelectorAll('[part~="source-row"]').length).to.be.at.most(301);
  recordScaleMeasurement('lr-json-viewer', 'source-deep@1000000', { logical: 1_000_000, reads, values, maximum, mounted: el.shadowRoot!.querySelectorAll('[part~="source-row"]').length });
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
    const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer max-height="12000px" .strings=${strings} .treeSource=${provider}></lr-json-viewer>`);
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
    const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer copyable .strings=${strings} .treeSource=${provider}></lr-json-viewer>`);
    await ready(el); let clipboardErrors = 0; el.addEventListener('lr-error', () => clipboardErrors++);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toolbar"] [part="copy-button"]')!.click();
    await waitUntil(() => el.shadowRoot!.querySelector('[part="toolbar"]')?.textContent?.includes('Copy failed') === true, 'bounded copy failure', { timeout: 5000 });
    expect(writes).to.equal(0); expect(clipboardErrors).to.equal(0);
  } finally { if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard'); }
});


it('uses unregistered English source fallbacks and accepts instance overrides', async () => {
  const { provider } = source(1);
  const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer lang="en" .treeSource=${provider}></lr-json-viewer>`);
  await ready(el);
  expect(el.shadowRoot!.querySelector('[part~="source-status"]')?.textContent).to.include('1 visible of 1 nodes.');
  expect(await el.runSearch('missing')).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="search-status"]')?.textContent).to.include('Search is unavailable for this data source.');
  el.strings = { sourceSearchUnavailable: 'Custom unavailable' }; await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="search-status"]')?.textContent).to.include('Custom unavailable');
});

it('suppresses a legacy clipboard completion after provider display takes authority', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard'); const pending = deferred<void>(); let writes = 0;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => { writes++; return pending.promise; } } });
  try {
    const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer copyable .data=${{ legacy: true }}></lr-json-viewer>`);
    let copies = 0; el.addEventListener('lr-copy', () => copies++);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toolbar"] [part="copy-button"]')!.click();
    await waitUntil(() => writes === 1);
    el.treeSource = source(1).provider; await ready(el); pending.resolve();
    await new Promise(resolve => setTimeout(resolve, 20)); expect(copies).to.equal(0);
  } finally { if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard'); }
});

it('does not emit clipboard failure events after localization installs a newer source', async () => {
 const original=Object.getOwnPropertyDescriptor(navigator,'clipboard');
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied');}}});
 try {
  const {provider}=source(1);provider.copy=async()=> 'old';
  const el=await fixture<LyraJsonViewer>(html`<lr-json-viewer copyable .treeSource=${provider}></lr-json-viewer>`);await ready(el);
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
  const el=await fixture<LyraJsonViewer>(html`<lr-json-viewer copyable .treeSource=${provider}></lr-json-viewer>`);await ready(el);
  const old=el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="source-row"] [part="copy-button"]')!;
  expect(await el.revealSourceKey('k1')).to.equal(true);await el.updateComplete;
  expect(old.isConnected).to.equal(false);old.click();await nextFrame();expect(copies).to.equal(0);
 } finally {if(original)Object.defineProperty(navigator,'clipboard',original);else Reflect.deleteProperty(navigator,'clipboard');}
});
it('does not publish a superseded source search navigation', async()=>{
 const {provider}=source(3);provider.search=async()=>({hits:[{key:'k0'},{key:'k1'}],total:2,exhaustive:true});
 const project=provider.project;const pending=deferred<Awaited<ReturnType<Source['project']>>>();let held=false;
 provider.project=async req=>{const result=await project(req);if(req.action.type==='reveal'&&req.action.key==='k0'){held=true;return pending.promise;}return result;};
 const el=await fixture<LyraJsonViewer>(html`<lr-json-viewer .treeSource=${provider}></lr-json-viewer>`);await ready(el);expect(await el.runSearch('x')).to.equal(2);
 let events=0;el.addEventListener('lr-search-change',()=>events++);
 const old=el.searchNext();await waitUntil(()=>held);const current=el.searchNext();
 expect(await old).to.equal(false);expect(events).to.equal(0);
 pending.resolve(await project({revision:1,locale:'en',signal:new AbortController().signal,state:null,query:{search:'x',hiddenKinds:[]},action:{type:'reveal',key:'k0'}}));
 expect(await current).to.equal(true);expect(events).to.equal(1);
});

describe('provider copy clipboard failures', () => {
  async function copyWith(clipboard: unknown) {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
    try {
      const { provider } = source(1);
      provider.copy = async () => 'provider-document';
      const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer copyable .strings=${strings} .treeSource=${provider}></lr-json-viewer>`);
      await ready(el);
      const events: string[] = [];
      let outcome: { ok: boolean; reason?: string; text?: string } | undefined;
      el.addEventListener('lr-error', () => events.push('error'));
      el.addEventListener('lr-copy', () => events.push('copy'));
      el.addEventListener('lr-copy-error', (event) => { events.push('copy-error'); outcome = (event as CustomEvent).detail; });
      el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toolbar"] [part="copy-button"]')!.click();
      await waitUntil(() => events.includes('copy-error'), 'copy failure event');
      return { events, outcome };
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  }

  it('reports an unsupported outcome when the clipboard API is absent', async () => {
    const { events, outcome } = await copyWith(undefined);
    expect(events).to.deep.equal(['error', 'copy-error']);
    expect(outcome).to.include({ ok: false, reason: 'unsupported', text: 'provider-document' });
  });

  it('reports a denied outcome when the clipboard write is refused', async () => {
    const { events, outcome } = await copyWith({
      writeText: () => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })),
    });
    expect(events).to.deep.equal(['error', 'copy-error']);
    expect(outcome).to.include({ ok: false, reason: 'denied' });
  });
});
