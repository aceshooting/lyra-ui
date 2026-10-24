import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './tree.js';
import type { LyraTree, LyraTreeNodeData } from './tree.class.js';
import type { LyraTreeItem } from './tree-item.js';
import type { LyraHierarchySource, LyraHierarchyQuery } from '../../../data-sources.js';

function source(count = 1_000_000): LyraHierarchySource<LyraTreeNodeData, LyraHierarchyQuery> {
  return { revision: 1, async project(request) {
    const key = request.action.type === 'reveal' ? request.action.key : undefined;
    return { state: 'initial', total: count, rows: { count,
      keyAt: (index: number) => `n${index}`,
      indexOfKey: (value: string | number) => Number(String(value).slice(1)),
      itemAt: (index: number) => { const key = `n${index}`; return { key, value: { id: key, label: key }, parentKey: null,
        level: 1, position: index + 1, setSize: count, childCount: 0, expanded: false, selected: false }; },
    }, ...(key ? { focusIndex: Number(key.slice(1)) } : {}) };
  } };
}

it('renders the real final logical hierarchy row without the legacy admission prefix', async () => {
  const warning = 'Virtual list scroll travel is scaled to fit browser layout limits; row sizes and public offsets remain in logical pixels.';
  const warningKey = 'virtual-list-scroll-scaling';
  const store = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  const wasIssued = store?.has(warningKey);
  store?.delete(warningKey);
  const previousWarn = console.warn;
  let warningCount = 0;
  console.warn = (...args: unknown[]) => {
    if (args.length === 1 && args[0] === warning) warningCount++;
    else previousWarn.apply(console, args);
  };
  let el: LyraTree | undefined;
  let list: import('../../layout/virtual-list/virtual-list.class.js').LyraVirtualList | undefined;
  try {
    el = await fixture<LyraTree>(html`<lr-tree label="Source tree" style="height: 300px"></lr-tree>`);
    const host = el;
    el.treeSource = source();
    el.requestUpdate();
    await waitUntil(() => Boolean(host.shadowRoot?.querySelector('[part~="source-row"]')), 'source row', { timeout: 1500 });
    const revealed = await el.revealSourceKey('n999999');
    expect(revealed).to.equal(true);
    const row = el.shadowRoot!.querySelector('[data-source-key="n999999"]')!;
    expect(row.getAttribute('aria-posinset')).to.equal('1000000');
    expect(row.getAttribute('aria-setsize')).to.equal('1000000');
    expect(el.shadowRoot!.querySelectorAll('[part~="source-row"]').length).to.be.at.most(301);
    list = el.shadowRoot!.querySelector('lr-virtual-list') as import('../../layout/virtual-list/virtual-list.class.js').LyraVirtualList;
    list.requestUpdate();
    await list.updateComplete;
    expect(warningCount).to.equal(store ? 1 : 0);
  } finally {
    try {
      // Disconnect can schedule another render; keep the diagnostic captured through teardown.
      el?.remove();
      await el?.updateComplete;
      await list?.updateComplete;
    } finally {
      console.warn = previousWarn;
      if (wasIssued) store?.add(warningKey);
      else store?.delete(warningKey);
    }
  }
});

