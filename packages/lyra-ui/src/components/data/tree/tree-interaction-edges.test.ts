import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-tree.js';
import type { LyraTree, LyraTreeNodeData } from '../../lr-tree.js';
import type { LyraTreeItem } from '../../lr-tree-item.js';
import type { LyraHierarchySource, LyraHierarchyQuery } from '../../../data-sources.js';

const data: LyraTreeNodeData[] = [
  { id: 'root', label: 'Root', children: [{ id: 'child', label: 'Child' }] },
  { id: 'leaf', label: 'Leaf' },
];

function items(tree: LyraTree): LyraTreeItem[] {
  return [...tree.querySelectorAll('lr-tree-item')] as LyraTreeItem[];
}

function required<T>(value: T | null | undefined, context: string): T {
  if (value == null) throw new Error(`Missing ${context}`);
  return value;
}

function key(target: Element, keyName: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: keyName, bubbles: true, composed: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function oneRowSource(): LyraHierarchySource<LyraTreeNodeData, LyraHierarchyQuery> {
  return {
    revision: 1,
    async project() {
      return {
        state: 'initial',
        total: 1,
        rows: {
          count: 1,
          keyAt: () => 'source-row',
          indexOfKey: () => 0,
          itemAt: () => ({
            key: 'source-row', value: { id: 'source-row', label: 'Source row' }, parentKey: null,
            level: 1, position: 1, setSize: 1, childCount: 0, expanded: false, selected: false,
          }),
        },
      };
    },
  };
}

describe('lr-tree interaction edges', () => {
  it('normalizes an unknown selection mode back to single selection', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Files" selection="multiple" .data=${data}></lr-tree>`);
    await el.updateComplete;
    expect(items(el)[0]!.hasAttribute('aria-checked')).to.equal(true);

    el.selection = 'every-other' as LyraTree['selection'];
    await el.updateComplete;

    expect(el.selection).to.equal('single');
    expect(el.getAttribute('selection')).to.not.equal('every-other');
    expect(items(el)[0]!.hasAttribute('aria-checked')).to.equal(false);
    expect(items(el)[0]!.getAttribute('aria-selected')).to.equal('false');
  });

  it('reports no selection change when the already-selected row is selected again', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Files" .data=${data}></lr-tree>`);
    await el.updateComplete;
    const leaf = required(items(el)[1], 'leaf row');
    let changes = 0;
    el.addEventListener('lr-selection-change', () => changes++);

    leaf.click();
    await el.updateComplete;
    leaf.click();
    await el.updateComplete;

    expect(changes).to.equal(1);
    expect(el.selectedItems.map((node) => node.nodeId)).to.deep.equal(['leaf']);
  });

  it('keeps focus and expansion unchanged when ArrowRight is pressed on a leaf', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Files" .data=${data}></lr-tree>`);
    await el.updateComplete;
    const leaf = required(items(el)[1], 'leaf row');
    await focusByKeyboard(leaf, el);
    await el.updateComplete;

    const event = key(leaf, 'ArrowRight');
    await el.updateComplete;

    expect(event.defaultPrevented).to.equal(true);
    expect(leaf.expanded).to.equal(false);
    expect(leaf.tabIndex).to.equal(0);
    expect(required(items(el)[0], 'root row').tabIndex).to.equal(-1);
  });

  it('leaves navigation keys to the page when every row is disabled', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Files" .data=${[
      { id: 'a', label: 'A', disabled: true },
      { id: 'b', label: 'B', disabled: true },
    ]}></lr-tree>`);
    await el.updateComplete;

    const event = key(el, 'ArrowDown');

    expect(event.defaultPrevented).to.equal(false);
    expect(items(el).map((node) => node.tabIndex)).to.deep.equal([-1, -1]);
  });

  it('keeps the focused row as the roving target when another row expands programmatically', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Files" style="--show-duration:0ms" .data=${data}></lr-tree>`);
    await el.updateComplete;
    const [root, leaf] = items(el);
    await focusByKeyboard(leaf!, el);
    await el.updateComplete;

    root!.expand();
    await el.updateComplete;
    await root!.updateComplete;

    expect(root!.expanded).to.equal(true);
    expect(leaf!.tabIndex).to.equal(0);
    expect(root!.tabIndex).to.equal(-1);
  });

  it('moves the data-model roving stop off a generated row that becomes inert', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Files" .data=${data}></lr-tree>`);
    await el.updateComplete;
    const [root, leaf] = items(el);
    expect(root!.tabIndex).to.equal(0);

    root!.inert = true;
    await waitUntil(() => leaf!.tabIndex === 0, 'roving stop moves to the next navigable row');

    expect(root!.tabIndex).to.equal(-1);
    root!.inert = false;
    await aTimeout(0);
    await el.updateComplete;
    expect(items(el).filter((node) => node.tabIndex === 0)).to.have.length(1);
  });

  it('lets a label control own its clicks and ignores attribute churn on that control', async () => {
    const el = await fixture<LyraTree>(html`
      <lr-tree label="Topics">
        <lr-tree-item><span>Alpha</span> <button type="button">Rename</button></lr-tree-item>
        <lr-tree-item label="Beta"></lr-tree-item>
      </lr-tree>
    `);
    await el.updateComplete;
    const [alpha, beta] = items(el);
    const button = required(alpha!.querySelector('button'), 'label control');
    let selections = 0;
    el.addEventListener('lr-selection-change', () => selections++);

    button.click();
    button.toggleAttribute('disabled', true);
    await aTimeout(0);
    await el.updateComplete;

    expect(selections).to.equal(0);
    expect(alpha!.selected).to.equal(false);
    expect(alpha!.tabIndex).to.equal(0);
    expect(beta!.tabIndex).to.equal(-1);

    alpha!.click();
    await el.updateComplete;
    expect(selections).to.equal(1);
    expect(alpha!.selected).to.equal(true);
  });

  it('abandons a pending hierarchy sync when a tree source takes over', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Files" style="height: 200px"></lr-tree>`);
    el.data = data;
    el.treeSource = oneRowSource();

    await waitUntil(
      () => Boolean(el.shadowRoot?.querySelector('[part~="source-row"]')),
      'source row renders',
      { timeout: 2000 },
    );
    await el.updateComplete;
    expect(el.querySelectorAll('lr-tree-item').length).to.equal(0);
    await el.expandAll();
    await el.collapseAll();
    expect(el.querySelectorAll('lr-tree-item').length).to.equal(0);
  });

  it('keeps the roving stop on an enabled row when script focuses a disabled one', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree label="Files" .data=${[
      { id: 'enabled', label: 'Enabled' },
      { id: 'disabled', label: 'Disabled', disabled: true },
    ]}></lr-tree>`);
    await el.updateComplete;
    const [enabled, disabled] = items(el);

    await focusByKeyboard(disabled!);
    await el.updateComplete;
    expect(enabled!.tabIndex).to.equal(0);
    expect(disabled!.tabIndex).to.equal(-1);

    el.data = [
      { id: 'enabled', label: 'Enabled again' },
      { id: 'disabled', label: 'Disabled', disabled: true },
    ];
    await el.updateComplete;
    expect(items(el)[0]!.tabIndex).to.equal(0);
    expect(items(el).filter((node) => node.tabIndex === 0)).to.have.length(1);
  });

  it('terminates every connected walk when a malformed child API repeats a row', async () => {
    const el = await fixture<LyraTree>(html`
      <lr-tree label="Cycle" selection="multiple" style="--show-duration:0ms">
        <lr-tree-item label="Parent"><lr-tree-item label="Child"></lr-tree-item></lr-tree-item>
        <lr-tree-item label="Other"></lr-tree-item>
      </lr-tree>
    `);
    await el.updateComplete;
    const [parent, child, other] = items(el);
    parent!.expand();
    await el.updateComplete;
    await parent!.updateComplete;
    parent!.childItems = () => [child!, child!];

    child!.click();
    await el.updateComplete;
    expect(child!.selected).to.equal(true);
    expect(parent!.selected).to.equal(true);
    expect(other!.selected).to.equal(false);

    await focusByKeyboard(child!, el);
    key(child!, 'ArrowDown');
    await el.updateComplete;
    expect(other!.tabIndex).to.equal(0);

    await el.expandAll();
    expect(parent!.expanded).to.equal(true);
    expect(el.selectedItems.map((node) => node.label)).to.deep.equal(['Parent', 'Child']);
  });
});
