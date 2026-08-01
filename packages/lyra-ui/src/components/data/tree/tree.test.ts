import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './tree.js';
import type { LyraTree, TreeItem } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';

const data = [
  {
    id: '1',
    label: 'Root',
    badge: 2,
    children: [
      { id: '1.1', label: 'Child A' },
      { id: '1.2', label: 'Child B' },
    ],
  },
  { id: '2', label: 'Leaf' },
];

it('exposes selection and skips disabled items in interaction and roving focus', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [
    { id: 'loading', label: 'Loading…', disabled: true },
    { id: 'selected', label: 'Selected', selected: true },
  ];
  await el.updateComplete;
  const [loading, selected] = [...el.querySelectorAll('lr-tree-item')] as LyraTreeItem[];
  let selections = 0;
  el.addEventListener('lr-node-select', () => selections++);

  expect(loading.getAttribute('aria-disabled')).to.equal('true');
  expect(loading.tabIndex).to.equal(-1);
  expect(selected.getAttribute('aria-disabled')).to.equal('false');
  expect(selected.getAttribute('aria-selected')).to.equal('true');
  expect(selected.tabIndex).to.equal(0);
  loading.click();
  expect(selections).to.equal(0);
});

it('does not choose a hidden child of a collapsed disabled branch as the roving stop', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [
    {
      id: 'disabled-branch',
      label: 'Disabled branch',
      disabled: true,
      children: [{ id: 'hidden-child', label: 'Hidden child' }],
    },
    { id: 'visible', label: 'Visible item' },
  ];
  await el.updateComplete;
  const [disabled, visible] = [...el.querySelectorAll('lr-tree-item')] as HTMLElement[];

  expect(disabled.tabIndex).to.equal(-1);
  expect(visible.tabIndex).to.equal(0);
});

it('stops rendering a cyclic item graph instead of recursing indefinitely', async () => {
  const cyclic = { id: 'cycle', label: 'Cycle' } as TreeItem;
  cyclic.children = [cyclic];
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [cyclic];
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as LyraTreeItem;

  root.expand();
  await root.updateComplete;
  const repeated = root.shadowRoot!.querySelector('lr-tree-item') as LyraTreeItem;
  expect(repeated).to.exist;
  expect(repeated.hasChildren).to.be.false;
});

it('bounds rendering of a valid extremely deep hierarchy', async () => {
  let item: TreeItem = { id: 'leaf', label: 'Leaf' };
  for (let depth = 5000; depth > 0; depth--) {
    item = { id: `level-${depth}`, label: `Level ${depth}`, children: [item] };
  }
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [item];
  await el.updateComplete;
  await el.expandAll();

  let renderedDepth = 0;
  let current = el.querySelector('lr-tree-item') as LyraTreeItem | null;
  while (current) {
    renderedDepth++;
    current = current.shadowRoot?.querySelector('lr-tree-item') as LyraTreeItem | null;
  }
  expect(renderedDepth).to.be.greaterThan(1);
  expect(renderedDepth).to.be.lessThan(5000);
});

it('mirrors the collapsed disclosure chevron under RTL while keeping expanded chevrons downward', async () => {
  // Reads real computed transforms off rendered nodes instead of substring-matching the exported
  // stylesheet source, which would still pass even if a selector typo left the rule dead.
  const branch: TreeItem = { id: 'branch', label: 'Branch', children: [{ id: 'leaf', label: 'Leaf' }] };

  const ltrCollapsed = (await fixture(
    html`<lr-tree-item .item=${branch}></lr-tree-item>`,
  )) as LyraTreeItem;
  const ltrExpanded = (await fixture(
    html`<lr-tree-item expanded .item=${branch}></lr-tree-item>`,
  )) as LyraTreeItem;
  const rtlCollapsed = (await fixture(
    html`<lr-tree-item dir="rtl" .item=${branch}></lr-tree-item>`,
  )) as LyraTreeItem;
  const rtlExpanded = (await fixture(
    html`<lr-tree-item dir="rtl" expanded .item=${branch}></lr-tree-item>`,
  )) as LyraTreeItem;

  const toggleOf = (node: LyraTreeItem) =>
    node.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;

  expect(getComputedStyle(toggleOf(ltrCollapsed)).transform).to.equal('none');
  const ltrExpandedTransform = getComputedStyle(toggleOf(ltrExpanded)).transform;
  expect(ltrExpandedTransform).to.not.equal('none');
  expect(getComputedStyle(toggleOf(rtlCollapsed)).transform).to.contain('matrix(-1');
  // The more specific :host([expanded]:dir(rtl)) rule must win back to the same "downward"
  // rotation as the plain expanded (non-RTL) state, rather than stacking with (or losing to) the
  // plain :dir(rtl) 180deg rule.
  expect(getComputedStyle(toggleOf(rtlExpanded)).transform).to.equal(ltrExpandedTransform);
});

it('never scrolls vertically -- overflow-x:auto alone lets the y axis compute to auto too, which can show a phantom scrollbar', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).overflowY).to.equal('hidden');
});

it('renders top-level treeitems with a tree role', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[role="tree"]')).to.exist;
  const items = el.querySelectorAll('lr-tree-item');
  expect(items.length).to.equal(2);
});

it('renders the localized "No data" heading in the empty state', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  const empty = el.shadowRoot!.querySelector('[part="empty"]') as HTMLElement & { heading: string };
  expect(empty.heading).to.equal('No data');
});

it('honors a .strings override for the empty-state noData heading', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.strings = { noData: 'Aucune donnée' };
  await el.updateComplete;
  const empty = el.shadowRoot!.querySelector('[part="empty"]') as HTMLElement & { heading: string };
  expect(empty.heading).to.equal('Aucune donnée');
});

it('emits lr-node-toggle when a parent node is expanded', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as HTMLElement;
  const toggle = root.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  setTimeout(() => toggle.click());
  const ev = await oneEvent(el, 'lr-node-toggle');
  expect(ev.detail).to.deep.equal({ id: '1', expanded: true });
});

it('emits lr-node-select when a node label is activated', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const leaf = [...el.querySelectorAll('lr-tree-item')].find(
    (n) => (n as any).item.id === '2',
  ) as HTMLElement;
  const label = leaf.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  setTimeout(() => label.click());
  const ev = await oneEvent(el, 'lr-node-select');
  expect(ev.detail).to.deep.equal({ id: '2' });
});

