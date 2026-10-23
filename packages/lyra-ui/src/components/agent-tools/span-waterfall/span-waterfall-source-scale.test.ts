import { captureReentrantUpdateWarning } from '../../../../test/expected-lit-update.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import type { TraceTreeSource } from '../trace-tree/trace-tree.class.js';
import type { LyraHierarchyRow } from '../../../data-sources.js';
import type { LyraSpanWaterfall } from './span-waterfall.class.js';
import type { LyraSpan } from '../trace-tree/span.js';
import './span-waterfall.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
expectDevWarning('virtual-list-scroll-scaling');

type Waterfall = LyraSpanWaterfall & { treeSource: TraceTreeSource | undefined; revealSourceKey(key: string): Promise<boolean> };
const count = 1_000_000;
function row(index: number): LyraHierarchyRow<LyraSpan> {
  const key = `span${index}`;
  return { key, value: { id: key, name: key, kind: 'tool', status: 'success', startMs: 110, endMs: 120 },
    parentKey: null, level: 1, position: index + 1, setSize: count, childCount: 0, expanded: false, selected: false };
}
function provider(ranged = false) {
  const counters = { reads: 0, keys: 0, rangeReads: 0, largest: 0, active: 0, peak: 0, projects: 0 };
  const source: TraceTreeSource = { revision: 1, async project(request) {
    counters.projects++;
    return { state: String(counters.projects), total: count, summary: { startMs: 100, endMs: 200 },
      rows: ranged ? { count, async indexOfKey(key: string) { return /^span\d+$/.test(key) ? Number(key.slice(4)) : null; },
        async read(request) { counters.rangeReads++; counters.active++; counters.peak = Math.max(counters.peak, counters.active);
          counters.largest = Math.max(counters.largest, request.limit); await new Promise(resolve => setTimeout(resolve, 1));
          counters.active--; return Array.from({ length: request.limit }, (_, offset) => row(request.offset + offset)); } }
        : { count, keyAt(index: number) { counters.keys++; return `span${index}`; },
          indexOfKey: (key: string | number) => /^span\d+$/.test(String(key)) ? Number(String(key).slice(4)) : -1,
          itemAt(index: number) { counters.reads++; return row(index); } },
      ...(request.action.type === 'reveal' && /^span\d+$/.test(request.action.key) ? { focusIndex: Number(request.action.key.slice(4)) } : {}) };
  } };
  return { source, counters };
}
async function ready(el: Waterfall, key = 'span0') {
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector(`[data-source-key="${key}"]`)), 'provider row mounts', { timeout: 20000 });
}
for (const ranged of [false, true]) it(`reaches final million-span ${ranged ? 'ranged' : 'indexed'} row with a stable full-source axis`, async () => {
  const p = provider(ranged); const el = await fixture<Waterfall>(html`<lr-span-waterfall .treeSource=${p.source}></lr-span-waterfall>`); await ready(el);
  const axis = el.shadowRoot!.querySelector('[part="axis"]')!.textContent;
  const bar = el.shadowRoot!.querySelector<HTMLElement>('[part="bar"]')!;
  expect(bar.style.getPropertyValue('--_lr-span-waterfall-start')).to.equal('10%');
  expect(bar.style.getPropertyValue('--_lr-span-waterfall-width')).to.equal('10%');
  expect(await el.revealSourceKey('span500000')).to.equal(true); await ready(el, 'span500000');
  expect(await el.revealSourceKey('span999999')).to.equal(true); await ready(el, 'span999999');
  expect(el.shadowRoot!.querySelector('[part="axis"]')!.textContent).to.equal(axis);
  const mounted = el.shadowRoot!.querySelectorAll('[data-source-key]').length;
  expect(mounted).to.be.at.most(301); expect(p.counters.reads).to.be.lessThan(1000);
  expect(p.counters.largest).to.be.at.most(100); expect(p.counters.peak).to.be.at.most(2);
  recordScaleMeasurement('lr-span-waterfall', `million generated ${ranged ? 'ranged' : 'indexed'} spans`, {
    reads: p.counters.reads, keyReads: p.counters.keys, rangeReads: p.counters.rangeReads, largestRead: p.counters.largest,
    peakPhysicalReads: p.counters.peak, mountedRows: mounted,
  });
});
it('keeps explicit view overrides and keyboard End on the provider preorder', async () => {
  const p = provider(); const el = await fixture<Waterfall>(html`<lr-span-waterfall .treeSource=${p.source} .viewStartMs=${110} .viewEndMs=${130}></lr-span-waterfall>`); await ready(el);
  const bar = el.shadowRoot!.querySelector<HTMLElement>('[part="bar"]')!;
  expect(bar.style.getPropertyValue('--_lr-span-waterfall-start')).to.equal('0%');
  expect(bar.style.getPropertyValue('--_lr-span-waterfall-width')).to.equal('50%');
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[role="tree"]')!); await sendKeys({ press: 'End' });
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[data-source-key="span999999"][tabindex="0"]')));
});
it('gives an invalid present source precedence over nonempty legacy spans', async () => {
  const el = await fixture<Waterfall>(html`<lr-span-waterfall .spans=${[row(0).value]} .treeSource=${null}></lr-span-waterfall>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
  expect(el.shadowRoot!.querySelector('[data-id]') === null).to.equal(true);
  el.treeSource = undefined; await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[data-id="span0"]') !== null).to.equal(true);
});

it('uses provider metadata and normalizes display fields without reading legacy topology or accessors', async () => {
  let parentReads = 0;
  const value = { ...row(0).value, kind: 'foreign', status: 'foreign' };
  Object.defineProperty(value, 'parentId', { get() { parentReads++; throw new Error('unused'); } });
  const source: TraceTreeSource = { revision: 1, async project() { return { state: 'one', total: 1,
    summary: { startMs: 100, endMs: 200 }, rows: { count: 1, keyAt: () => 'span0', indexOfKey: () => 0,
      itemAt: () => ({ ...row(0), value: value as LyraSpan, parentKey: 'external', level: 1000000, position: 5, setSize: 7, childCount: 0 }),
    } }; } };
  const el = await fixture<Waterfall>(html`<lr-span-waterfall .treeSource=${source}></lr-span-waterfall>`); await ready(el);
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
    source.project = async request => ({ ...await project(request), summary: summary as import('../../../data-sources.js').LyraTraceSourceSummary });
    const el = await fixture<Waterfall>(html`<lr-span-waterfall .treeSource=${source} .strings=${{ treeSourceError: 'Extent unavailable' }}></lr-span-waterfall>`);
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
  const el = await fixture<Waterfall>(html`<lr-span-waterfall .treeSource=${source}></lr-span-waterfall>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
  expect(getters).to.equal(0);
  source.project = async () => ({ state: 'two', total: 1, summary: { startMs: 0, endMs: 200 },
    rows: { count: 1, keyAt: () => 'span0', indexOfKey: () => 0,
      itemAt: () => ({ ...row(0), value: { ...row(0).value, name: 'x'.repeat(65_537) } }) } });
  el.requestUpdate(); await el.updateComplete;
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
  expect(el.shadowRoot!.textContent!.length).to.be.lessThan(1000);
});

it('reveals controlled active IDs once and leaves later user navigation in place', async () => {
  const { source, counters } = provider();
  const el = await fixture<Waterfall>(html`<lr-span-waterfall active-span-id="span500000" .treeSource=${source}></lr-span-waterfall>`);
  await ready(el, 'span500000');
  expect(counters.projects).to.equal(2);
  expect(await el.revealSourceKey('span999999')).to.equal(true);
  el.withoutAxis = true; await el.updateComplete;
  expect(counters.projects).to.equal(3);
  expect(el.shadowRoot!.querySelector('[data-source-key="span999999"][tabindex="0"]') !== null).to.equal(true);
  expect(await el.revealSourceKey('missing')).to.equal(false);
});

it('does not call a project method returned by a getter that replaced its provider', async () => {
  const original = provider().source; const replacement = provider();
  let el: Waterfall; let obsoleteCalls = 0;
  Object.defineProperty(original, 'project', { get() { el.treeSource = replacement.source; return async () => { obsoleteCalls++; throw new Error('obsolete'); }; } });
  el = await fixture<Waterfall>(html`<lr-span-waterfall></lr-span-waterfall>`);
  el.treeSource = original;
  await ready(el);
  expect(obsoleteCalls).to.equal(0);
  expect(el.treeSource === replacement.source).to.equal(true);
});

it('replays source authority after disconnect and adoption', async () => {
  const { source, counters } = provider();
  const el = await fixture<Waterfall>(html`<lr-span-waterfall .treeSource=${source}></lr-span-waterfall>`); await ready(el);
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
  let resolve!: (value: Awaited<ReturnType<TraceTreeSource['project']>>) => void;
  let calls = 0;
  const slow: TraceTreeSource = { revision: 1, project() { calls++; return new Promise(done => { resolve = done; }); } };
  const el = await fixture<Waterfall>(html`<lr-span-waterfall .treeSource=${slow}></lr-span-waterfall>`);
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
  expect(el.shadowRoot!.querySelector<HTMLElement>('[part="bar"]')!.style.getPropertyValue('--_lr-span-waterfall-width')).to.equal('10%');
});

it('guards indexed row method getters before invoking the returned obsolete function', async () => {
  const replacement = provider(); let el: Waterfall; let obsolete = 0;
  const rows = { count: 1, keyAt: () => 'span0', indexOfKey: () => 0, itemAt: () => row(0) };
  let reads = 0;
  Object.defineProperty(rows, 'itemAt', { get() {
    reads++;
    if (reads > 1) el.treeSource = replacement.source;
    return () => { obsolete++; return row(0); };
  } });
  const source: TraceTreeSource = { revision: 1, async project() { return { state: 'one', total: 1, rows, summary: { startMs: 0, endMs: 200 } }; } };
  el = await fixture<Waterfall>(html`<lr-span-waterfall></lr-span-waterfall>`);
  const warnings = await captureReentrantUpdateWarning('lr-virtual-list', async () => {
    el.treeSource = source;
    await waitUntil(() => el.treeSource === replacement.source); await ready(el);
  });
  expect(warnings).to.equal(1);
  expect(obsolete).to.equal(0);
});

it('retains only four ranged pages plus the focused row for a large allocated viewport', async function () {
  this.timeout(30000); // Budget for a heavily loaded multi-browser host; the asserted bounds are unchanged.
  const { source, counters } = provider(true);
  const el = await fixture<Waterfall>(html`<lr-span-waterfall style="height: 20000px" .treeSource=${source}></lr-span-waterfall>`); await ready(el);
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
  recordScaleMeasurement('lr-span-waterfall', 'large ranged viewport and focused row', { mountedRows: mounted, retainedRows: retained, peakPhysicalReads: counters.peak });
});

it('stops summary descriptor reads immediately after a reentrant provider replacement', async () => {
  const replacement = provider(); let el: Waterfall; let obsoleteReads = 0;
  const summary = new Proxy({ startMs: 0, endMs: 200 }, { getOwnPropertyDescriptor(target, key) {
    if (key === 'startMs') el.treeSource = replacement.source;
    else obsoleteReads++;
    return Object.getOwnPropertyDescriptor(target, key);
  } });
  const source: TraceTreeSource = { revision: 1, async project() { return { state: 'old', total: 1, summary,
    rows: { count: 1, keyAt: () => 'span0', indexOfKey: () => 0, itemAt: () => row(0) } }; } };
  el = await fixture<Waterfall>(html`<lr-span-waterfall></lr-span-waterfall>`); el.treeSource = source;
  await waitUntil(() => replacement.counters.projects === 1); await ready(el);
  expect(obsoleteReads).to.equal(0);
});


it('revokes obsolete status localization effects while preserving current source announcements', async () => {
  const el = await fixture<Waterfall>(html`<lr-span-waterfall .treeSource=${provider().source}
    .strings=${{ treeSourceError: 'Current trace failure marker' }}></lr-span-waterfall>`); await ready(el);
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
    const warnings = await captureReentrantUpdateWarning('lr-span-waterfall', async () => {
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

it('keeps provider order and one row focus owner while emitting only accepted span selection', async () => {
  const actions: string[] = [];
  const source: TraceTreeSource = { revision: 1, async project(request) {
    actions.push(request.action.type);
    return { state: String(actions.length), total: 2, summary: { startMs: 100, endMs: 200 }, rows: {
      count: 2, keyAt: index => `span${index}`, indexOfKey: (key: string | number) => Number(String(key).slice(4)),
      itemAt: index => ({ ...row(index), setSize: 2, childCount: index === 0 ? 1 : 0,
        value: { ...row(index).value, startMs: index === 0 ? 180 : 110, endMs: index === 0 ? 190 : 120 } }),
    } };
  } };
  const el = await fixture<Waterfall>(html`<lr-span-waterfall aria-label="Trace timeline" .treeSource=${source}></lr-span-waterfall>`); await ready(el);
  expect([...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-source-key]')].map(item => item.dataset['sourceKey'])).to.deep.equal(['span0', 'span1']);
  expect(el.shadowRoot!.querySelector('[role="tree"]')!.getAttribute('aria-label')).to.equal('Trace timeline');
  expect(el.shadowRoot!.querySelector('button[part="bar"]') === null).to.equal(true);
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"] [tabindex="0"]').length).to.equal(0);
  const events: string[] = []; let toggles = 0;
  el.addEventListener('lr-span-select', event => events.push(event.detail.spanId));
  el.addEventListener('lr-span-toggle', () => toggles++);
  el.shadowRoot!.querySelector<HTMLElement>('[data-source-key="span0"] [part="bar"]')!.click();
  await waitUntil(() => events.length === 1); await ready(el);
  expect(events).to.deep.equal(['span0']); expect(el.activeSpanId).to.equal(null);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key="span0"] button')!.click();
  await waitUntil(() => actions.length === 3);
  expect(actions).to.deep.equal(['reset', 'select', 'toggle']); expect(toggles).to.equal(0);
});
it('revokes retained source and legacy bars across provider and mode changes', async () => {
  const el = await fixture<Waterfall>(html`<lr-span-waterfall .spans=${[row(0).value]}></lr-span-waterfall>`);
  const legacy = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="bar"]')!;
  let events = 0; el.addEventListener('lr-span-select', () => events++);
  legacy.click(); expect(events).to.equal(1);
  el.treeSource = provider().source; legacy.click(); expect(events).to.equal(1); await ready(el);
  const old = el.shadowRoot!.querySelector<HTMLElement>('[part="bar"]')!;
  const replacement = provider(); el.treeSource = replacement.source;
  old.click(); await ready(el); await waitUntil(() => replacement.counters.projects === 1);
  old.click(); expect(events).to.equal(1);
  el.treeSource = undefined; await el.updateComplete;
  legacy.click(); old.click(); expect(events).to.equal(1);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="bar"]')!.click(); expect(events).to.equal(2);
});
it('preserves explicit invalid, negative and degenerate window normalization without provider reloads', async () => {
  const p = provider(); const el = await fixture<Waterfall>(html`<lr-span-waterfall .treeSource=${p.source}></lr-span-waterfall>`); await ready(el);
  el.viewStartMs = NaN; el.viewEndMs = NaN; await el.updateComplete;
  expect(el.shadowRoot!.querySelector<HTMLElement>('[part="bar"]')!.style.getPropertyValue('--_lr-span-waterfall-start')).to.equal('10%');
  el.viewStartMs = -10; el.viewEndMs = 200; await el.updateComplete;
  expect(parseFloat(el.shadowRoot!.querySelector<HTMLElement>('[part="bar"]')!.style.getPropertyValue('--_lr-span-waterfall-start'))).to.be.closeTo(55, 0.000001);
  el.viewStartMs = 300; el.viewEndMs = 100; await el.updateComplete;
  expect(el.shadowRoot!.querySelector<HTMLElement>('[part="bar"]')!.hidden).to.equal(true);
  expect(el.shadowRoot!.querySelectorAll('[data-source-key]').length).to.be.greaterThan(0);
  el.withoutAxis = true; await el.updateComplete; expect(el.shadowRoot!.querySelector('[part="axis"]') === null).to.equal(true);
  expect(p.counters.projects).to.equal(1);
  expect(el.shadowRoot!.innerHTML).not.to.contain('NaN'); expect(el.shadowRoot!.innerHTML).not.to.contain('Infinity');
});
it('keeps bounded finite ticks and geometry for zero, tiny and extreme global extents', async () => {
  for (const summary of [{ startMs: 0, endMs: 0 }, { startMs: 100, endMs: 100 },
    { startMs: 0, endMs: Number.MIN_VALUE }, { startMs: 1e308, endMs: 1.1e308 }, { startMs: Number.MAX_VALUE, endMs: Number.MAX_VALUE }]) {
    const source: TraceTreeSource = { revision: 1, async project() { return { state: 'one', total: 1, summary, rows: {
      count: 1, keyAt: () => 'span0', indexOfKey: () => 0,
      itemAt: () => ({ ...row(0), value: { ...row(0).value, startMs: summary.startMs, endMs: undefined, status: 'running' } }),
    } }; } };
    const el = await fixture<Waterfall>(html`<lr-span-waterfall .treeSource=${source}></lr-span-waterfall>`); await ready(el);
    expect(el.shadowRoot!.querySelectorAll('[part="tick"]').length).to.be.at.most(8);
    expect(el.shadowRoot!.innerHTML).not.to.contain('NaN'); expect(el.shadowRoot!.innerHTML).not.to.contain('Infinity');
  }
});
it('keeps source bars within narrow RTL tracks and uses disabled row metadata', async () => {
  const p = provider(); const el = await fixture<Waterfall>(html`<lr-span-waterfall dir="rtl" style="width:320px" .treeSource=${p.source}></lr-span-waterfall>`); await ready(el);
  const track = el.shadowRoot!.querySelector<HTMLElement>('[part="bar-track"]')!.getBoundingClientRect();
  const bar = el.shadowRoot!.querySelector<HTMLElement>('[part="bar"]')!.getBoundingClientRect();
  expect(bar.width).to.be.greaterThan(0); expect(bar.left).to.be.at.least(track.left - 1); expect(bar.right).to.be.at.most(track.right + 1);
  expect(track.width).to.be.at.most(el.getBoundingClientRect().width);
  let projects = 0;
  el.treeSource = { revision: 1, async project() { projects++; return { state: 'disabled', total: 1, summary: { startMs: 100, endMs: 200 }, rows: {
    count: 1, keyAt: () => 'span0', indexOfKey: () => 0, itemAt: () => ({ ...row(0), disabled: true }),
  } }; } };
  await waitUntil(() => el.shadowRoot!.querySelector('[data-source-key]')?.getAttribute('aria-disabled') === 'true');
  el.shadowRoot!.querySelector<HTMLElement>('[part="bar"]')!.click(); expect(projects).to.equal(1);
});
it('refreshes only for source authority changes and never reads the legacy sorted model in provider mode', async () => {
  const p = provider(); const el = await fixture<Waterfall>(html`<lr-span-waterfall .treeSource=${p.source}></lr-span-waterfall>`); await ready(el);
  Object.defineProperty(el, 'spans', { get() { throw new Error('Unused legacy model'); }, configurable: true });
  el.label = 'New label'; el.viewEndMs = 300; await el.updateComplete; expect(p.counters.projects).to.equal(1);
  el.requestUpdate(); await waitUntil(() => p.counters.projects === 2); await ready(el);
  el.treeSource = p.source; await waitUntil(() => p.counters.projects === 3); await ready(el);
  Object.defineProperty(p.source, 'revision', { value: 2 }); el.requestUpdate();
  await waitUntil(() => p.counters.projects === 4); await ready(el);
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
});
it('stops span descriptor reads after an ID trap replaces the source', async () => {
  const replacement = provider(); let el: Waterfall; let staleReads = 0; let replaced = false;
  const value = new Proxy(row(0).value, { getOwnPropertyDescriptor(target, key) {
    if (key === 'id' && !replaced) { replaced = true; el.treeSource = replacement.source; }
    else if (replaced) staleReads++;
    return Object.getOwnPropertyDescriptor(target, key);
  } });
  const source: TraceTreeSource = { revision: 1, async project() { return { state: 'old', total: 1,
    summary: { startMs: 100, endMs: 200 }, rows: { count: 1, keyAt: () => 'span0', indexOfKey: () => 0,
      itemAt: () => ({ ...row(0), value }),
    } }; } };
  el = await fixture<Waterfall>(html`<lr-span-waterfall></lr-span-waterfall>`);
  const warnings = await captureReentrantUpdateWarning('lr-virtual-list', async () => {
    el.treeSource = source;
    await waitUntil(() => replaced); await ready(el);
  });
  expect(warnings).to.equal(1);
  expect(staleReads).to.equal(0);
});

it('stops old display descriptors when the ID descriptor requests a newer reveal on the same source', async () => {
  const el = await fixture<Waterfall>(html`<lr-span-waterfall></lr-span-waterfall>`);
  let fired = false; let laterReads = 0; let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const value = new Proxy(row(0).value, { getOwnPropertyDescriptor(target, key) {
    if (key === 'id' && !fired) { fired = true; void el.revealSourceKey('span9'); }
    else if (fired && key === 'name') laterReads++;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  const source: TraceTreeSource = { revision: 1, async project(request) {
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
  const el = await fixture<Waterfall>(html`<lr-span-waterfall></lr-span-waterfall>`);
  let fired = false; let laterReads = 0;
  const value = new Proxy(row(0).value, { getOwnPropertyDescriptor(target, key) {
    if (key === 'id' && !fired) { fired = true; (source as { revision: number }).revision = 2; }
    else if (fired && key === 'name') laterReads++;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  const source: TraceTreeSource = { revision: 1, async project() {
    return { state: 'old', total: 1, summary: { startMs: 100, endMs: 200 },
      rows: { count: 1, keyAt: () => 'span0', indexOfKey: () => 0, itemAt: () => fired ? row(0) : ({ ...row(0), value }) },
    };
  } };
  el.treeSource = source; await waitUntil(() => fired); expect(laterReads).to.equal(0);
});


it('restores the focused key through an asynchronous ranged lookup after provider order changes', async () => {
  let reversed = false;
  const lookedUp: string[] = [];
  const source: TraceTreeSource = { revision: 1, async project() {
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
  const el = await fixture<Waterfall>(html`<lr-span-waterfall .treeSource=${source}></lr-span-waterfall>`);
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
