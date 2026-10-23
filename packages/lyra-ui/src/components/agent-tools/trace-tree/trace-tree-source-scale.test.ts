import { captureReentrantUpdateWarning } from '../../../../test/expected-lit-update.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import type { LyraHierarchySource, LyraHierarchyQuery, LyraHierarchyRow, LyraTraceSourceSummary } from '../../../data-sources.js';
import type { LyraTraceTree } from './trace-tree.class.js';
import type { LyraSpan } from './span.js';
import './trace-tree.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
expectDevWarning('virtual-list-scroll-scaling');

type Source = LyraHierarchySource<LyraSpan, LyraHierarchyQuery, LyraTraceSourceSummary>;
type Tree = LyraTraceTree & { treeSource: Source | undefined; revealSourceKey(key: string): Promise<boolean> };
const count = 1_000_000;
function row(index: number): LyraHierarchyRow<LyraSpan> {
  const key = `span${index}`;
  return { key, value: { id: key, name: key, kind: 'tool', status: 'success', startMs: 110, endMs: 120 },
    parentKey: null, level: 1, position: index + 1, setSize: count, childCount: 0, expanded: false, selected: false };
}
function provider(ranged = false) {
  const counters = { items: 0, keys: 0, reads: 0, largest: 0, active: 0, peak: 0, projects: 0 };
  const source: Source = { revision: 1, async project(request) {
    counters.projects++;
    return { state: `projection${counters.projects}`, total: count, summary: { startMs: 100, endMs: 200 },
      rows: ranged ? { count, async indexOfKey(key: string) { return /^span\d+$/.test(key) ? Number(key.slice(4)) : null; },
        async read(request) {
          counters.reads++; counters.active++; counters.peak = Math.max(counters.peak, counters.active);
          counters.largest = Math.max(counters.largest, request.limit);
          await new Promise(resolve => setTimeout(resolve, 1)); counters.active--;
          return Array.from({ length: request.limit }, (_, i) => row(request.offset + i));
        } } : { count, keyAt(index: number) { counters.keys++; return `span${index}`; },
        indexOfKey(key: string | number) { return /^span\d+$/.test(String(key)) ? Number(String(key).slice(4)) : -1; },
        itemAt(index: number) { counters.items++; return row(index); } },
      ...(request.action.type === 'reveal' && /^span\d+$/.test(request.action.key)
        ? { focusIndex: Number(request.action.key.slice(4)) } : {}) };
  } };
  return { source, counters };
}
async function ready(el: Tree, key = 'span0') {
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector(`[data-source-key="${key}"]`)), 'source row mounts', { timeout: 20000 });
}
for (const ranged of [false, true]) it(`reaches the generated million-span ${ranged ? 'ranged' : 'indexed'} source with bounded work`, async () => {
  const { source, counters } = provider(ranged);
  const el = await fixture<Tree>(html`<lr-trace-tree .treeSource=${source}></lr-trace-tree>`);
  await ready(el);
  expect(await el.revealSourceKey('span500000')).to.equal(true);
  await ready(el, 'span500000');
  expect(await el.revealSourceKey('span999999')).to.equal(true);
  await ready(el, 'span999999');
  expect(el.shadowRoot!.querySelector('[data-source-key="span999999"]')!.getAttribute('aria-posinset')).to.equal(String(count));
  const mounted = el.shadowRoot!.querySelectorAll('[data-source-key]').length;
  expect(mounted).to.be.at.most(301);
  expect(counters.items).to.be.lessThan(1000);
  expect(counters.reads).to.be.lessThan(20);
  expect(counters.largest).to.be.at.most(100);
  expect(counters.peak).to.be.at.most(2);
  recordScaleMeasurement('lr-trace-tree', `million generated ${ranged ? 'ranged' : 'indexed'} spans`, { reads: counters.items, keyReads: counters.keys, rangeReads: counters.reads, largestRead: counters.largest, peakPhysicalReads: counters.peak, projections: counters.projects, mountedRows: mounted });
});
it('navigates End across the full source and uses the global nonzero extent', async () => {
  const { source } = provider();
  const el = await fixture<Tree>(html`<lr-trace-tree .treeSource=${source}></lr-trace-tree>`);
  await ready(el);
  const bar = el.shadowRoot!.querySelector<HTMLElement>('[part="bar"]')!;
  expect(bar.style.insetInlineStart).to.equal('10%');
  expect(bar.style.inlineSize).to.equal('10%');
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[role="tree"]')!);
  await sendKeys({ press: 'End' });
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[data-source-key="span999999"][tabindex="0"]')));
});
it('gives an invalid present source precedence over legacy spans', async () => {
  const el = await fixture<Tree>(html`<lr-trace-tree .spans=${[row(0).value]} .treeSource=${null}></lr-trace-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
  expect(el.shadowRoot!.querySelectorAll('[data-id]').length).to.equal(0);
  el.treeSource = undefined; await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[data-id]').length).to.equal(1);
});

it('revokes retained provider toggles after replacement even when the key is reused', async () => {
  function parentSource() {
    let calls = 0;
    const source: Source = { revision: 1, async project() {
      calls++;
      return { state: `s${calls}`, total: 1, summary: { startMs: 0, endMs: 200 }, rows: {
        count: 1, keyAt: () => 'span0', indexOfKey: () => 0,
        itemAt: () => ({ ...row(0), setSize: 1, childCount: 1 }),
      } };
    } };
    return { source, calls: () => calls };
  }
  const original = parentSource(); const replacement = parentSource();
  const el = await fixture<Tree>(html`<lr-trace-tree .treeSource=${original.source}></lr-trace-tree>`);
  await ready(el);
  const old = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key] [part="source-toggle"]')!;
  el.treeSource = replacement.source;
  await ready(el);
  await waitUntil(() => replacement.calls() === 1);
  await el.updateComplete;
  let events = 0; el.addEventListener('lr-span-toggle', () => events++);
  old.click();
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(replacement.calls()).to.equal(1);
  expect(events).to.equal(0);
});

it('preserves legacy behavior when the source is unset and revokes obsolete legacy controls', async () => {
  const spans = [row(0).value, { ...row(1).value, parentId: 'span0' }];
  const el = await fixture<Tree>(html`<lr-trace-tree .spans=${spans}></lr-trace-tree>`);
  const old = el.shadowRoot!.querySelector<HTMLElement>('[data-id="span0"]')!;
  let selects = 0; let toggles = 0;
  el.addEventListener('lr-span-select', () => selects++);
  el.addEventListener('lr-span-toggle', () => toggles++);
  old.click(); expect(selects).to.equal(1);
  el.treeSource = provider().source;
  old.click(); old.querySelector<HTMLButtonElement>('button')!.click();
  expect(selects).to.equal(1); expect(toggles).to.equal(0);
  await ready(el);
  el.treeSource = undefined; await el.updateComplete;
  old.click(); old.querySelector<HTMLButtonElement>('button')!.click();
  expect(selects).to.equal(1); expect(toggles).to.equal(0);
  el.shadowRoot!.querySelector<HTMLElement>('[data-id="span0"]')!.click();
  expect(selects).to.equal(2);
});
it('uses provider metadata and normalizes display fields without reading legacy topology or accessors', async () => {
  let parentReads = 0;
  const value = { ...row(0).value, kind: 'foreign', status: 'foreign' };
  Object.defineProperty(value, 'parentId', { get() { parentReads++; throw new Error('unused'); } });
  const source: Source = { revision: 1, async project() { return { state: 'one', total: 1,
    summary: { startMs: 100, endMs: 200 }, rows: { count: 1, keyAt: () => 'span0', indexOfKey: () => 0,
      itemAt: () => ({ ...row(0), value: value as LyraSpan, parentKey: 'external', level: 1000000, position: 5, setSize: 7, childCount: 0 }),
    } }; } };
  const el = await fixture<Tree>(html`<lr-trace-tree .treeSource=${source}></lr-trace-tree>`); await ready(el);
  const item = el.shadowRoot!.querySelector('[data-source-key]')!;
  expect(item.getAttribute('aria-level')).to.equal('1000000');
  expect(item.getAttribute('aria-posinset')).to.equal('5');
  expect(item.getAttribute('aria-setsize')).to.equal('7');
  expect(item.textContent).to.contain('Unknown');
  expect(parentReads).to.equal(0);
});
for (const summary of [undefined, { startMs: -1, endMs: 2 }, { startMs: 2, endMs: 1 }, { startMs: 0, endMs: Infinity }])
  it(`rejects malformed global extent ${JSON.stringify(summary)}`, async () => {
    const source = provider().source;
    const project = source.project;
    source.project = async request => ({ ...await project(request), summary: summary as LyraTraceSourceSummary });
    const el = await fixture<Tree>(html`<lr-trace-tree .treeSource=${source} .strings=${{ treeSourceError: 'Extent unavailable' }}></lr-trace-tree>`);
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
    expect(el.shadowRoot!.textContent).to.contain('Extent unavailable');
    expect(el.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(0);
  });
it('rejects accessor and oversized rendered values without invoking authored getters', async () => {
  let getters = 0;
  const source = provider().source;
  const value = { ...row(0).value };
  Object.defineProperty(value, 'name', { get() { getters++; return 'unsafe'; } });
  source.project = async () => ({ state: 'one', total: 1, summary: { startMs: 0, endMs: 200 },
    rows: { count: 1, keyAt: () => 'span0', indexOfKey: () => 0, itemAt: () => ({ ...row(0), value }) } });
  const el = await fixture<Tree>(html`<lr-trace-tree .treeSource=${source}></lr-trace-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
  expect(getters).to.equal(0);
  source.project = async () => ({ state: 'two', total: 1, summary: { startMs: 0, endMs: 200 },
    rows: { count: 1, keyAt: () => 'span0', indexOfKey: () => 0,
      itemAt: () => ({ ...row(0), value: { ...row(0).value, name: 'x'.repeat(65_537) } }) } });
  el.requestUpdate(); await el.updateComplete;
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
  expect(el.shadowRoot!.textContent!.length).to.be.lessThan(1000);
});
it('keeps named paints independent and forwards hidden kinds, revision and explicit refresh', async () => {
  const { source, counters } = provider();
  const queries: string[][] = [];
  const project = source.project;
  source.project = request => { queries.push([...request.query.hiddenKinds]); return project(request); };
  const el = await fixture<Tree>(html`<lr-trace-tree .treeSource=${source}></lr-trace-tree>`); await ready(el);
  expect(counters.projects).to.equal(1);
  el.label = 'Named'; el.withTokens = true; el.withCost = true; el.withoutBars = true;
  await el.updateComplete; await new Promise(resolve => setTimeout(resolve, 20));
  expect(counters.projects).to.equal(1);
  el.hiddenKinds = ['tool']; await el.updateComplete;
  await waitUntil(() => counters.projects === 2); await ready(el);
  expect(queries[1]).to.deep.equal(['tool']);
  el.requestUpdate(); await waitUntil(() => counters.projects === 3); await ready(el);
  el.treeSource = source; await waitUntil(() => counters.projects === 4); await ready(el);
  Object.defineProperty(source, 'revision', { value: 2 });
  el.requestUpdate('label'); await waitUntil(() => counters.projects === 5); await ready(el);
});
it('reveals controlled active IDs once and leaves later user navigation in place', async () => {
  const { source, counters } = provider();
  const el = await fixture<Tree>(html`<lr-trace-tree active-span-id="span500000" .treeSource=${source}></lr-trace-tree>`);
  await ready(el, 'span500000');
  expect(counters.projects).to.equal(2);
  expect(await el.revealSourceKey('span999999')).to.equal(true);
  el.withCost = true; await el.updateComplete;
  expect(counters.projects).to.equal(3);
  expect(el.shadowRoot!.querySelector('[data-source-key="span999999"][tabindex="0"]') !== null).to.equal(true);
  expect(await el.revealSourceKey('missing')).to.equal(false);
});
it('emits existing selection and toggle events once, with controlled active ID unchanged', async () => {
  const actions: string[] = [];
  let expanded = false;
  const source: Source = { revision: 1, async project(request) {
    actions.push(request.action.type);
    if (request.action.type === 'toggle') expanded = request.action.expanded;
    return { state: String(actions.length), total: 1, summary: { startMs: 0, endMs: 200 }, rows: {
      count: 1, keyAt: () => 'span0', indexOfKey: () => 0,
      itemAt: () => ({ ...row(0), setSize: 1, childCount: 1, expanded }),
    } };
  } };
  const el = await fixture<Tree>(html`<lr-trace-tree .treeSource=${source}></lr-trace-tree>`); await ready(el);
  const selected: string[] = []; const toggled: boolean[] = [];
  el.addEventListener('lr-span-select', event => selected.push(event.detail.spanId));
  el.addEventListener('lr-span-toggle', event => toggled.push(event.detail.expanded));
  el.shadowRoot!.querySelector<HTMLElement>('[data-source-key]')!.click();
  await waitUntil(() => selected.length === 1); await ready(el);
  expect(el.activeSpanId).to.equal(null);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key] [part="source-toggle"]')!.click();
  await waitUntil(() => toggled.length === 1);
  expect(selected).to.deep.equal(['span0']); expect(toggled).to.deep.equal([true]);
  expect(actions).to.deep.equal(['reset', 'select', 'toggle']);
});
it('does not call a project method returned by a getter that replaced its provider', async () => {
  const original = provider().source; const replacement = provider();
  let el: Tree; let obsoleteCalls = 0;
  Object.defineProperty(original, 'project', { get() { el.treeSource = replacement.source; return async () => { obsoleteCalls++; throw new Error('obsolete'); }; } });
  el = await fixture<Tree>(html`<lr-trace-tree></lr-trace-tree>`);
  el.treeSource = original;
  await ready(el);
  expect(obsoleteCalls).to.equal(0);
  expect(el.treeSource === replacement.source).to.equal(true);
});
it('replays source authority after disconnect and adoption', async () => {
  const { source, counters } = provider();
  const el = await fixture<Tree>(html`<lr-trace-tree .treeSource=${source}></lr-trace-tree>`); await ready(el);
  const parent = el.parentNode!;
  el.remove(); parent.appendChild(el); await ready(el); await waitUntil(() => counters.projects === 2);
  const frame = document.createElement('iframe'); document.body.append(frame);
  try {
    const owner = frame.contentDocument!;
    owner.body.append(owner.adoptNode(el));
    await waitUntil(() => counters.projects >= 3); await ready(el);
    expect(el.ownerDocument === owner).to.equal(true);
  } finally { parent.appendChild(document.adoptNode(el)); frame.remove(); }
});

