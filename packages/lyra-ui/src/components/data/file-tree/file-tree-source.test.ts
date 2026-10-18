import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './file-tree.js';
import type { LyraFileTree, FileTreeNode } from './file-tree.class.js';
import type { LyraHierarchySource, LyraHierarchyQuery } from '../../../data-sources.js';

function source(count = 1_000_000): LyraHierarchySource<FileTreeNode, LyraHierarchyQuery> {
  return { revision: 1, async project(request) {
    const key = request.action.type === 'reveal' ? request.action.key : undefined;
    return { state: 'initial', total: count, rows: { count,
      keyAt: (index: number) => `n${index}`,
      indexOfKey: (value: string | number) => Number(String(value).slice(1)),
      itemAt: (index: number) => { const key = `n${index}`; return { key, value: { path: key, name: key, kind: 'file' }, parentKey: null,
        level: 1, position: index + 1, setSize: count, childCount: 0, expanded: false, selected: false }; },
    }, ...(key ? { focusIndex: Number(key.slice(1)) } : {}) };
  } };
}

it('renders the real final logical hierarchy row without the legacy admission prefix', async () => {
  const el = await fixture<LyraFileTree>(html`<lr-file-tree label="Source tree" style="height: 300px"></lr-file-tree>`);
  el.treeSource = source();
  el.requestUpdate();
  await waitUntil(() => Boolean(el.shadowRoot?.querySelector('[part~="source-row"]')), 'source row', { timeout: 1500 });
  const revealed = await el.revealSourceKey('n999999');
  expect(revealed).to.equal(true);
  const row = el.shadowRoot!.querySelector('[data-source-key="n999999"]')!;
  expect(row.getAttribute('aria-posinset')).to.equal('1000000');
  expect(row.getAttribute('aria-setsize')).to.equal('1000000');
  expect(el.shadowRoot!.querySelectorAll('[part~="source-row"]').length).to.be.at.most(301);
});

it('keeps accepted file select/open details bounded and respects controlled selection without user events', async () => {
  let selected = false;
  const actions: string[] = [];
  const provider = source(1);
  const original = provider.project;
  provider.project = async request => {
    actions.push(request.action.type);
    if (request.action.type === 'select') selected = request.action.selected;
    const result = await original(request);
    const rows = result.rows as Extract<typeof result.rows, { itemAt: unknown }>;
    const snapshot = selected;
    return { ...result, state: String(actions.length), rows: { ...rows, itemAt: (index: number) => ({ ...rows.itemAt(index), selected: snapshot }) } };
  };
  const el = await fixture<LyraFileTree>(html`<lr-file-tree .treeSource=${provider}></lr-file-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot?.querySelector('[part~="source-row"]')));
  const selections: Readonly<{ filePath: string; node: FileTreeNode }>[] = [];
  const opens: unknown[] = [];
  el.addEventListener('lr-file-select', event => selections.push(event.detail));
  el.addEventListener('lr-file-open', event => opens.push(event.detail));
  el.shadowRoot!.querySelector<HTMLElement>('[part~="source-row"]')!.click();
  await waitUntil(() => selections.length === 1);
  await el.updateComplete;
  expect(el.selectedPath).to.equal('n0');
  expect(Object.isFrozen(selections[0])).to.equal(true);
  expect(Object.isFrozen(selections[0]!.node)).to.equal(true);
  expect(selections[0]!.node.children).to.equal(undefined);
  expect(opens.length).to.equal(0);
  el.shadowRoot!.querySelector<HTMLElement>('[part~="source-row"]')!.click();
  await waitUntil(() => opens.length === 1);
  el.selectedPath = null;
  await waitUntil(() => !selected);
  expect(selections.length).to.equal(2);
  expect(actions.filter(action => action === 'select').length).to.equal(3);
  expect(await el.revealPath('n0')).to.equal(true);
});

it('uses provider toggles instead of legacy lazy loading and restores bounded nodes when unset', async () => {
  let expanded = false;
  const provider = source(1);
  const original = provider.project;
  provider.project = async request => {
    if (request.action.type === 'toggle') expanded = request.action.expanded;
    const result = await original(request);
    const rows = result.rows as Extract<typeof result.rows, { itemAt: unknown }>;
    const snapshot = expanded;
    return { ...result, rows: { ...rows, itemAt: (index: number) => ({ ...rows.itemAt(index), childCount: 1000000, expanded: snapshot,
      value: { path: 'n0', name: 'Directory', kind: 'directory' } }) } };
  };
  const el = await fixture<LyraFileTree>(html`<lr-file-tree .nodes=${[{ path: 'legacy', name: 'Legacy' }]} .treeSource=${provider}></lr-file-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot?.querySelector('[part~="source-row"]')));
  let lazy = 0;
  el.addEventListener('lr-load-children', () => lazy++);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="source-toggle"]')!.click();
  await waitUntil(() => expanded);
  await el.expandAll();
  el.collapseAll();
  expect(expanded).to.equal(true);
  expect(lazy).to.equal(0);
  el.treeSource = undefined;
  await el.updateComplete;
  expect(el.nodes[0]?.path).to.equal('legacy');
  expect(el.shadowRoot!.querySelector('lr-tree')).not.to.equal(null);
});

