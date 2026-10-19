import { captureReentrantUpdateWarning } from '../../../../test/expected-lit-update.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { accessibleName } from '../../../../test/accessible-name.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import type { LyraHierarchySource, LyraHierarchyQuery, LyraTaskSourceSummary } from '../../../data-sources.js';
import type { LyraHierarchyRow } from '../../../data-sources.js';
import type { LyraTaskList } from './task-list.class.js';
import type { TaskItem } from './task-list.class.js';
type TaskListSource = LyraHierarchySource<TaskItem, LyraHierarchyQuery, LyraTaskSourceSummary>;
import './task-list.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
expectDevWarning('virtual-list-scroll-scaling');

type TaskList = LyraTaskList & { treeSource: TaskListSource | undefined; revealSourceKey(key: string): Promise<boolean> };
const count = 1_000_000;
function row(index: number): LyraHierarchyRow<TaskItem> {
  const key = `task${index}`;
  return { key, value: { id: key, label: key, status: 'success' },
    parentKey: index % 2 ? `task${index - 1}` : null, level: index % 2 ? 2 : 1, position: index % 2 ? 1 : index / 2 + 1, setSize: index % 2 ? 1 : count / 2, childCount: index % 2 ? 0 : 1, expanded: false, selected: false };
}
function provider(ranged = false) {
  const counters = { reads: 0, keys: 0, rangeReads: 0, largest: 0, active: 0, peak: 0, projects: 0 };
  const source: TaskListSource = { revision: 1, async project(request) {
    counters.projects++;
    return { state: String(counters.projects), total: count, summary: { total: count / 2, completed: 123456 },
      rows: ranged ? { count, async indexOfKey(key: string) { return /^task\d+$/.test(key) ? Number(key.slice(4)) : null; },
        async read(request) { counters.rangeReads++; counters.active++; counters.peak = Math.max(counters.peak, counters.active);
          counters.largest = Math.max(counters.largest, request.limit); await new Promise(resolve => setTimeout(resolve, 1));
          counters.active--; return Array.from({ length: request.limit }, (_, offset) => row(request.offset + offset)); } }
        : { count, keyAt(index: number) { counters.keys++; return `task${index}`; },
          indexOfKey: (key: string | number) => /^task\d+$/.test(String(key)) ? Number(String(key).slice(4)) : -1,
          itemAt(index: number) { counters.reads++; return row(index); } },
      ...(request.action.type === 'reveal' && /^task\d+$/.test(request.action.key) ? { focusIndex: Number(request.action.key.slice(4)) } : {}) };
  } };
  return { source, counters };
}
async function ready(el: TaskList, key = 'task0') {
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector(`[data-source-key="${key}"]`)), 'provider row mounts', { timeout: 20000 });
}
for (const ranged of [false, true]) it(`reaches final million-task ${ranged ? 'ranged' : 'indexed'} row with a global top-level summary`, async () => {
  const p = provider(ranged); const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${p.source}></lr-task-list>`); await ready(el);
  const summary = el.shadowRoot!.querySelector('[part="summary"]')!.textContent;
  expect(summary).to.contain('123,456'); expect(summary).to.contain('500,000');
  expect(await el.revealSourceKey('task500000')).to.equal(true); await ready(el, 'task500000');
  expect(await el.revealSourceKey('task999999')).to.equal(true); await ready(el, 'task999999');
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.equal(summary);
  const mounted = el.shadowRoot!.querySelectorAll('[data-source-key]').length;
  expect(mounted).to.be.at.most(301); expect(p.counters.reads).to.be.lessThan(1000);
  expect(p.counters.largest).to.be.at.most(100); expect(p.counters.peak).to.be.at.most(2);
  recordScaleMeasurement('lr-task-list', `million generated ${ranged ? 'ranged' : 'indexed'} tasks`, {
    reads: p.counters.reads, keyReads: p.counters.keys, rangeReads: p.counters.rangeReads, largestRead: p.counters.largest,
    peakPhysicalReads: p.counters.peak, mountedRows: mounted,
  });
});
it('navigates End without a task selection action or event', async () => {
  const p = provider(); const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${p.source}></lr-task-list>`); await ready(el);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[role="tree"]')!); await sendKeys({ press: 'End' });
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[data-source-key="task999999"][tabindex="0"]')));
  const before = p.counters.projects; await sendKeys({ press: 'Enter' }); expect(p.counters.projects).to.equal(before);
});
it('gives an invalid present source precedence over nonempty legacy items', async () => {
  const el = await fixture<TaskList>(html`<lr-task-list .items=${[row(0).value]} .treeSource=${null}></lr-task-list>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
  expect(el.shadowRoot!.querySelector('[data-id]') === null).to.equal(true);
  el.treeSource = undefined; await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[data-id="task0"]') !== null).to.equal(true);
});


it('does not call a project method returned by a getter that replaced its provider', async () => {
  const original = provider().source; const replacement = provider();
  let el: TaskList; let obsoleteCalls = 0;
  Object.defineProperty(original, 'project', { get() { el.treeSource = replacement.source; return async () => { obsoleteCalls++; throw new Error('obsolete'); }; } });
  el = await fixture<TaskList>(html`<lr-task-list></lr-task-list>`);
  el.treeSource = original;
  await ready(el);
  expect(obsoleteCalls).to.equal(0);
  expect(el.treeSource === replacement.source).to.equal(true);
});

it('replays source authority after disconnect and adoption', async () => {
  const { source, counters } = provider();
  const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${source}></lr-task-list>`); await ready(el);
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



it('guards indexed row method getters before invoking the returned obsolete function', async () => {
  const replacement = provider(); let el: TaskList; let obsolete = 0;
  const rows = { count: 1, keyAt: () => 'task0', indexOfKey: () => 0, itemAt: () => row(0) };
  let reads = 0;
  Object.defineProperty(rows, 'itemAt', { get() {
    reads++;
    if (reads > 1) el.treeSource = replacement.source;
    return () => { obsolete++; return row(0); };
  } });
  const source: TaskListSource = { revision: 1, async project() { return { state: 'one', total: 1, rows, summary: { total: 1, completed: 0 } }; } };
  el = await fixture<TaskList>(html`<lr-task-list></lr-task-list>`);
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
  const el = await fixture<TaskList>(html`<lr-task-list style="height: 20000px" .treeSource=${source}></lr-task-list>`); await ready(el);
  expect(await el.revealSourceKey('task99')).to.equal(true);
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
  recordScaleMeasurement('lr-task-list', 'large ranged viewport and focused row', { mountedRows: mounted, retainedRows: retained, peakPhysicalReads: counters.peak });
});

it('stops summary descriptor reads immediately after a reentrant provider replacement', async () => {
  const replacement = provider(); let el: TaskList; let obsoleteReads = 0;
  const summary = new Proxy({ total: 1, completed: 0 }, { getOwnPropertyDescriptor(target, key) {
    if (key === 'total') el.treeSource = replacement.source;
    else obsoleteReads++;
    return Object.getOwnPropertyDescriptor(target, key);
  } });
  const source: TaskListSource = { revision: 1, async project() { return { state: 'old', total: 1, summary,
    rows: { count: 1, keyAt: () => 'task0', indexOfKey: () => 0, itemAt: () => row(0) } }; } };
  el = await fixture<TaskList>(html`<lr-task-list></lr-task-list>`); el.treeSource = source;
  await waitUntil(() => replacement.counters.projects === 1); await ready(el);
  expect(obsoleteReads).to.equal(0);
});


it('revokes obsolete status localization effects while preserving current source announcements', async () => {
  const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${provider().source}
    .strings=${{ treeSourceError: 'Current trace failure marker' }}></lr-task-list>`); await ready(el);
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
    const warnings = await captureReentrantUpdateWarning('lr-task-list', async () => {
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


it('stops task descriptor reads after an ID trap replaces the source', async () => {
  const replacement = provider(); let el: TaskList; let staleReads = 0; let replaced = false;
  const value = new Proxy(row(0).value, { getOwnPropertyDescriptor(target, key) {
    if (key === 'id' && !replaced) { replaced = true; el.treeSource = replacement.source; }
    else if (replaced) staleReads++;
    return Object.getOwnPropertyDescriptor(target, key);
  } });
  const source: TaskListSource = { revision: 1, async project() { return { state: 'old', total: 1,
    summary: { total: 1, completed: 0 }, rows: { count: 1, keyAt: () => 'task0', indexOfKey: () => 0,
      itemAt: () => ({ ...row(0), value }),
    } }; } };
  el = await fixture<TaskList>(html`<lr-task-list></lr-task-list>`);
  const warnings = await captureReentrantUpdateWarning('lr-virtual-list', async () => {
    el.treeSource = source;
    await waitUntil(() => replaced); await ready(el);
  });
  expect(warnings).to.equal(1);
  expect(staleReads).to.equal(0);
});

for (const summary of [undefined, { total: -1, completed: 0 }, { total: 1, completed: 2 }, { total: 1.5, completed: 0 }, { total: Infinity, completed: 0 }])
  it(`rejects invalid task summary ${JSON.stringify(summary)} without a fake completed count`, async () => {
    const source = provider().source; const project = source.project;
    source.project = async request => ({ ...await project(request), summary: summary as LyraTaskSourceSummary });
    const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${source} .strings=${{ treeSourceError: 'Plan unavailable' }}></lr-task-list>`);
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
    expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.equal('');
    expect(el.shadowRoot!.textContent).to.contain('Plan unavailable');
  });

function oneRow(value: LyraHierarchyRow<TaskItem>, ranged = false): TaskListSource {
  return { revision: 1, async project() { return { state: 'one', total: 99, summary: { total: 10, completed: 3 },
    rows: ranged ? { count: 1, async read() { return [value]; }, async indexOfKey() { return 0; } }
      : { count: 1, keyAt: () => value.key, indexOfKey: () => 0, itemAt: () => value },
  }; } };
}
for (const ranged of [false, true]) for (const metadata of [
  { level: 3, parentKey: 'parent', childCount: 0 },
  { level: 1, parentKey: 'parent', childCount: 0 },
  { level: 2, parentKey: null, childCount: 0 },
  { level: 2, parentKey: 'parent', childCount: 1 },
]) it(`rejects malformed two-level ${ranged ? 'ranged' : 'indexed'} metadata ${JSON.stringify(metadata)}`, async () => {
  const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${oneRow({ ...row(0), ...metadata }, ranged)}></lr-task-list>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
  expect(el.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(0);
});

it('uses authoritative child metadata and preserves task presentation without reading children', async () => {
  let childReads = 0; const value = { ...row(0).value, detail: 'Context', status: 'foreign' };
  Object.defineProperty(value, 'children', { get() { childReads++; throw new Error('unused'); } });
  const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${oneRow({ ...row(0), value: value as TaskItem })}>
    <span slot="detail-task0">Rich detail</span></lr-task-list>`); await ready(el);
  expect(childReads).to.equal(0);
  expect(el.shadowRoot!.querySelector('[data-source-key="task0"] button') !== null).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="item-detail"]')!.textContent).to.equal('Context');
  expect(el.shadowRoot!.querySelector('slot[name="detail-task0"]') !== null).to.equal(true);
  expect(el.shadowRoot!.textContent).to.contain('Pending');
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.contain('3 of 10');
});

it('keeps panel collapse local, cancelable, and guarded after listener replacement', async () => {
  const p = provider(); const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${p.source}></lr-task-list>`); await ready(el);
  const button = () => el.shadowRoot!.querySelector<HTMLButtonElement>('[part="header"]')!;
  let toggles = 0; el.addEventListener('lr-toggle', () => toggles++);
  el.addEventListener('lr-toggle-request', e => e.preventDefault(), { once: true }); button().click();
  expect(el.collapsed).to.equal(false); expect(toggles).to.equal(0);
  button().click(); await el.updateComplete; expect(el.collapsed).to.equal(true); expect(toggles).to.equal(1);
  button().click(); await el.updateComplete; expect(el.collapsed).to.equal(false); expect(toggles).to.equal(2);
  expect(p.counters.projects).to.equal(1);
  el.addEventListener('lr-toggle-request', () => { el.treeSource = provider().source; }, { once: true }); button().click();
  expect(el.collapsed).to.equal(false); expect(toggles).to.equal(2);
});

it('disables legacy reorder immediately in source mode and restores genuine current legacy requests', async () => {
  const items = [row(0).value, row(1).value];
  const el = await fixture<TaskList>(html`<lr-task-list reorderable .items=${items}></lr-task-list>`);
  expect(el.treeSource).to.equal(undefined);
  const old = el.shadowRoot!.querySelector<HTMLElement>('[part="item"]')!;
  let reorder = 0; el.addEventListener('lr-reorder', () => reorder++);
  const move = (target: HTMLElement) => target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, bubbles: true, composed: true }));
  el.treeSource = provider().source; move(old); expect(reorder).to.equal(0); await ready(el);
  move(old); expect(reorder).to.equal(0);
  const current = el.shadowRoot!.querySelector<HTMLElement>('[data-source-key]')!; move(current); expect(reorder).to.equal(0);
  el.treeSource = undefined; await el.updateComplete; move(old); expect(reorder).to.equal(0);
  move(el.shadowRoot!.querySelector<HTMLElement>('[part="item"]')!); expect(reorder).to.equal(1);
});