it('bounds ignored-abort projections and never accepts a stale summary', async () => {
  let resolve!: (value: Awaited<ReturnType<Source['project']>>) => void;
  let calls = 0;
  const slow: Source = { revision: 1, project() { calls++; return new Promise(done => { resolve = done; }); } };
  const el = await fixture<Tree>(html`<lr-trace-tree .treeSource=${slow}></lr-trace-tree>`);
  await waitUntil(() => calls === 1);
  const replacement = provider();
  for (let i = 0; i < 100; i++) el.treeSource = replacement.source;
  await el.updateComplete;
  expect(replacement.counters.projects).to.equal(0);
  resolve({ state: 'obsolete', total: 1, summary: { startMs: 0, endMs: 1000 }, rows: {
    count: 1, keyAt: () => 'span0', indexOfKey: () => 0, itemAt: () => row(0),
  } });
  await ready(el);
  expect(replacement.counters.projects).to.equal(1);
  expect(el.shadowRoot!.querySelector<HTMLElement>('[part="bar"]')!.style.inlineSize).to.equal('10%');
});
it('guards indexed row method getters before invoking the returned obsolete function', async () => {
  const replacement = provider(); let el: Tree; let obsolete = 0;
  const rows = { count: 1, keyAt: () => 'span0', indexOfKey: () => 0, itemAt: () => row(0) };
  let reads = 0;
  Object.defineProperty(rows, 'itemAt', { get() {
    reads++;
    if (reads > 1) el.treeSource = replacement.source;
    return () => { obsolete++; return row(0); };
  } });
  const source: Source = { revision: 1, async project() { return { state: 'one', total: 1, rows, summary: { startMs: 0, endMs: 200 } }; } };
  el = await fixture<Tree>(html`<lr-trace-tree></lr-trace-tree>`);
  const warnings = await captureReentrantUpdateWarning('lr-virtual-list', async () => {
    el.treeSource = source;
    await waitUntil(() => el.treeSource === replacement.source); await ready(el);
  });
  expect(warnings).to.equal(1);
  expect(obsolete).to.equal(0);
});
it('keeps zero and extreme finite extents finite, including running endpoints', async () => {
  for (const summary of [{ startMs: 100, endMs: 100 }, { startMs: 1e308, endMs: 1.1e308 }]) {
    const source: Source = { revision: 1, async project() { return { state: 'one', total: 1, summary, rows: {
      count: 1, keyAt: () => 'span0', indexOfKey: () => 0,
      itemAt: () => ({ ...row(0), value: { ...row(0).value, startMs: summary.startMs, endMs: undefined, status: 'running' } }),
    } }; } };
    const el = await fixture<Tree>(html`<lr-trace-tree .treeSource=${source}></lr-trace-tree>`); await ready(el);
    const bar = el.shadowRoot!.querySelector<HTMLElement>('[part="bar"]')!;
    expect(bar.style.insetInlineStart).to.equal('0%');
    expect(bar.style.inlineSize).to.equal(summary.startMs === summary.endMs ? '1%' : '100%');
    expect(el.shadowRoot!.textContent).not.to.contain('Infinity');
  }
});
it('honors disabled provider metadata and RTL expansion without legacy topology', async () => {
  let actions = 0; let disabled = true;
  const source: Source = { revision: 1, async project() { actions++; return { state: String(actions), total: 1,
    summary: { startMs: 0, endMs: 200 }, rows: { count: 1, keyAt: () => 'span0', indexOfKey: () => 0,
      itemAt: () => ({ ...row(0), disabled, childCount: 3 }),
    } }; } };
  const el = await fixture<Tree>(html`<lr-trace-tree dir="rtl" .treeSource=${source}></lr-trace-tree>`); await ready(el);
  el.shadowRoot!.querySelector<HTMLElement>('[data-source-key]')!.click();
  expect(actions).to.equal(1);
  disabled = false; el.requestUpdate(); await waitUntil(() => actions === 2); await ready(el);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[data-source-key]')!);
  await sendKeys({ press: 'ArrowLeft' });
  await waitUntil(() => actions === 3);
});
it('uses translated source controls and does not announce loaded historical statuses', async () => {
  let failed = true;
  const p = provider(); const project = p.source.project;
  p.source.project = request => { if (failed) return Promise.reject(new Error('private failure')); return project(request); };
  const el = await fixture<Tree>(html`<lr-trace-tree .treeSource=${p.source} .strings=${{
    treeSourceError: 'Trace unavailable', retry: 'Try trace', treeSourceSummary: '{visible} visible / {total} total',
  }}></lr-trace-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
  expect(el.shadowRoot!.textContent).to.contain('Trace unavailable');
  expect(el.shadowRoot!.textContent).not.to.contain('private failure');
  const retry = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="source-error"] button')!;
  expect(retry.textContent).to.equal('Try trace'); failed = false; retry.click(); await ready(el);
  expect(el.shadowRoot!.textContent).to.contain('1,000,000 visible / 1,000,000 total');
  expect(el.shadowRoot!.querySelector('lr-live-region') === null).to.equal(true);
});

it('retains only four ranged pages plus the focused row for a large allocated viewport', async function () {
  this.timeout(30000); // Budget for a heavily loaded multi-browser host; the asserted bounds are unchanged.
  const { source, counters } = provider(true);
  const el = await fixture<Tree>(html`<lr-trace-tree style="height: 20000px" .treeSource=${source}></lr-trace-tree>`); await ready(el);
  expect(await el.revealSourceKey('span99')).to.equal(true);
  el.shadowRoot!.querySelector<HTMLElement>('[role="tree"]')!.style.blockSize = '20000px';
  const list = el.shadowRoot!.querySelector('lr-virtual-list') as import('../../layout/virtual-list/virtual-list.class.js').LyraVirtualList;
  list.scrollToIndex(199, { align: 'start', behavior: 'auto' });
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await list.updateComplete;
  await waitUntil(() => counters.active === 0, 'ranged reads settled', { timeout: 20000 });
  const mounted = el.shadowRoot!.querySelectorAll('[data-source-key]').length;
  expect(mounted).to.equal(301);
  const control = (el as unknown as { sourceControl: { window: { pages: Map<number, { slots?: unknown[] }> }; focused?: unknown } }).sourceControl;
  const retained = [...control.window.pages.values()].reduce((sum, page) => sum + (page.slots?.length ?? 0), 0) + (control.focused ? 1 : 0);
  expect(control.window.pages.size).to.be.at.most(4); expect(retained).to.be.at.most(401);
  recordScaleMeasurement('lr-trace-tree', 'large ranged viewport and focused row', { mountedRows: mounted, retainedRows: retained, peakPhysicalReads: counters.peak });
});
it('preserves active row accessibility and ignores legacy full-model expansion in provider mode', async () => {
  const { source, counters } = provider();
  const el = await fixture<Tree>(html`<lr-trace-tree active-span-id="span0" .treeSource=${source}></lr-trace-tree>`);
  await ready(el); await waitUntil(() => counters.projects === 2);
  await waitUntil(() => el.shadowRoot!.querySelector('[data-source-key="span0"]')?.getAttribute('aria-current') === 'true');
  const before = counters.projects;
  await el.expandAll(); el.collapseAll(); await el.updateComplete;
  expect(counters.projects).to.equal(before);
  Object.defineProperty(el, 'spans', { get() { throw new Error('Legacy model must remain unused'); }, configurable: true });
  el.requestUpdate('withCost'); await el.updateComplete;
  expect(counters.projects).to.equal(before);
});
it('revokes accepted selection followups when a listener replaces the provider', async () => {
  const p = provider(); const replacement = provider();
  const el = await fixture<Tree>(html`<lr-trace-tree .treeSource=${p.source}></lr-trace-tree>`); await ready(el);
  let count = 0;
  el.addEventListener('lr-span-select', () => { count++; el.treeSource = replacement.source; });
  el.shadowRoot!.querySelector<HTMLElement>('[data-source-key]')!.click();
  await waitUntil(() => replacement.counters.projects === 1); await ready(el);
  expect(count).to.equal(1); expect(el.activeSpanId).to.equal(null);
});
it('stops summary descriptor reads immediately after a reentrant provider replacement', async () => {
  const replacement = provider(); let el: Tree; let obsoleteReads = 0;
  const summary = new Proxy({ startMs: 0, endMs: 200 }, { getOwnPropertyDescriptor(target, key) {
    if (key === 'startMs') el.treeSource = replacement.source;
    else obsoleteReads++;
    return Object.getOwnPropertyDescriptor(target, key);
  } });
  const source: Source = { revision: 1, async project() { return { state: 'old', total: 1, summary,
    rows: { count: 1, keyAt: () => 'span0', indexOfKey: () => 0, itemAt: () => row(0) } }; } };
  el = await fixture<Tree>(html`<lr-trace-tree></lr-trace-tree>`); el.treeSource = source;
  await waitUntil(() => replacement.counters.projects === 1); await ready(el);
  expect(obsoleteReads).to.equal(0);
});

it('revokes obsolete status localization effects while preserving current source announcements', async () => {
  const el = await fixture<Tree>(html`<lr-trace-tree .treeSource=${provider().source}
    .strings=${{ treeSourceError: 'Current trace failure marker' }}></lr-trace-tree>`); await ready(el);
  const seam = el as unknown as { localize(key: string, ...args: unknown[]): string; sourceControl: { error: boolean } };
  const original = seam.localize;
  let labels = 0; let replaced = false;
  seam.localize = (key, ...args) => {
    if (key === 'treeSourceError' && seam.sourceControl.error && !replaced && ++labels === 2) {
      replaced = true; el.treeSource = provider().source; return 'Obsolete trace failure marker';
    }
    return original.call(el, key, ...args);
  };
  const messages = () => Array.from(document.querySelectorAll('[aria-live]')).map(region => region.textContent).join(' ');
  try {
    const warnings = await captureReentrantUpdateWarning('lr-trace-tree', async () => {
      el.treeSource = { revision: 1, async project() { throw new Error('obsolete'); } };
      await waitUntil(() => replaced); await new Promise(resolve => setTimeout(resolve, 40));
      expect(messages()).not.to.include('Obsolete trace failure marker');
      await ready(el);
    });
    expect(warnings).to.equal(1);
    el.treeSource = { revision: 2, async project() { throw new Error('current'); } };
    await waitUntil(() => messages().includes('Current trace failure marker'), 'current failure announces', { timeout: 2000 });
  } finally { seam.localize = original; }
});

it('stops old span descriptors when its id descriptor replaces the source', async () => {
  const el = await fixture<Tree>(html`<lr-trace-tree></lr-trace-tree>`);
  const replacement = provider(); let replaced = false; let laterNameReads = 0; let events = 0;
  el.addEventListener('lr-span-select', () => events++);
  const old = new Proxy<LyraSpan>({ ...row(0).value, id: 'old', name: 'Obsolete row marker' }, {
    getOwnPropertyDescriptor(target, key) {
      if (key === 'id' && !replaced) { replaced = true; el.treeSource = replacement.source; }
      else if (key === 'name' && replaced) laterNameReads++;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const warnings = await captureReentrantUpdateWarning('lr-virtual-list', async () => {
    el.treeSource = { revision: 1, async project() { return { state: 'old', total: 1, summary: { startMs: 100, endMs: 200 },
      rows: { count: 1, keyAt: () => 'old', indexOfKey: () => 0,
        itemAt: () => ({ ...row(0), key: 'old', value: old, position: 1, setSize: 1 }) } }; } };
    await ready(el);
  });
  expect(warnings).to.equal(1);
  expect(replaced).to.equal(true);
  expect(el.shadowRoot!.textContent).not.to.include('Obsolete row marker');
  expect(events).to.equal(0);
  expect(laterNameReads).to.equal(0);
});

it('stops old display descriptors when the ID descriptor requests a newer reveal on the same source', async () => {
  const el = await fixture<Tree>(html`<lr-trace-tree></lr-trace-tree>`);
  let fired = false; let laterReads = 0; let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const value = new Proxy(row(0).value, { getOwnPropertyDescriptor(target, key) {
    if (key === 'id' && !fired) { fired = true; void el.revealSourceKey('span9'); }
    else if (fired && key === 'name') laterReads++;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  const source: Source = { revision: 1, async project(request) {
    const revealing = request.action.type === 'reveal';
    if (revealing) await pending;
    return { state: revealing ? 'new' : 'old', total: 1, summary: { startMs: 100, endMs: 200 },
      rows: { count: 1, keyAt: () => revealing ? 'span9' : 'span0', indexOfKey: () => 0,
        itemAt: () => revealing ? row(9) : { ...row(0), value } },
      ...(revealing ? { focusIndex: 0 } : {}),
    };
  } };
  const warnings = await captureReentrantUpdateWarning('lr-virtual-list', async () => {
    el.treeSource = source;
    try { await waitUntil(() => fired); expect(laterReads).to.equal(0); }
    finally { release(); await ready(el, 'span9'); }
  });
  expect(warnings).to.equal(1);
});

it('stops old display descriptors when an ID descriptor changes the source revision', async () => {
  const el = await fixture<Tree>(html`<lr-trace-tree></lr-trace-tree>`);
  let fired = false; let laterReads = 0;
  const value = new Proxy(row(0).value, { getOwnPropertyDescriptor(target, key) {
    if (key === 'id' && !fired) { fired = true; (source as { revision: number }).revision = 2; }
    else if (fired && key === 'name') laterReads++;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  const source: Source = { revision: 1, async project() {
    return { state: 'old', total: 1, summary: { startMs: 100, endMs: 200 },
      rows: { count: 1, keyAt: () => 'span0', indexOfKey: () => 0, itemAt: () => fired ? row(0) : ({ ...row(0), value }) },
    };
  } };
  el.treeSource = source; await waitUntil(() => fired); expect(laterReads).to.equal(0);
});
it('names a provider row with token and cost metrics only when those columns are enabled, skipping invalid tokens', async () => {
  const value: LyraSpan = { ...row(0).value, tokensIn: 12, tokensOut: -3, costText: '$0.0021' };
  const source: Source = { revision: 1, async project() { return { state: 'one', total: 1,
    summary: { startMs: 100, endMs: 200 }, rows: { count: 1, keyAt: () => 'span0', indexOfKey: () => 0,
      itemAt: () => ({ ...row(0), value, setSize: 1 }) } }; } };
  const el = await fixture<Tree>(html`<lr-trace-tree .treeSource=${source}></lr-trace-tree>`); await ready(el);
  const name = () => el.shadowRoot!.querySelector('[data-source-key="span0"]')!.getAttribute('aria-label') ?? '';
  expect(name()).to.not.contain('Tokens in');
  expect(name()).to.not.contain('$0.0021');

  el.withTokens = true; el.withCost = true;
  await el.updateComplete;
  await waitUntil(() => name().includes('Tokens in: 12'), 'token metric names the row');
  expect(name()).to.contain('Cost: $0.0021');
  expect(name(), 'a negative token count is not announced').to.not.contain('Tokens out');
});


it('restores the focused key through an asynchronous ranged lookup after provider order changes', async () => {
  let reversed = false;
  const lookedUp: string[] = [];
  const source: Source = { revision: 1, async project() {
    const order = reversed ? [1, 0] : [0, 1];
    return { state: reversed ? 'reordered' : 'initial', total: 2, summary: { startMs: 100, endMs: 200 }, rows: {
      count: 2,
      async read(request) { return order.slice(request.offset, request.offset + request.limit).map(index => ({ ...row(index), setSize: 2 })); },
      async indexOfKey(key: string) {
        lookedUp.push(key);
        await Promise.resolve();
        return order.findIndex(index => `span${index}` === key);
      },
    } };
  } };
  const el = await fixture<Tree>(html`<lr-trace-tree .treeSource=${source}></lr-trace-tree>`);
  await ready(el);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[data-source-key="span0"]')!);
  reversed = true;
  el.requestUpdate();
  await waitUntil(() => lookedUp.length === 1, 'refresh resolves the focused provider key');
  await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('data-source-key') === 'span0', 'focus follows the key after reordering');
  expect(lookedUp).to.deep.equal(['span0']);
  expect([...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-source-key]')].map(item => item.dataset['sourceKey'])).to.deep.equal(['span1', 'span0']);
  expect(el.shadowRoot!.querySelector('[data-source-key="span0"]')!.getAttribute('tabindex')).to.equal('0');
});