it('moves real DOM focus to a node when its row (not just the label text) is clicked', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const leaf = [...el.querySelectorAll('lr-tree-item')].find(
    (n) => (n as unknown as LyraTreeItem).item.id === '2',
  ) as unknown as LyraTreeItem;
  const row = (leaf as unknown as HTMLElement).shadowRoot!.querySelector('[part="row"]') as HTMLElement;

  row.click();
  await el.updateComplete;

  expect(deepActiveElement() === (leaf as unknown as Element)).to.equal(true);
});

it('a click on the toggle button does not also fire lr-node-select via bubbling into the row', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  const toggle = (root as unknown as HTMLElement).shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;

  let selectFired = false;
  el.addEventListener('lr-node-select', () => {
    selectFired = true;
  });

  toggle.click();
  await el.updateComplete;

  expect(root.expanded).to.be.true;
  expect(selectFired).to.be.false;
});

it('a mousedown on the toggle button focuses the host node rather than the hidden button itself', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  const toggle = (root as unknown as HTMLElement).shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;

  const mousedown = new MouseEvent('mousedown', { bubbles: true, composed: true, cancelable: true });
  toggle.dispatchEvent(mousedown);

  expect(deepActiveElement()).to.equal(root as unknown as Element);
});

it('a mouse click on a node\'s toggle syncs activeId to that node, not just the previously-focused item', async () => {
  const nested = [
    { id: 'x', label: 'X', children: [{ id: 'x.1', label: 'X1' }] },
    { id: 'y', label: 'Y', children: [{ id: 'y.1', label: 'Y1' }] },
  ];
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = nested;
  await el.updateComplete;
  const [x, y] = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
  expect((x as unknown as HTMLElement).tabIndex).to.equal(0);

  const toggleY = (y as unknown as HTMLElement).shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  toggleY.click();
  await el.updateComplete;

  expect(y.expanded).to.be.true;
  expect((y as unknown as HTMLElement).tabIndex).to.equal(0);
  expect((x as unknown as HTMLElement).tabIndex).to.equal(-1);

  (y as unknown as HTMLElement).focus();
  y.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  const y1 = y.shadowRoot!.querySelector('lr-tree-item');
  expect(deepActiveElement()).to.equal(y1);
});

it('a mouse click that collapses an expanded ancestor of the active node leaves exactly one node with a roving tabindex of 0', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];

  root.expand();
  await el.updateComplete;
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;

  const childA = root.shadowRoot!.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  expect((childA as unknown as HTMLElement).tabIndex).to.equal(0);

  const toggle = (root as unknown as HTMLElement).shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  toggle.click();
  await el.updateComplete;

  expect(root.expanded).to.be.false;
  const tabbable = [root, leaf].filter((n) => (n as unknown as HTMLElement).tabIndex === 0);
  expect(tabbable.length).to.equal(1);
  expect((root as unknown as HTMLElement).tabIndex).to.equal(0);
  expect((leaf as unknown as HTMLElement).tabIndex).to.equal(-1);
});

it('expandAll()/collapseAll() toggle every parent node', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  el.expandAll();
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as any;
  expect(root.expanded).to.be.true;
  el.collapseAll();
  await el.updateComplete;
  expect(root.expanded).to.be.false;
});

it('bulk expansion skips disabled branches', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [
    {
      id: 'disabled-branch',
      label: 'Disabled branch',
      disabled: true,
      children: [{ id: 'hidden-child', label: 'Hidden child' }],
    },
    { id: 'visible', label: 'Visible item' },
  ];
  await el.updateComplete;
  const [disabled, visible] = [...el.querySelectorAll('lr-tree-item')] as LyraTreeItem[];

  await el.expandAll();

  expect(disabled.expanded).to.be.false;
  expect(disabled.shadowRoot!.querySelectorAll('lr-tree-item').length).to.equal(0);
  expect((visible as unknown as HTMLElement).tabIndex).to.equal(0);
});

it('collapseAll closes a branch that became disabled and restores a visible roving stop', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [
    {
      id: 'branch',
      label: 'Branch',
      children: [{ id: 'child', label: 'Child' }],
    },
    { id: 'visible', label: 'Visible item' },
  ];
  await el.updateComplete;
  const branch = el.querySelector('lr-tree-item') as LyraTreeItem;
  branch.expand();
  await el.updateComplete;
  branch.shadowRoot!.querySelector<HTMLElement>('lr-tree-item')!.focus();

  el.data = [
    {
      id: 'branch',
      label: 'Branch',
      disabled: true,
      children: [{ id: 'child', label: 'Child' }],
    },
    { id: 'visible', label: 'Visible item' },
  ];
  await el.updateComplete;
  el.collapseAll();
  await el.updateComplete;

  const visible = [...el.querySelectorAll<HTMLElement>('lr-tree-item')][1]!;
  expect(branch.expanded).to.be.false;
  expect(visible.tabIndex).to.equal(0);
  expect(deepActiveElement()?.getAttribute('aria-disabled')).to.not.equal('true');
});

it('immediately collapses a reused expanded branch when a same-id data refresh disables it', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [
    {
      id: 'branch',
      label: 'Branch',
      children: [{ id: 'child', label: 'Child' }],
    },
    { id: 'visible', label: 'Visible item' },
  ];
  await el.updateComplete;
  const branch = el.querySelector('lr-tree-item') as LyraTreeItem;
  branch.expand();
  await el.updateComplete;
  expect(branch.shadowRoot!.querySelector('lr-tree-item')).to.exist;

  el.data = [
    {
      id: 'branch',
      label: 'Branch',
      disabled: true,
      children: [{ id: 'child', label: 'Child' }],
    },
    { id: 'visible', label: 'Visible item' },
  ];
  await el.updateComplete;

  const [branchAfter, visible] = [...el.querySelectorAll('lr-tree-item')] as LyraTreeItem[];
  expect(branchAfter).to.equal(branch);
  expect(branchAfter.expanded).to.be.false;
  expect(branchAfter.shadowRoot!.querySelector('[part="group"]')).to.be.null;
  expect((visible as unknown as HTMLElement).tabIndex).to.equal(0);
  expect(
    [...el.querySelectorAll<HTMLElement>('lr-tree-item')].filter((node) => node.tabIndex === 0),
  ).to.have.lengthOf(1);
});

it('expandAll() does not mark leaf nodes as expanded, so a following collapseAll() can still reset every parent', async () => {
  const withLeaf = [
    { id: '1', label: 'Root', children: [{ id: '1.1', label: 'Child' }] },
    { id: '2', label: 'Leaf' },
  ];
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = withLeaf;
  await el.updateComplete;
  const leaf = [...el.querySelectorAll('lr-tree-item')].find(
    (n) => (n as any).item.id === '2',
  ) as unknown as LyraTreeItem;

  await el.expandAll();

  expect(leaf.expanded).to.be.false;
  expect((leaf as unknown as HTMLElement).hasAttribute('expanded')).to.be.false;

  el.collapseAll();
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  expect(root.expanded).to.be.false;
});