it('refreshes only source authority and never scans the legacy items model in source mode', async () => {
  const p = provider(); const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${p.source}></lr-task-list>`); await ready(el);
  Object.defineProperty(el, 'items', { configurable: true, get() { throw new Error('legacy scan'); } });
  el.heading = 'Plan'; el.size = 's'; el.collapsed = true; el.reorderable = true; await el.updateComplete;
  expect(p.counters.projects).to.equal(1);
  el.requestUpdate(); await waitUntil(() => p.counters.projects === 2);
  el.treeSource = p.source; await waitUntil(() => p.counters.projects === 3);
  (p.source as { revision: number }).revision = 2; el.requestUpdate(); await waitUntil(() => p.counters.projects === 4);
  delete (el as unknown as { items?: unknown }).items;
});


it('bounds ignored-abort project work and rejects obsolete summaries', async () => {
  let resolve!: (value: Awaited<ReturnType<TaskListSource['project']>>) => void; let calls = 0;
  const slow: TaskListSource = { revision: 1, project() { calls++; return new Promise(done => { resolve = done; }); } };
  const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${slow}></lr-task-list>`);
  await waitUntil(() => calls === 1); expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.equal('');
  const replacement = provider(); for (let index = 0; index < 100; index++) el.treeSource = replacement.source;
  await el.updateComplete; expect(replacement.counters.projects).to.equal(0);
  resolve({ state: 'old', total: 1, summary: { total: 1, completed: 1 }, rows: { count: 1, keyAt: () => 'task0', indexOfKey: () => 0, itemAt: () => row(0) } });
  await ready(el); expect(replacement.counters.projects).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.contain('500,000');
});