it('applies an initial controlled path after the initial opaque state has committed', async () => {
  let release!: () => void;
  const states: (string | null)[] = [];
  const provider = source(1);
  const original = provider.project;
  provider.project = async request => {
    states.push(request.state);
    if (request.action.type === 'reset') await new Promise<void>(resolve => { release = resolve; });
    return original(request);
  };
  const el = await fixture<LyraFileTree>(html`<lr-file-tree .selectedPath=${'n0'} .treeSource=${provider}></lr-file-tree>`);
  await waitUntil(() => Boolean(release));
  release();
  await waitUntil(() => states.length === 2);
  expect(states).to.deep.equal([null, 'initial']);
  expect(el.selectedPath).to.equal('n0');
});

it('never opens a provider branch when optional domain kind is omitted', async () => {
  let selected = false;
  const provider = source(1);
  const project = provider.project;
  provider.project = async request => {
    if (request.action.type === 'select') selected = true;
    const result = await project(request);
    const rows = result.rows as Extract<typeof result.rows, { itemAt: unknown }>;
    const snapshot = selected;
    return { ...result, total: 2, rows: { ...rows, itemAt: (index: number) => ({ ...rows.itemAt(index),
      childCount: 1, selected: snapshot, value: { path: 'n0', name: 'Directory' } }) } };
  };
  const el = await fixture<LyraFileTree>(html`<lr-file-tree .treeSource=${provider}></lr-file-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-row"]')));
  let selections = 0;
  let opens = 0;
  el.addEventListener('lr-file-select', () => selections++);
  el.addEventListener('lr-file-open', () => opens++);
  el.shadowRoot!.querySelector<HTMLElement>('[part~="source-row"]')!.click();
  await waitUntil(() => selections === 1);
  await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLElement>('[part~="source-row"]')!.click();
  await waitUntil(() => selections === 2);
  expect(opens).to.equal(0);
});

it('revokes file-open when a synchronous select listener replaces the source', async () => {
  const provider = source(1);
  const project = provider.project;
  provider.project = async request => {
    const result = await project(request);
    const rows = result.rows as Extract<typeof result.rows, { itemAt: unknown }>;
    return { ...result, rows: { ...rows, itemAt: (index: number) => ({ ...rows.itemAt(index), selected: true }) } };
  };
  const el = await fixture<LyraFileTree>(html`<lr-file-tree .treeSource=${provider}></lr-file-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-row"]')));
  let selections = 0;
  let opens = 0;
  el.addEventListener('lr-file-select', () => { selections++; el.treeSource = undefined; });
  el.addEventListener('lr-file-open', () => opens++);
  el.shadowRoot!.querySelector<HTMLElement>('[part~="source-row"]')!.click();
  await waitUntil(() => selections === 1);
  expect(opens).to.equal(0);
});

it('rejects blank and over-budget controlled paths before calling the provider', async () => {
  const provider = source(1);
  const project = provider.project;
  const keys: string[] = [];
  provider.project = async request => { if (request.action.type === 'select') keys.push(request.action.key); return project(request); };
  const el = await fixture<LyraFileTree>(html`<lr-file-tree .treeSource=${provider}></lr-file-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-row"]')));
  for (const path of ['', '   ', 'x'.repeat(65_537)]) {
    el.selectedPath = path;
    await el.updateComplete;
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  expect(keys.length).to.equal(0);
});

it('reconciles an unchanged controlled path into a replacement source', async () => {
  const first = source(1);
  const el = await fixture<LyraFileTree>(html`<lr-file-tree .selectedPath=${'n0'} .treeSource=${first}></lr-file-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-row"]')));
  await el.updateComplete;
  const next = source(1);
  const project = next.project;
  const keys: string[] = [];
  next.project = async request => { if (request.action.type === 'select') keys.push(request.action.key); return project(request); };
  el.treeSource = next;
  await waitUntil(() => keys.length === 1);
  expect(keys).to.deep.equal(['n0']);
});

it('revokes pending controlled reconciliation when a newer source replaces it', async () => {
  const first = source(1);
  const el = await fixture<LyraFileTree>(html`<lr-file-tree .selectedPath=${'n0'} .treeSource=${first}></lr-file-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-row"]')));
  const pending = source(1);
  const project = pending.project;
  let release!: () => void;
  let staleSelections = 0;
  pending.project = async request => {
    if (request.action.type === 'reset') await new Promise<void>(resolve => { release = resolve; });
    else if (request.action.type === 'select') staleSelections++;
    return project(request);
  };
  el.treeSource = pending;
  await waitUntil(() => Boolean(release));
  const latest = source(1);
  const latestProject = latest.project;
  let currentSelections = 0;
  latest.project = async request => { if (request.action.type === 'select') currentSelections++; return latestProject(request); };
  el.treeSource = latest;
  release();
  await waitUntil(() => currentSelections === 1);
  await el.updateComplete;
  expect(staleSelections).to.equal(0);
  expect(currentSelections).to.equal(1);
});