it('resolves an awaited expandAll() only once every descendant at every depth has actually expanded', async () => {
  const deep = [
    {
      id: 'p',
      label: 'P',
      children: [{ id: 'p1', label: 'P1', children: [{ id: 'p1a', label: 'P1A' }] }],
    },
  ];
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = deep;
  await el.updateComplete;

  await el.expandAll();

  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  expect(root.expanded).to.be.true;
  const child = (root as unknown as HTMLElement).shadowRoot!.querySelector(
    'lr-tree-item',
  ) as unknown as LyraTreeItem;
  expect(child, 'the first-level child should already be rendered').to.exist;
  expect(child.expanded).to.be.true;
  const grandchild = (child as unknown as HTMLElement).shadowRoot!.querySelector('lr-tree-item');
  expect(grandchild, 'the second-level grandchild should already be rendered').to.exist;
});

it('collapseAll() leaves exactly one node with a roving tabindex of 0 after the active item was a nested descendant', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];

  root.expand();
  await el.updateComplete;
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  const childA = root.shadowRoot!.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  expect((childA as unknown as HTMLElement).tabIndex).to.equal(0);

  el.collapseAll();
  await el.updateComplete;

  expect(root.expanded).to.be.false;
  const tabbable = [root, leaf].filter((n) => (n as unknown as HTMLElement).tabIndex === 0);
  expect(tabbable.length).to.equal(1);
});

it('preserves per-node expanded state when data is reassigned a new array with the same ids', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as any;
  root.expanded = true;
  await el.updateComplete;

  // Simulate a re-fetch producing a brand-new array reference with identical ids/labels.
  el.data = JSON.parse(JSON.stringify(data));
  await el.updateComplete;

  const rootAfter = el.querySelector('lr-tree-item') as any;
  expect(rootAfter).to.equal(root, 'the same node instance should be reused, not recreated');
  expect(rootAfter.expanded).to.be.true;
});

it('reconciles added, removed, and reordered top-level items by id', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [rootNode, leafNode] = [...el.querySelectorAll('lr-tree-item')] as any[];

  el.data = [{ id: '2', label: 'Leaf' }, { id: '3', label: 'New' }, ...data.slice(0, 1)];
  await el.updateComplete;

  const nodesAfter = [...el.querySelectorAll('lr-tree-item')] as any[];
  expect(nodesAfter.map((n) => n.item.id)).to.deep.equal(['2', '3', '1']);
  expect(nodesAfter[0]).to.equal(leafNode, 'leaf node instance should be reused');
  expect(nodesAfter[2]).to.equal(rootNode, 'root node instance should be reused');
});

it('refocuses the newly active node when a data reassignment removes the node that currently holds DOM focus', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  (root as unknown as HTMLElement).focus();
  expect(deepActiveElement()).to.equal(root as unknown as Element);

  el.data = [{ id: '2', label: 'Leaf' }];
  await el.updateComplete;

  const newRoot = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  expect(newRoot.item.id).to.equal('2');
  expect(deepActiveElement()).to.equal(newRoot as unknown as Element);
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

/** Walks into shadow roots to find the actually-focused element (a focused
 *  element inside a shadow tree only surfaces as its shadow host via the
 *  plain `document.activeElement`). */
function deepActiveElement(root: Document | ShadowRoot = document): Element | null {
  const active = root.activeElement;
  return active?.shadowRoot?.activeElement ? deepActiveElement(active.shadowRoot) : active;
}

it('gives the first item a roving tabindex of 0 and every other item -1', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lr-tree-item')] as HTMLElement[];
  expect(root.tabIndex).to.equal(0);
  expect(leaf.tabIndex).to.equal(-1);
});

it('nests role="group" as a DOM descendant of its role="treeitem" host', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  root.expand();
  await root.updateComplete;
  expect(root.getAttribute('role')).to.equal('treeitem');
  expect(root.shadowRoot!.querySelector('[role="group"]')).to.exist;
});

it('ArrowDown moves the roving tabindex to the next visible item', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  expect((leaf as unknown as HTMLElement).tabIndex).to.equal(0);
  expect(deepActiveElement()).to.equal(leaf);
});

it('ArrowRight expands a collapsed node without moving focus, then a 2nd press steps into its first child', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  (root as unknown as HTMLElement).focus();

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(root.expanded).to.be.true;
  expect(deepActiveElement()).to.equal(root as unknown as Element);

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  const firstChild = root.shadowRoot!.querySelector('lr-tree-item');
  expect(deepActiveElement()).to.equal(firstChild);
});

it('Home/End jump to the first/last visible item', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(deepActiveElement()).to.equal(leaf as unknown as Element);

  leaf.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(deepActiveElement()).to.equal(root as unknown as Element);
});

it('Enter fires lr-node-select on the focused item', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  (root as unknown as HTMLElement).focus();
  setTimeout(() =>
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })),
  );
  const ev = await oneEvent(el, 'lr-node-select');
  expect(ev.detail).to.deep.equal({ id: '1' });
});

it('ArrowUp moves the roving tabindex to the previous visible item', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(deepActiveElement()).to.equal(leaf as unknown as Element);

  leaf.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(deepActiveElement()).to.equal(root as unknown as Element);
  expect((root as unknown as HTMLElement).tabIndex).to.equal(0);
  expect((leaf as unknown as HTMLElement).tabIndex).to.equal(-1);
});

it('ArrowLeft collapses an expanded node without moving focus off it', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  root.expand();
  await el.updateComplete;
  (root as unknown as HTMLElement).focus();

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
  await el.updateComplete;

  expect(root.expanded).to.be.false;
  expect(deepActiveElement()).to.equal(root as unknown as Element);
});

it('ArrowLeft on a collapsed or leaf node moves focus to its nearest ancestor', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  root.expand();
  await el.updateComplete;
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;

  const childA = root.shadowRoot!.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  expect(deepActiveElement()).to.equal(childA as unknown as Element);

  childA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
  await el.updateComplete;

  expect(deepActiveElement()).to.equal(root as unknown as Element);
  expect((root as unknown as HTMLElement).tabIndex).to.equal(0);
});