it('rejects accessors and overbudget display text without touching opaque children', async () => {
  let reads = 0; const value = { ...row(0).value };
  Object.defineProperty(value, 'label', { get() { reads++; return 'unsafe'; } });
  const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${oneRow({ ...row(0), value })}></lr-task-list>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]'))); expect(reads).to.equal(0);
  el.treeSource = oneRow({ ...row(0), value: { ...row(0).value, detail: 'x'.repeat(65_537) } });
  await el.updateComplete; await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
  expect(el.shadowRoot!.textContent!.length).to.be.lessThan(1000);
});

it('uses current expansion requests but rejects old row controls and never selects tasks', async () => {
  const p = provider(); const actions: string[] = []; const project = p.source.project;
  p.source.project = async request => { actions.push(request.action.type); return project(request); };
  const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${p.source}></lr-task-list>`); await ready(el);
  let selection = 0; el.addEventListener('lr-source-selection-change', () => selection++); el.addEventListener('lr-select', () => selection++);
  const old = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key="task0"] button')!;
  old.click(); await waitUntil(() => actions.includes('toggle')); await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLElement>('[data-source-key]')!.click(); expect(actions.includes('select')).to.equal(false); expect(selection).to.equal(0);
  el.treeSource = provider().source; const before = actions.length; old.click(); await ready(el); old.click(); expect(actions.length).to.equal(before);
});

it('keeps disabled rows inactive and long detail within a narrow RTL allocation', async () => {
  const el = await fixture<TaskList>(html`<lr-task-list dir="rtl" style="width:320px" .treeSource=${oneRow({ ...row(0), disabled: true,
    value: { ...row(0).value, label: 'Task'.repeat(100), detail: 'Detail'.repeat(100) } })}></lr-task-list>`); await ready(el);
  const item = el.shadowRoot!.querySelector<HTMLElement>('[data-source-key]')!;
  expect(item.getAttribute('aria-disabled')).to.equal('true'); expect(item.getAttribute('tabindex')).to.equal('-1');
  expect(await el.revealSourceKey('task0')).to.equal(false);
  const label = el.shadowRoot!.querySelector<HTMLElement>('[part="item-label"]')!;
  expect(label.getBoundingClientRect().width).to.be.at.most(320);
  expect(el.scrollWidth).to.be.at.most(321);
});

it('keeps loaded historical statuses silent instead of diffing them as legacy task changes', async () => {
  const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${oneRow(row(0))}></lr-task-list>`); await ready(el);
  const region = el.shadowRoot!.querySelector('lr-live-region') as import('../../utility/live-region/live-region.class.js').LyraLiveRegion;
  let statusAnnouncements = 0; const original = region.announce;
  region.announce = () => { statusAnnouncements++; };
  try {
    el.treeSource = oneRow({ ...row(0), value: { ...row(0).value, status: 'error' } }); await ready(el);
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('.source-task[data-status="error"]')));
    expect(statusAnnouncements).to.equal(0);
  } finally { region.announce = original; }
});

