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

  // Data-backed descendants render while collapsed, and updateComplete already waits through the
  // bounded descendant chain. Expanding every level here would only repeat those cascading waits.

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
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
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

it('expandAll() routes a lazy node through the same lazy-load path expand() uses, instead of marking it expanded with nothing ever requested', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [{ id: 'lazy', label: 'Lazy', lazy: true }];
  await el.updateComplete;
  const lazy = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  const requested = oneEvent(el, 'lr-lazy-load');

  await el.expandAll();
  const request = await requested;

  expect(request.detail.item).to.equal(lazy);
  expect(lazy.loading, 'expandAll() must trigger beginLazyLoad() exactly like a click-driven expand() does').to.be
    .true;
  expect(lazy.expanded, 'a lazy node must not report expanded until its children actually arrive').to.be.false;
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