it('preserves nested per-node expanded state when a nested children array is reordered', async () => {
  const nested = [
    { id: '1', label: 'Root', children: [{ id: '1.1', label: 'A' }, { id: '1.2', label: 'B' }] },
  ];
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = nested;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  root.expand();
  await root.updateComplete;
  const childB = root.shadowRoot!.querySelectorAll('lr-tree-item')[1] as unknown as LyraTreeItem;
  childB.expanded = true;
  await root.updateComplete;

  root.item = { ...root.item, children: [nested[0].children![1], nested[0].children![0]] };
  await root.updateComplete;

  const after = [...root.shadowRoot!.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
  expect(after[0]).to.equal(childB, 'the "B" node instance should be reused after reordering');
  expect(after[0].expanded).to.be.true;
});

it('renders the toggle as an svg chevron rather than a text glyph', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as HTMLElement;
  const toggle = root.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  expect(toggle.querySelector('svg')).to.exist;
  expect(toggle.textContent?.trim()).to.equal('');
});

it('hides the toggle placeholder for a leaf node with no children', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const leaf = [...el.querySelectorAll('lr-tree-item')].find(
    (n) => (n as any).item.id === '2',
  ) as HTMLElement;
  const toggle = leaf.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  expect(toggle.hidden).to.be.true;
  expect(getComputedStyle(toggle).visibility).to.equal('hidden');
  // Still visibility, not display:none -- the box keeps its layout space so
  // this leaf row's label lines up with a sibling row that has a chevron.
  expect(getComputedStyle(toggle).display).to.not.equal('none');

  const root = el.querySelector('lr-tree-item') as HTMLElement;
  const rootToggle = root.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  expect(rootToggle.hidden).to.be.false;
  expect(getComputedStyle(rootToggle).visibility).to.equal('visible');
});

it('rotates the toggle chevron when the node is expanded', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  const toggle = root.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  expect(getComputedStyle(toggle).transform).to.equal('none');
  root.expand();
  await root.updateComplete;
  expect(getComputedStyle(toggle).transform).to.not.equal('none');
});

it('gives the toggle a touch-friendly clickable box via padding, not just a bare 1rem glyph', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as HTMLElement;
  const toggle = root.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  expect(parseFloat(getComputedStyle(toggle).paddingTop)).to.be.greaterThan(0);
  const box = toggle.getBoundingClientRect();
  expect(box.width).to.be.at.least(24); // >= 1.5rem
  expect(box.height).to.be.at.least(24);
});

it('truncates a long label instead of overflowing, and caps indentation at depth', async () => {
  const item = { id: 'deep', label: 'A very long label '.repeat(20) };
  const el = (await fixture(
    html`<lr-tree-item .item=${item} .depth=${50}></lr-tree-item>`,
  )) as LyraTreeItem;
  await el.updateComplete;

  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const labelStyle = getComputedStyle(label);
  expect(labelStyle.overflow).to.equal('hidden');
  expect(labelStyle.textOverflow).to.equal('ellipsis');
  expect(labelStyle.whiteSpace).to.equal('nowrap');
  expect(labelStyle.minWidth).to.equal('0px');

  const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  // Depth 50 would be 50rem (800px) of indent uncapped; the cap holds it at
  // 8rem plus the 0.5rem base (--lr-space-s fallback) = 8.5rem = 136px.
  expect(getComputedStyle(row).getPropertyValue('padding-inline-start')).to.equal('136px');
});

it('renders the badge with the higher-contrast text token instead of text-quiet', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as HTMLElement;
  const badge = root.shadowRoot!.querySelector('[part="badge"]') as HTMLElement;
  // --lr-color-text falls back to #1a1a1a (rgb(26, 26, 26)) with no WA
  // tokens loaded in the test env; --lr-color-text-quiet falls back to
  // #6b7280 (rgb(107, 114, 128)) — this pins the fix, not just "changed".
  expect(getComputedStyle(badge).color).to.equal('rgb(26, 26, 26)');
});

it('forwards `label` to the internal role="tree" element\'s aria-label, and omits it when unset', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[role="tree"]') as HTMLElement;
  expect(base.hasAttribute('aria-label')).to.be.false;

  el.label = 'File explorer';
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('File explorer');
});

it('sets aria-label on the internal role="tree" element from the label prop, falling back to a forwarded host aria-label', async () => {
  const el = (await fixture(
    html`<lr-tree aria-label="Forwarded label"></lr-tree>`,
  )) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[role="tree"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Forwarded label');

  el.label = 'File explorer';
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('File explorer');
});

it('sets aria-level, aria-setsize, and aria-posinset to the correct values for top-level and nested items', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];

  expect((root as unknown as HTMLElement).getAttribute('aria-level')).to.equal('1');
  expect((root as unknown as HTMLElement).getAttribute('aria-setsize')).to.equal('2');
  expect((root as unknown as HTMLElement).getAttribute('aria-posinset')).to.equal('1');
  expect((leaf as unknown as HTMLElement).getAttribute('aria-level')).to.equal('1');
  expect((leaf as unknown as HTMLElement).getAttribute('aria-setsize')).to.equal('2');
  expect((leaf as unknown as HTMLElement).getAttribute('aria-posinset')).to.equal('2');

  root.expand();
  await el.updateComplete;
  const [childA, childB] = [
    ...(root as unknown as HTMLElement).shadowRoot!.querySelectorAll('lr-tree-item'),
  ] as unknown as HTMLElement[];
  expect(childA.getAttribute('aria-level')).to.equal('2');
  expect(childA.getAttribute('aria-setsize')).to.equal('2');
  expect(childA.getAttribute('aria-posinset')).to.equal('1');
  expect(childB.getAttribute('aria-level')).to.equal('2');
  expect(childB.getAttribute('aria-setsize')).to.equal('2');
  expect(childB.getAttribute('aria-posinset')).to.equal('2');
});

it('renders a badge value of 0 instead of treating it as absent', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [{ id: '1', label: 'Root', badge: 0 }];
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as HTMLElement;
  const badge = root.shadowRoot!.querySelector('[part="badge"]');
  expect(badge).to.exist;
  expect(badge!.textContent).to.equal('0');
});