it('stops row metadata descriptor reads after provider replacement', async () => {
  const replacement = provider(); let el: TaskList; let laterReads = 0; let replaced = false;
  const value = new Proxy(row(0), { getOwnPropertyDescriptor(target, key) {
    if (key === 'key') { replaced = true; el.treeSource = replacement.source; }
    else if (replaced) laterReads++;
    return Object.getOwnPropertyDescriptor(target, key);
  } });
  el = await fixture<TaskList>(html`<lr-task-list></lr-task-list>`);
  const warnings = await captureReentrantUpdateWarning('lr-virtual-list', async () => {
    el.treeSource = oneRow(value);
    await waitUntil(() => replaced); await ready(el); expect(laterReads).to.equal(0);
  });
  expect(warnings).to.equal(1);
});

it('renders provider English fallbacks and instance overrides without a registered locale', async () => {
  const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${oneRow(row(0))}></lr-task-list>`); await ready(el);
  expect(el.shadowRoot!.textContent).to.contain('1 visible of 99 nodes.');
  expect(el.shadowRoot!.querySelector('[data-source-key] button')!.getAttribute('aria-label')).to.equal('Expand');
  el.treeSource = null as unknown as TaskListSource;
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part="source-error"]')));
  expect(el.shadowRoot!.textContent).to.contain('Unable to load tree data.');
  expect(el.shadowRoot!.querySelector('[part="source-error"] button')!.textContent).to.equal('Retry');
  el.strings = { treeSourceError: 'Plan unavailable', retry: 'Try again' }; await el.updateComplete;
  expect(el.shadowRoot!.textContent).to.contain('Plan unavailable');
  expect(el.shadowRoot!.querySelector('[part="source-error"] button')!.textContent).to.equal('Try again');
  el.treeSource = { revision: 1, async project() { return { state: 'empty', total: 0, summary: { total: 0, completed: 0 },
    rows: { count: 0, keyAt: () => '', indexOfKey: () => -1, itemAt: () => row(0) },
  }; } };
  await waitUntil(() => Boolean(el.shadowRoot!.textContent?.includes('No data')));
});

it('stops old display descriptors when an ID descriptor changes the source revision', async () => {
  const el = await fixture<TaskList>(html`<lr-task-list></lr-task-list>`);
  let fired = false; let laterReads = 0;
  const value = new Proxy(row(0).value, { getOwnPropertyDescriptor(target, key) {
    if (key === 'id' && !fired) { fired = true; (source as { revision: number }).revision = 2; }
    else if (fired && key === 'label') laterReads++;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  const source: TaskListSource = { revision: 1, async project() {
    return { state: 'old', total: 1, summary: { total: 1, completed: 0 },
      rows: { count: 1, keyAt: () => 'task0', indexOfKey: () => 0, itemAt: () => fired ? row(0) : ({ ...row(0), value }) },
    };
  } };
  el.treeSource = source; await waitUntil(() => fired); expect(laterReads).to.equal(0);
});

it('stops old display descriptors when the ID descriptor requests a newer reveal on the same source', async () => {
  const el = await fixture<TaskList>(html`<lr-task-list></lr-task-list>`);
  let fired = false; let laterReads = 0; let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const value = new Proxy(row(0).value, { getOwnPropertyDescriptor(target, key) {
    if (key === 'id' && !fired) { fired = true; void el.revealSourceKey('task9'); }
    else if (fired && key === 'label') laterReads++;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  const source: TaskListSource = { revision: 1, async project(request) {
    const revealing = request.action.type === 'reveal';
    if (revealing) await pending;
    return { state: revealing ? 'new' : 'old', total: 1, summary: { total: 1, completed: 0 },
      rows: { count: 1, keyAt: () => revealing ? 'task9' : 'task0', indexOfKey: () => 0,
        itemAt: () => revealing ? row(9) : { ...row(0), value } },
      ...(revealing ? { focusIndex: 0 } : {}),
    };
  } };
  const warnings = await captureReentrantUpdateWarning('lr-virtual-list', async () => {
    el.treeSource = source;
    try { await waitUntil(() => fired); expect(laterReads).to.equal(0); }
    finally { release(); await ready(el, 'task9'); }
  });
  expect(warnings).to.equal(1);
});


it('rejects a top-level task summary larger than the complete projection total', async () => {
  const source = oneRow(row(0)); const project = source.project;
  source.project = async request => ({ ...await project(request), total: 1, summary: { total: 100, completed: 50 } });
  const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${source}></lr-task-list>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part="source-error"]')));
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.equal('');
});


it('names source tasks from their rendered label, detail and rich slot content', async () => {
  const el = await fixture<TaskList>(html`<lr-task-list .treeSource=${oneRow({ ...row(0), childCount: 0,
    value: { id: 'task0', label: 'Task', status: 'pending', detail: 'Details' } })}>
    <span slot="detail-task0">Additional context</span></lr-task-list>`); await ready(el);
  expect(el.shadowRoot!.querySelector('[data-source-key]')!.getAttribute('aria-label')).to.equal('');
  await expect(el).to.be.accessible();
  expect(accessibleName(el.shadowRoot!.querySelector('[data-source-key]')!)).to.equal('Pending Task Details Additional context');
});