it('ignores nested children, renders logical depth, and never fabricates legacy selection arrays', async () => {
  let childrenReads = 0;
  let selected = false;
  const actions: string[] = [];
  const provider = source(1);
  const original = provider.project;
  provider.project = async request => {
    actions.push(request.action.type);
    if (request.action.type === 'select') selected = request.action.selected;
    const result = await original(request);
    const rows = result.rows as Extract<typeof result.rows, { itemAt: unknown }>;
    const itemAt = rows.itemAt;
    return { ...result, state: String(actions.length), rows: { ...rows, itemAt(index: number) {
      const row = itemAt(index);
      Object.defineProperty(row.value, 'children', { get() { childrenReads++; throw new Error('Do not traverse'); } });
      return { ...row, level: 1_000_000, selected };
    } } };
  };
  const el = await fixture<LyraTree>(html`<lr-tree label="Deep source" .treeSource=${provider}></lr-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot?.querySelector('[part~="source-row"]')));
  const row = el.shadowRoot!.querySelector<HTMLElement>('[part~="source-row"]')!;
  expect(row.getAttribute('aria-level')).to.equal('1000000');
  expect(row.style.getPropertyValue('--source-depth')).to.equal('32');
  let legacy = 0;
  let accepted = 0;
  el.addEventListener('lr-selection-change', () => legacy++);
  el.addEventListener('lr-source-selection-change', () => accepted++);
  row.click();
  await waitUntil(() => accepted === 1);
  expect(actions.filter(action => action === 'select').length).to.equal(1);
  expect(legacy).to.equal(0);
  expect(el.selectedItems.length).to.equal(0);
  expect(childrenReads).to.equal(0);
});

it('refreshes same-source closures on coalesced keyless writes and restores legacy data when unset', async () => {
  let label = 'First';
  let projects = 0;
  const provider = source(1);
  const original = provider.project;
  provider.project = async request => {
    projects++;
    const result = await original(request);
    const rows = result.rows as Extract<typeof result.rows, { itemAt: unknown }>;
    return { ...result, rows: { ...rows, itemAt: (index: number) => ({ ...rows.itemAt(index), value: { id: 'n0', label } }) } };
  };
  const legacy = [{ id: 'old', label: 'Legacy data' }];
  const el = await fixture<LyraTree>(html`<lr-tree label="Tree" .data=${legacy} .treeSource=${provider}></lr-tree>`);
  await waitUntil(() => el.shadowRoot!.textContent!.includes('First'));
  const initial = projects;
  el.label = 'Changed name';
  await el.updateComplete;
  expect(projects).to.equal(initial);
  label = 'Second';
  el.requestUpdate();
  el.label = 'Coalesced name';
  await waitUntil(() => el.shadowRoot!.textContent!.includes('Second'));
  expect(projects).to.equal(initial + 1);
  el.treeSource = undefined;
  await el.updateComplete;
  expect(el.querySelectorAll('lr-tree-item').length).to.equal(1);
  expect(el.data[0]?.id).to.equal('old');
});

it('holds one physical projection and only the latest reveal while an obsolete provider ignores abort', async () => {
  let release!: () => void;
  let calls = 0;
  const provider = source(10);
  const original = provider.project;
  provider.project = async request => {
    calls++;
    if (calls === 1) await new Promise<void>(resolve => { release = resolve; });
    return original(request);
  };
  const el = await fixture<LyraTree>(html`<lr-tree label="Deferred source" .treeSource=${provider}></lr-tree>`);
  await waitUntil(() => calls === 1);
  const requests = Array.from({ length: 20 }, (_, index) => el.revealSourceKey(`n${index % 10}`));
  expect(await requests[0]).to.equal(false);
  expect(calls).to.equal(1);
  release();
  expect(await requests[19]).to.equal(true);
  expect(calls).to.equal(2);
});

it('fails closed for an invalid defined provider and exposes localized retry without legacy fallback', async () => {
  const el = await fixture<LyraTree>(html`<lr-tree label="Invalid" .data=${[{ id: 'legacy', label: 'Legacy' }]}
    .strings=${{ treeSourceError: 'Source unavailable' }}></lr-tree>`);
  el.treeSource = {} as unknown as NonNullable<LyraTree['treeSource']>;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part~="source-error"]')?.textContent).to.contain('Source unavailable');
  expect(el.shadowRoot!.querySelectorAll('[part~="source-row"]').length).to.equal(0);
  expect(el.querySelectorAll('lr-tree-item').length).to.equal(0);
  el.treeSource = source(1);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-row"]')));
});

it('starts a real row roving stop and keeps transparent structural roles under RTL navigation', async () => {
  const el = await fixture<LyraTree>(html`<lr-tree label="Keyboard tree" dir="rtl" .treeSource=${source(10)}></lr-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-row"]')));
  expect(el.shadowRoot!.querySelector('[data-source-key="n0"]')!.getAttribute('tabindex')).to.equal('0');
  expect(el.shadowRoot!.querySelector('[role="tree"]')!.getAttribute('tabindex')).to.equal('-1');
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  expect(list.shadowRoot!.querySelectorAll('[role="list"], [role="listitem"]').length).to.equal(0);
  expect(list.shadowRoot!.querySelector('[part="base"]')!.hasAttribute('tabindex')).to.equal(false);
});


it('swaps branch arrows in RTL and keeps leaf selection and disabled navigation bounded', async () => {
  let expanded = false;
  let selects = 0;
  let reads = 0;
  const provider = source(1);
  provider.project = async request => {
    if (request.action.type === 'toggle') expanded = request.action.expanded;
    if (request.action.type === 'select') selects++;
    const snapshot = expanded;
    return { state: String(snapshot), total: 2, rows: { count: snapshot ? 2 : 1,
      keyAt: index => `n${index}`, indexOfKey: (key: string | number) => Number(String(key).slice(1)),
      itemAt(index) { reads++; return { key: `n${index}`, value: { id: `n${index}`, label: `Node ${index}` },
        parentKey: index ? 'n0' : null, level: index + 1, position: 1, setSize: 1, childCount: index ? 0 : 1,
        expanded: index ? false : snapshot, selected: false, disabled: index === 1 }; },
    } };
  };
  const el = await fixture<LyraTree>(html`<lr-tree label="RTL" dir="rtl" selection="leaf" .treeSource=${provider}></lr-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[data-source-key="n0"]')));
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[data-source-key="n0"]')!);
  await sendKeys({ press: 'Enter' });
  expect(selects).to.equal(0);
  await sendKeys({ press: 'ArrowLeft' });
  await waitUntil(() => expanded && Boolean(el.shadowRoot!.querySelector('[data-source-key="n1"]')));
  await el.updateComplete;
  await sendKeys({ press: 'ArrowDown' });
  await new Promise(resolve => requestAnimationFrame(resolve));
  expect(el.shadowRoot!.querySelector('[data-source-key="n1"]')!.getAttribute('tabindex')).to.equal('-1');
  await sendKeys({ press: 'ArrowRight' });
  await waitUntil(() => !expanded);
  expect(reads).to.be.lessThan(32);
});

it('keeps a reachable tree tab stop when unfocused scrolling removes the active row', async () => {
  const container = await fixture<HTMLDivElement>(html`<div><lr-tree label="Unfocused scroll" .treeSource=${source(1000)}></lr-tree><button>Outside</button></div>`);
  const el = container.querySelector<LyraTree>('lr-tree')!;
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[data-source-key="n0"]')));
  const outside = container.querySelector('button')!;
  await focusByKeyboard(outside);
  const list = el.shadowRoot!.querySelector('lr-virtual-list') as import('../../layout/virtual-list/virtual-list.class.js').LyraVirtualList;
  list.scrollToIndex(750, { align: 'start', behavior: 'auto' });
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[data-source-key="n750"]')));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="tree"][tabindex="0"], [role="treeitem"][tabindex="0"]').length).to.equal(1);
  expect(document.activeElement === outside).to.equal(true);
  const root = el.shadowRoot!.querySelector<HTMLElement>('[role="tree"]')!;
  await focusByKeyboard(root);
  await sendKeys({ press: 'ArrowDown' });
  await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('role') === 'treeitem');
  expect(Number(el.shadowRoot!.activeElement?.getAttribute('aria-posinset'))).to.be.greaterThan(700);
});

it('announces later row errors through the light-DOM sink without refreshing the provider', async () => {
  const provider = source(1000);
  const project = provider.project;
  let calls = 0;
  provider.project = async request => {
    calls++;
    const result = await project(request);
    const rows = result.rows as Extract<typeof result.rows, { itemAt: unknown }>;
    return { ...result, rows: { ...rows, itemAt: (index: number) => ({ ...rows.itemAt(index), level: index >= 750 ? 0 : 1 }) } };
  };
  const el = await fixture<LyraTree>(html`<lr-tree label="Row failures" .treeSource=${provider}
    .strings=${{ treeSourceError: 'Rows unavailable' }}></lr-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[data-source-key="n0"]')));
  const count = () => [...document.querySelectorAll('[data-lr-live-region] > div')].filter(node => node.textContent === 'Rows unavailable').length;
  expect(count()).to.equal(0);
  const before = calls;
  const list = el.shadowRoot!.querySelector('lr-virtual-list') as import('../../layout/virtual-list/virtual-list.class.js').LyraVirtualList;
  list.scrollToIndex(750, { align: 'start', behavior: 'auto' });
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
  await waitUntil(() => count() === 1);
  expect(calls).to.equal(before);
});

it('keeps initial malformed rows quiet while displaying the localized failure', async () => {
  const provider = source(1);
  const project = provider.project;
  provider.project = async request => {
    const result = await project(request);
    const rows = result.rows as Extract<typeof result.rows, { itemAt: unknown }>;
    return { ...result, rows: { ...rows, itemAt: (index: number) => ({ ...rows.itemAt(index), level: 0 }) } };
  };
  const el = await fixture<LyraTree>(html`<lr-tree label="Initial failure" .treeSource=${provider} .strings=${{ treeSourceError: 'Initial row unavailable' }}></lr-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
  await el.updateComplete;
  await new Promise(resolve => requestAnimationFrame(resolve));
  expect([...document.querySelectorAll('[data-lr-live-region] > div')].filter(node => node.textContent === 'Initial row unavailable').length).to.equal(0);
});

it('leaves expandAll and collapseAll as no-ops while a source owns the rows', async () => {
  const provider = source(3);
  const el = await fixture<LyraTree>(html`<lr-tree label="Source tree" style="height: 300px" .treeSource=${provider}></lr-tree>`);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part~="source-row"]').length === 3, 'source rows', { timeout: 3000 });
  await el.expandAll();
  await el.collapseAll();
  expect(el.shadowRoot!.querySelectorAll('[part~="source-row"]').length).to.equal(3);
  el.treeSource = undefined;
  el.data = [{ id: 'parent', label: 'Parent', children: [{ id: 'child', label: 'Child' }] }];
  await el.updateComplete;
  const parent = el.querySelector<LyraTreeItem>('lr-tree-item')!;
  await el.expandAll();
  expect(parent.expanded).to.equal(true);
  await el.collapseAll();
  expect(parent.expanded).to.equal(false);
});