describe('tree-item badges', () => {
  const dataWithBadges: TreeItem[] = [
    {
      id: 'a',
      label: 'src/app.ts',
      badge: 3,
      badges: [
        { text: 'M', tone: 'brand', label: 'Modified' },
        { text: '+2', tone: 'success' },
      ],
    },
  ];

  it('renders no badge parts when neither badge nor badges is set', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = [{ id: 'a', label: 'no badges here' }];
    await el.updateComplete;
    const node = el.querySelector('lr-tree-item') as LyraTreeItem;
    const badgeParts = node.shadowRoot!.querySelectorAll('[part="badge"]');
    expect(badgeParts.length).to.equal(0);
  });

  it('renders badges chips with data-tone after the legacy badge', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = dataWithBadges;
    await el.updateComplete;
    const node = el.querySelector('lr-tree-item') as LyraTreeItem;
    const badgeParts = [...node.shadowRoot!.querySelectorAll('[part="badge"]')] as HTMLElement[];
    // legacy badge (3) first, then the two badges chips, in array order
    expect(badgeParts.length).to.equal(3);
    expect(badgeParts[0].textContent!.trim()).to.equal('3');
    expect(badgeParts[1].textContent!.trim()).to.equal('M');
    expect(badgeParts[1].dataset.tone).to.equal('brand');
    expect(badgeParts[2].textContent!.trim()).to.equal('+2');
    expect(badgeParts[2].dataset.tone).to.equal('success');
  });

  it('uses label as the accessible name when set, else falls back to text', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = dataWithBadges;
    await el.updateComplete;
    const node = el.querySelector('lr-tree-item') as LyraTreeItem;
    const badgeParts = [...node.shadowRoot!.querySelectorAll('[part="badge"]')] as HTMLElement[];
    expect(badgeParts[1].getAttribute('aria-label')).to.equal('Modified'); // label wins
    expect(badgeParts[2].getAttribute('aria-label')).to.equal('+2'); // falls back to text
  });

  it('defaults an unset tone to neutral', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = [{ id: 'a', label: 'x', badges: [{ text: 'U' }] }];
    await el.updateComplete;
    const node = el.querySelector('lr-tree-item') as LyraTreeItem;
    expect((node.shadowRoot!.querySelector('[part="badge"]') as HTMLElement).dataset.tone).to.equal('neutral');
  });

  it('lets each badge tone foreground and background be rethemed independently', async () => {
    const el = (await fixture(html`
      <lr-tree
        style="
          --lr-tree-badge-neutral-color: rgb(1, 2, 3);
          --lr-tree-badge-neutral-bg: rgb(4, 5, 6);
          --lr-tree-badge-brand-color: rgb(7, 8, 9);
          --lr-tree-badge-brand-bg: rgb(10, 11, 12);
          --lr-tree-badge-success-color: rgb(13, 14, 15);
          --lr-tree-badge-success-bg: rgb(16, 17, 18);
          --lr-tree-badge-warning-color: rgb(19, 20, 21);
          --lr-tree-badge-warning-bg: rgb(22, 23, 24);
          --lr-tree-badge-danger-color: rgb(25, 26, 27);
          --lr-tree-badge-danger-bg: rgb(28, 29, 30);
        "
      ></lr-tree>
    `)) as LyraTree;
    el.data = [{
      id: 'a',
      label: 'x',
      badges: [
        { text: 'N', tone: 'neutral' },
        { text: 'B', tone: 'brand' },
        { text: 'S', tone: 'success' },
        { text: 'W', tone: 'warning' },
        { text: 'D', tone: 'danger' },
      ],
    }];
    await el.updateComplete;
    const node = el.querySelector('lr-tree-item') as LyraTreeItem;
    const expected = new Map([
      ['neutral', ['rgb(1, 2, 3)', 'rgb(4, 5, 6)']],
      ['brand', ['rgb(7, 8, 9)', 'rgb(10, 11, 12)']],
      ['success', ['rgb(13, 14, 15)', 'rgb(16, 17, 18)']],
      ['warning', ['rgb(19, 20, 21)', 'rgb(22, 23, 24)']],
      ['danger', ['rgb(25, 26, 27)', 'rgb(28, 29, 30)']],
    ]);
    for (const badge of node.shadowRoot!.querySelectorAll<HTMLElement>('[part="badge"]')) {
      const colors = expected.get(badge.dataset.tone ?? '');
      expect(getComputedStyle(badge).color).to.equal(colors?.[0]);
      expect(getComputedStyle(badge).backgroundColor).to.equal(colors?.[1]);
    }
  });

  it('is accessible with badges and the legacy badge both present', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = dataWithBadges;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

it('swaps which arrow key expands/collapses under dir="rtl"', async () => {
  const el = (await fixture(html`<lr-tree dir="rtl"></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  (root as unknown as HTMLElement).focus();

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(root.expanded).to.be.true;
  expect(deepActiveElement()).to.equal(root as unknown as Element);

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(root.expanded).to.be.false;
});

it('keeps arrow-key navigation correct after a node\'s `item` is mutated directly, with no `data` reassignment or toggle event', async () => {
  const nested = [
    {
      id: 'root',
      label: 'Root',
      children: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    },
  ];
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = nested;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  root.expand();
  await el.updateComplete;
  (root as unknown as HTMLElement).focus();

  // Warm up the visible-node list by navigating into A, then B, before the
  // direct mutation below -- this is what exposes a stale memoized cache.
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  const a = root.shadowRoot!.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  expect(deepActiveElement()).to.equal(a as unknown as Element);

  (a as unknown as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }),
  );
  await el.updateComplete;
  const b = root.shadowRoot!.querySelectorAll('lr-tree-item')[1] as unknown as LyraTreeItem;
  expect(deepActiveElement()).to.equal(b as unknown as Element);

  // Legitimate direct write path (also used by this file's own
  // "reorders a nested children array" test above) -- no `data`
  // reassignment on `<lr-tree>`, no `lr-node-toggle` event.
  root.item = { ...root.item, children: [...root.item.children!, { id: 'c', label: 'C' }] };
  await root.updateComplete;

  (b as unknown as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }),
  );
  await el.updateComplete;
  const c = root.shadowRoot!.querySelectorAll('lr-tree-item')[2] as unknown as LyraTreeItem;
  expect(deepActiveElement()).to.equal(c as unknown as Element);
});

it('keeps arrow-key navigation correct after expandAll() reveals nodes that were not previously visible', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  (root as unknown as HTMLElement).focus();

  // Exercise ArrowDown/ArrowUp while still collapsed so a memoized
  // visible-node list (if any) is populated from the pre-expandAll() shape.
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(deepActiveElement()).to.equal(root as unknown as Element);

  el.expandAll();
  await el.updateComplete;

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  const childA = root.shadowRoot!.querySelector('lr-tree-item');
  expect(deepActiveElement()).to.equal(childA);
});

it('renders a structured icon and secondary description without adding another interactive row', async () => {
  const icon = html`<svg data-test-icon viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"></circle></svg>`;
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [{ id: 'rich', label: 'Judgment', icon, description: 'Grand Chamber · 2026', badge: 3 }];
  await el.updateComplete;

  const node = el.querySelector('lr-tree-item') as HTMLElement;
  const iconPart = node.shadowRoot!.querySelector('[part="icon"]')!;
  const description = node.shadowRoot!.querySelector('[part="description"]')!;

  expect(iconPart.querySelector('[data-test-icon]')).to.exist;
  expect(iconPart.getAttribute('aria-hidden')).to.equal('true');
  expect(description.textContent).to.equal('Grand Chamber · 2026');
  expect(node.shadowRoot!.querySelectorAll('[role]').length).to.equal(0);
  await expect(el).to.be.accessible();
});

it('uses accessibleLabel as the treeitem host name without changing its visible label', async () => {
  const el = (await fixture(html`<lr-tree label="Cases"></lr-tree>`)) as LyraTree;
  el.data = [
    {
      id: 'case',
      label: 'C-42/24',
      description: 'Judgment',
      accessibleLabel: 'Case C-42/24, Judgment, 3 cited decisions',
    },
  ];
  await el.updateComplete;

  const node = el.querySelector('lr-tree-item') as HTMLElement;
  expect(node.getAttribute('aria-label')).to.equal(
    'Case C-42/24, Judgment, 3 cited decisions',
  );
  expect(node.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('C-42/24');
});

it('removes a stale accessible label when reassigned row data no longer supplies one', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [{ id: 'case', label: 'Case', accessibleLabel: 'Detailed case label' }];
  await el.updateComplete;
  const node = el.querySelector('lr-tree-item') as HTMLElement;
  expect(node.getAttribute('aria-label')).to.equal('Detailed case label');

  el.data = [{ id: 'case', label: 'Case' }];
  await el.updateComplete;

  expect(node.hasAttribute('aria-label')).to.equal(false);
});

describe('reorderable', () => {
  const reorderData: TreeItem[] = [
    {
      id: '1',
      label: 'Root',
      children: [
        { id: '1.1', label: 'Child A' },
        { id: '1.2', label: 'Child B' },
        { id: '1.3', label: 'Child C' },
      ],
    },
    { id: '2', label: 'Leaf' },
  ];

  const clone = (): TreeItem[] => JSON.parse(JSON.stringify(reorderData));

  /** Dispatch a Ctrl/Cmd+Arrow keydown from a node, the way a real key press reaches
   *  `<lr-tree>`'s single delegated listener (composed + bubbling). */
  const modArrow = (
    node: Element,
    key: 'ArrowUp' | 'ArrowDown',
    modifier: 'ctrlKey' | 'metaKey' = 'ctrlKey',
  ): void => {
    node.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        composed: true,
        cancelable: true,
        [modifier]: true,
      }),
    );
  };

  const arrow = (node: Element, key: string): void => {
    node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
  };

  /** Expand the root and walk focus down to the nested child with `id`. */
  async function focusNestedChild(el: LyraTree, id: string): Promise<LyraTreeItem> {
    const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
    root.expand();
    await el.updateComplete;
    (root as unknown as HTMLElement).focus();
    let current: Element = root as unknown as Element;
    for (let i = 0; i < 8; i++) {
      const active = deepActiveElement() as unknown as LyraTreeItem | null;
      if (active?.item?.id === id) return active;
      arrow(current, 'ArrowDown');
      await el.updateComplete;
      current = deepActiveElement() as Element;
    }
    throw new Error(`could not reach node ${id}`);
  }

  it('Ctrl+ArrowDown on a focused top-level node requests a move to the next sibling slot', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
    (root as unknown as HTMLElement).focus();

    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (e) => events.push(e as CustomEvent));
    modArrow(root as unknown as Element, 'ArrowDown');
    await el.updateComplete;

    expect(events.length).to.equal(1);
    expect(events[0].detail).to.deep.equal({ id: '1', parentId: null, fromIndex: 0, toIndex: 1 });
    expect(events[0].bubbles).to.be.true;
    expect(events[0].composed).to.be.true;
  });

  it('Cmd+ArrowUp on a nested node is scoped to its own parent\'s children, reporting that parentId', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const childB = await focusNestedChild(el, '1.2');

    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (e) => events.push(e as CustomEvent));
    modArrow(childB as unknown as Element, 'ArrowUp', 'metaKey');
    await el.updateComplete;

    expect(events.length).to.equal(1);
    expect(events[0].detail).to.deep.equal({
      id: '1.2',
      parentId: '1',
      fromIndex: 1,
      toIndex: 0,
    });
  });

  it('never reparents across a subtree boundary: Ctrl+ArrowDown on the last child is a silent no-op', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const childC = await focusNestedChild(el, '1.3');

    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (e) => events.push(e as CustomEvent));
    modArrow(childC as unknown as Element, 'ArrowDown');
    await el.updateComplete;

    // '1.3' is the last child of '1'; the *visually* next row is the top-level
    // uncle '2'. A reorder must never turn into a reparent, so nothing happens.
    expect(events.length).to.equal(0);
    expect((deepActiveElement() as unknown as LyraTreeItem | null)?.item?.id).to.equal('1.3');
  });

  it('Ctrl+ArrowUp on the first sibling is a silent no-op rather than a move out of the subtree', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const childA = await focusNestedChild(el, '1.1');

    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (e) => events.push(e as CustomEvent));
    modArrow(childA as unknown as Element, 'ArrowUp');
    await el.updateComplete;

    expect(events.length).to.equal(0);
    expect((deepActiveElement() as unknown as LyraTreeItem | null)?.item?.id).to.equal('1.1');
  });

  it('with reorderable unset, Ctrl+ArrowDown never emits lr-reorder and still moves the roving tabindex', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const [root, leaf] = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
    (root as unknown as HTMLElement).focus();

    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (e) => events.push(e as CustomEvent));
    modArrow(root as unknown as Element, 'ArrowDown');
    await el.updateComplete;

    expect(events.length).to.equal(0);
    expect((deepActiveElement() as unknown as LyraTreeItem | null)?.item?.id).to.equal('2');
    expect((leaf as unknown as HTMLElement).tabIndex).to.equal(0);
    // No live region is rendered at all until the feature is opted into.
    expect(el.shadowRoot!.querySelector('lr-live-region')).to.not.exist;
    expect(el.hasAttribute('reorderable')).to.be.false;
  });

  it('reflects the reorderable attribute', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.reorderable = true;
    await el.updateComplete;
    expect(el.hasAttribute('reorderable')).to.be.true;
  });

  it('keeps focus on the moved top-level node after the host reassigns a reordered data array', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
    (root as unknown as HTMLElement).focus();

    el.addEventListener('lr-reorder', (e) => {
      const { fromIndex, toIndex } = (e as CustomEvent).detail;
      const next = [...el.data];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      el.data = next;
    });
    modArrow(root as unknown as Element, 'ArrowDown');
    await el.updateComplete;

    const ids = [...el.querySelectorAll('lr-tree-item')].map(
      (n) => (n as unknown as LyraTreeItem).item.id,
    );
    expect(ids).to.deep.equal(['2', '1']);
    // `syncNodes()` re-inserts the moved element, which drops real DOM focus to
    // <body>; the moved node must get it back, and keep the roving tabindex.
    expect((deepActiveElement() as unknown as LyraTreeItem | null)?.item?.id).to.equal('1');
    expect((root as unknown as HTMLElement).tabIndex).to.equal(0);
  });

  it('keeps focus on the moved nested node after the host reassigns a reordered data array', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const childA = await focusNestedChild(el, '1.1');

    el.addEventListener('lr-reorder', (e) => {
      const { parentId, fromIndex, toIndex } = (e as CustomEvent).detail;
      const next = JSON.parse(JSON.stringify(el.data)) as TreeItem[];
      const parent = next.find((item) => item.id === parentId)!;
      const children = parent.children!;
      const [moved] = children.splice(fromIndex, 1);
      children.splice(toIndex, 0, moved);
      el.data = next;
    });
    modArrow(childA as unknown as Element, 'ArrowDown');
    await el.updateComplete;

    const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
    const childIds = [...root.shadowRoot!.querySelectorAll('lr-tree-item')].map(
      (n) => (n as unknown as LyraTreeItem).item.id,
    );
    expect(childIds).to.deep.equal(['1.2', '1.1', '1.3']);
    expect((deepActiveElement() as unknown as LyraTreeItem | null)?.item?.id).to.equal('1.1');
  });

  it('does not swap the vertical reorder keys under dir="rtl"', async () => {
    const el = (await fixture(html`<lr-tree dir="rtl" reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const [root, leaf] = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
    (root as unknown as HTMLElement).focus();

    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (e) => events.push(e as CustomEvent));

    // ArrowUp/ArrowDown are not direction-sensitive: "down" always means later
    // in the sibling list, in both LTR and RTL.
    modArrow(root as unknown as Element, 'ArrowDown');
    await el.updateComplete;
    expect(events[0].detail).to.deep.equal({ id: '1', parentId: null, fromIndex: 0, toIndex: 1 });

    (leaf as unknown as HTMLElement).focus();
    arrow(root as unknown as Element, 'End');
    await el.updateComplete;
    modArrow(leaf as unknown as Element, 'ArrowUp');
    await el.updateComplete;
    expect(events[1].detail).to.deep.equal({ id: '2', parentId: null, fromIndex: 1, toIndex: 0 });
    expect(events.length).to.equal(2);
  });

  it('announces the requested move through an internal live region', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    expect(region, 'a reorderable tree renders a live region').to.exist;
    await region.updateComplete;

    const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
    (root as unknown as HTMLElement).focus();
    modArrow(root as unknown as Element, 'ArrowDown');
    await el.updateComplete;

    const text = region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
    expect(text).to.contain('Root');
    expect(text).to.contain('2');
  });

  it('honors a .strings override for the treeNodeMoved announcement', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.strings = { treeNodeMoved: 'Déplacé {label} en position {index} sur {total}' };
    el.data = clone();
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await region.updateComplete;

    const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
    (root as unknown as HTMLElement).focus();
    modArrow(root as unknown as Element, 'ArrowDown');
    await el.updateComplete;

    const text = region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
    expect(text).to.contain('Déplacé Root en position 2 sur 2');
  });

  it('is accessible in the populated reorderable state', async () => {
    const el = (await fixture(
      html`<lr-tree reorderable label="Reorderable tree"></lr-tree>`,
    )) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    await el.expandAll();
    await expect(el).to.be.accessible();
  });
  it('formats reorder-announcement numbers with the effective locale', async () => {
    // `localize()` interpolates with a bare `String(value)` -- it does no number formatting. A raw
    // `index + 1` therefore renders Western digits inside an otherwise fully-translated sentence,
    // so under a locale with its own numbering system the announcement mixes two digit sets.
    const el = (await fixture(html`<lr-tree reorderable lang="ar-u-nu-arab"></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const child = await focusNestedChild(el, '1.2');

    modArrow(child as unknown as Element, 'ArrowUp', 'metaKey');
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    const live = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement | null;
    const announced = (live?.shadowRoot?.textContent ?? '') + (live?.textContent ?? '');
    expect(announced.trim(), 'an announcement was made').to.not.equal('');
    expect(announced, 'announcement should use Arabic-Indic digits').to.match(/[\u0660-\u0669]/);
  });
});

it("survives keyboard navigation over slotted tree-items that carry no item", async () => {
  // `<lr-tree>`'s documented slot takes `<lr-tree-item>` elements, and `item` is `attribute: false`
  // -- so any consumer writing the tree declaratively in HTML necessarily gets nodes whose `item`
  // is undefined. `visibleNodeElements()` already guards with `n.item?.disabled`, but the keyboard
  // handler and `focusNode()` read `n.item.id` bare, throwing a TypeError on the first arrow key.
  const el = (await fixture(html`
    <lr-tree>
      <lr-tree-item>Alpha</lr-tree-item>
      <lr-tree-item>Beta</lr-tree-item>
    </lr-tree>
  `)) as LyraTree;
  await el.updateComplete;

  const base = el.shadowRoot!.querySelector('[part="base"]') ?? el;
  const press = (key: string) =>
    base.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, composed: true }));

  expect(() => press("ArrowDown")).to.not.throw();
  expect(() => press("ArrowUp")).to.not.throw();
  expect(() => press("Home")).to.not.throw();
  expect(() => press("End")).to.not.throw();
});

// The declarative child model end to end. A `wa-tree`/`sl-tree` app migrates by renaming tags only,
// so this markup shape -- no `data` property anywhere -- has to be a working tree: rendered rows,
// no empty state, a roving tabindex, arrow navigation and correct set-position ARIA.
describe('tree declarative child model', () => {
  const declarative = html`
    <lr-tree label="Docs">
      <lr-tree-item label="Guides">
        <lr-tree-item label="Install"></lr-tree-item>
        <lr-tree-item label="Usage"></lr-tree-item>
      </lr-tree-item>
      <lr-tree-item label="Reference"></lr-tree-item>
    </lr-tree>
  `;

  const press = (el: LyraTree, key: string): void => {
    const base = el.shadowRoot!.querySelector('[part="base"]') ?? el;
    base.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
  };

  it('renders slotted items instead of the empty state, with no data assigned', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    await el.updateComplete;

    // Never hand chai a DOM node as actual/expected -- compare a boolean instead.
    expect(el.shadowRoot!.querySelector('lr-empty') === null, 'no empty state while items are slotted').to.be
      .true;
    const [guides, reference] = [...el.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];
    expect(guides!.getAttribute('aria-level')).to.equal('1');
    expect(guides!.getAttribute('aria-setsize')).to.equal('2');
    expect(guides!.getAttribute('aria-posinset')).to.equal('1');
    expect(reference!.getAttribute('aria-posinset')).to.equal('2');
    expect(guides!.tabIndex, 'the first slotted item owns the roving tabindex').to.equal(0);
    expect(reference!.tabIndex).to.equal(-1);
  });

  it('gives nested slotted items their own depth and set-position ARIA once expanded', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    const guides = el.querySelector('lr-tree-item') as LyraTreeItem;
    guides.expand();
    await el.updateComplete;

    const [install, usage] = [...guides.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];
    expect(install!.depth).to.equal(1);
    expect(install!.getAttribute('aria-level')).to.equal('2');
    expect(install!.getAttribute('aria-setsize')).to.equal('2');
    expect(usage!.getAttribute('aria-posinset')).to.equal('2');
  });

  it('navigates slotted items with the arrow keys, stepping into an expanded branch', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    await el.updateComplete;
    const [guides, reference] = [...el.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];

    press(el, 'ArrowRight'); // expand, focus stays put
    await el.updateComplete;
    expect(guides!.expanded).to.be.true;

    press(el, 'ArrowDown'); // step into the first child
    await el.updateComplete;
    const install = guides!.querySelector('lr-tree-item') as LyraTreeItem;
    expect(install.tabIndex).to.equal(0);
    expect(guides!.tabIndex).to.equal(-1);

    press(el, 'End');
    await el.updateComplete;
    expect(reference!.tabIndex).to.equal(0);
  });

  it('expandAll()/collapseAll() reach slotted descendants', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    const guides = el.querySelector('lr-tree-item') as LyraTreeItem;
    await el.expandAll();
    expect(guides.expanded).to.be.true;
    el.collapseAll();
    await el.updateComplete;
    expect(guides.expanded).to.be.false;
  });

  it('skips a disabled slotted item in roving focus and arrow navigation', async () => {
    const el = (await fixture(html`
      <lr-tree label="Docs">
        <lr-tree-item label="Disabled" disabled></lr-tree-item>
        <lr-tree-item label="First enabled"></lr-tree-item>
        <lr-tree-item label="Second enabled"></lr-tree-item>
      </lr-tree>
    `)) as LyraTree;
    await el.updateComplete;
    const [disabled, first, second] = [...el.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];

    expect(disabled!.getAttribute('aria-disabled')).to.equal('true');
    expect(disabled!.tabIndex).to.equal(-1);
    expect(first!.tabIndex, 'the roving stop skips past the disabled item').to.equal(0);

    press(el, 'ArrowDown');
    await el.updateComplete;
    expect(second!.tabIndex).to.equal(0);
    press(el, 'Home');
    await el.updateComplete;
    expect(first!.tabIndex, 'Home lands on the first *enabled* item').to.equal(0);
  });

  it('ignores data while author-written items are present', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    await el.updateComplete;
    el.data = [{ id: 'from-data', label: 'From data' }];
    await el.updateComplete;

    const tops = [...el.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];
    expect(tops.map((node) => node.label)).to.eql(['Guides', 'Reference']);
    expect(el.shadowRoot!.querySelector('lr-empty') === null, 'still no empty state').to.be.true;
  });

  it('re-homes the roving tabindex when the active slotted item is removed', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    await el.updateComplete;
    const [guides, reference] = [...el.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];
    expect(guides!.tabIndex).to.equal(0);

    guides!.remove();
    await new Promise((resolve) => setTimeout(resolve, 0)); // let slotchange land
    await el.updateComplete;
    expect(reference!.tabIndex, 'the surviving item must keep the tree in the tab order').to.equal(0);
  });

  it('requests a sibling-scoped reorder for a nested slotted item', async () => {
    const el = (await fixture(html`
      <lr-tree label="Docs" reorderable>
        <lr-tree-item label="Guides" expanded>
          <lr-tree-item label="Install"></lr-tree-item>
          <lr-tree-item label="Usage"></lr-tree-item>
        </lr-tree-item>
      </lr-tree>
    `)) as LyraTree;
    await el.updateComplete;
    const guides = el.querySelector('lr-tree-item') as LyraTreeItem;
    const [install] = [...guides.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];
    install!.focus();
    install!.select();
    await el.updateComplete;

    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (e) => events.push(e as CustomEvent));
    install!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, ctrlKey: true }),
    );
    await el.updateComplete;

    expect(events.length).to.equal(1);
    expect(events[0]!.detail).to.deep.equal({
      id: install!.nodeId,
      parentId: guides.nodeId,
      fromIndex: 0,
      toIndex: 1,
    });
  });

  it('renders a nested item that a host promotes to the top level', async () => {
    // Its former parent gave it slot="children"; <lr-tree> only has a default slot, so a stale
    // `slot` would leave the promoted node assigned to nothing and rendering nowhere.
    const el = (await fixture(declarative)) as LyraTree;
    const guides = el.querySelector('lr-tree-item') as LyraTreeItem;
    guides.expand();
    await el.updateComplete;
    const install = guides.querySelector('lr-tree-item') as LyraTreeItem;
    expect(install.getAttribute('slot')).to.equal('children');

    el.appendChild(install);
    await new Promise((resolve) => setTimeout(resolve, 0)); // let slotchange land
    await el.updateComplete;

    expect(install.hasAttribute('slot'), 'the stale slot must be cleared').to.be.false;
    expect(install.assignedSlot === null, 'it must be assigned to the default slot').to.be.false;
    expect(install.getAttribute('aria-level')).to.equal('1');
    expect(install.getAttribute('aria-posinset')).to.equal('3');
  });

  it('still tracks new items after being disconnected and reconnected', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    await el.updateComplete;
    const parent = el.parentElement!;
    el.remove();
    parent.appendChild(el);
    await el.updateComplete;

    const added = document.createElement('lr-tree-item') as LyraTreeItem;
    added.label = 'Appendix';
    el.appendChild(added);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;

    expect(added.getAttribute('aria-posinset')).to.equal('3');
    expect(added.getAttribute('aria-setsize')).to.equal('3');
  });

  it('is accessible when written declaratively', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    await el.expandAll();
    await expect(el).to.be.accessible();
  });
});
