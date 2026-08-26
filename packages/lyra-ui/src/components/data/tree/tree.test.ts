import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './tree.js';
import type { LyraTree, LyraTreeNodeData } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';

interface TreeTestAccess {
  activeId: string | null;
}

function required<T>(value: T | null | undefined, context: string): T {
  if (value == null) throw new Error(`Missing ${context}`);
  return value;
}

function access(tree: LyraTree): TreeTestAccess {
  return tree as unknown as TreeTestAccess;
}

const data = [
  {
    id: '1',
    label: 'Root',
    badges: [{ text: '2' }],
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
  const items = [...el.querySelectorAll('lr-tree-item')] as LyraTreeItem[];
  const loading = required(items[0], 'loading tree item');
  const selected = required(items[1], 'selected tree item');
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

it('forwards host click to row selection exactly once and keeps disabled hosts inert', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [
    { id: 'enabled', label: 'Enabled' },
    { id: 'disabled', label: 'Disabled', disabled: true },
  ];
  await el.updateComplete;
  const [enabled, disabled] = [...el.querySelectorAll('lr-tree-item')] as LyraTreeItem[];
  const ids: string[] = [];
  el.addEventListener('lr-node-select', (event) => ids.push(event.detail.nodeId));

  enabled!.click();
  disabled!.click();

  expect(ids).to.deep.equal(['enabled']);
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
  const items = [...el.querySelectorAll<HTMLElement>('lr-tree-item')];
  const disabled = required(items[0], 'disabled branch');
  const visible = required(items[1], 'visible tree item');

  expect(disabled.tabIndex).to.equal(-1);
  expect(visible.tabIndex).to.equal(0);
});

it('omits blank and later duplicate data ids before rendering', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [
    { id: ' ', label: 'Blank row' },
    { id: 'duplicate', label: 'Canonical row' },
    { id: 'duplicate', label: 'Conflicting row' },
  ];
  await el.updateComplete;
  const rendered = [...el.querySelectorAll('lr-tree-item')] as LyraTreeItem[];
  expect(rendered.length).to.equal(1);
  const canonical = required(rendered[0], 'canonical rendered row');
  expect(required(canonical.item, 'canonical row data').label).to.equal('Canonical row');
  expect(canonical.tabIndex).to.equal(0);
});

it('omits later duplicate ids across nested paths and releases identity after refresh', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [
    {
      id: 'root',
      label: 'Root',
      children: [
        { id: 'shared', label: 'Canonical nested row' },
        { id: 'shared', label: 'Conflicting nested row' },
      ],
    },
    { id: 'shared', label: 'Conflicting top-level row' },
  ];
  await el.updateComplete;
  const root = required(
    ([...el.querySelectorAll('lr-tree-item')] as LyraTreeItem[])[0],
    'root tree item',
  );
  root.expand();
  await el.updateComplete;
  const nested = [...root.shadowRoot!.querySelectorAll('lr-tree-item')] as LyraTreeItem[];

  expect(nested.length).to.equal(1);
  expect(required(required(nested[0], 'canonical nested row').item, 'canonical nested row data').label).to.equal(
    'Canonical nested row',
  );

  let selectEvents = 0;
  el.addEventListener('lr-node-select', () => selectEvents++);
  required(nested[0], 'canonical nested row').select();
  await el.updateComplete;
  expect(selectEvents).to.equal(1);
  expect(el.selectedItems.map((node) => node.item?.label)).to.deep.equal(['Canonical nested row']);

  el.data = [{ id: 'shared', label: 'Unique survivor' }];
  await el.updateComplete;
  const survivor = el.querySelector('lr-tree-item') as LyraTreeItem;
  expect(required(survivor.item, 'surviving row data').label).to.equal('Unique survivor');
  expect(survivor.getAttribute('aria-disabled')).to.equal('false');
  expect(survivor.tabIndex).to.equal(0);
});

it('stops rendering a cyclic item graph instead of recursing indefinitely', async () => {
  const cyclic: { id: string; label: string; children?: unknown[] } = { id: 'cycle', label: 'Cycle' };
  cyclic.children = [cyclic];
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [cyclic as unknown as LyraTreeNodeData];
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as LyraTreeItem;

  root.expand();
  await root.updateComplete;
  expect(root.shadowRoot!.querySelector('lr-tree-item') === null).to.be.true;
});

it('lazily projects and bounds a valid extremely deep hierarchy', async () => {
  let item: LyraTreeNodeData = { id: 'leaf', label: 'Leaf' };
  for (let depth = 5000; depth > 0; depth--) {
    item = { id: `level-${depth}`, label: `Level ${depth}`, children: [item] };
  }
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [item];
  await el.updateComplete;

  expect(el.dataTruncated).to.be.true;
  expect((el.querySelector('lr-tree-item') as LyraTreeItem).getChildrenItems()).to.have.length(0);
  el.style.setProperty('--show-duration', '0ms');
  await el.expandAll();

  let renderedDepth = 0;
  let current = el.querySelector('lr-tree-item') as LyraTreeItem | null;
  while (current) {
    renderedDepth++;
    current = current.shadowRoot?.querySelector('lr-tree-item') as LyraTreeItem | null;
  }
  expect(renderedDepth).to.be.greaterThan(1);
  expect(renderedDepth).to.be.at.most(65);
});

it('bounds a 10,000-level declarative traversal without recursive stack growth', () => {
  const el = document.createElement('lr-tree') as LyraTree;
  let parent: HTMLElement = el;
  for (let depth = 0; depth < 10_000; depth++) {
    const child = document.createElement('lr-tree-item') as LyraTreeItem;
    child.label = `Level ${depth}`;
    child.selected = true;
    parent.append(child);
    parent = child;
  }

  expect(() => el.selectedItems).to.not.throw();
  expect(el.selectedItems.length, 'only levels 0 through 64 enter controller work').to.equal(65);
});

it('bounds an oversized root collection before mounting any generated items', () => {
  const el = document.createElement('lr-tree') as LyraTree;
  el.data = Array.from({ length: 1_001 }, (_, index) => ({
    id: `root-${index}`,
    label: `Root ${index}`,
  }));

  expect(el.data).to.have.length(1_000);
  expect(el.dataTruncated).to.be.true;
  expect(el.childElementCount).to.equal(0);
});

it('terminates a disconnected authored traversal when a malformed child API creates a cycle', () => {
  const el = document.createElement('lr-tree') as LyraTree;
  const item = document.createElement('lr-tree-item') as LyraTreeItem;
  item.selected = true;
  item.childItems = () => [item];
  el.append(item);

  expect(el.selectedItems).to.deep.equal([item]);
});

it('installs a recursively frozen snapshot and never invokes caller accessors', async () => {
  const child = { id: 'child', label: 'Original child' };
  const badges = [{ text: '1', label: 'One' }];
  const input: Array<{
    id: string;
    label: string;
    children: Array<{ id: string; label: string }>;
    badges: Array<{ text: string; label: string }>;
  }> = [{ id: 'root', label: 'Original root', children: [child], badges }];
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = input;

  input[0]!.label = 'Mutated root';
  child.label = 'Mutated child';
  badges[0]!.text = '99';
  input.push({ id: 'later', label: 'Later', children: [], badges: [] });
  await el.updateComplete;

  expect(el.data.map((entry) => entry.label)).to.deep.equal(['Original root']);
  expect(el.data[0]!.children![0]!.label).to.equal('Original child');
  expect(el.data[0]!.badges![0]!.text).to.equal('1');
  expect(Object.isFrozen(el.data)).to.be.true;
  expect(Object.isFrozen(el.data[0])).to.be.true;
  expect(Object.isFrozen(el.data[0]!.children)).to.be.true;
  expect(Object.isFrozen(el.data[0]!.children![0])).to.be.true;
  expect(Object.isFrozen(el.data[0]!.badges)).to.be.true;
  expect(Object.isFrozen(el.data[0]!.badges![0])).to.be.true;

  let getterReads = 0;
  const hostile = Object.defineProperty({ id: 'hostile' }, 'label', {
    enumerable: true,
    get() {
      getterReads++;
      return 'Do not read';
    },
  });
  el.data = [hostile as unknown as LyraTreeNodeData];
  await el.updateComplete;
  expect(getterReads).to.equal(0);
  expect(el.data).to.deep.equal([]);
  expect(el.dataTruncated).to.be.true;
});

it('caps total data work, keeps collapsed descendants unmounted, and preserves declared set size', async () => {
  const children = Array.from({ length: 2_000 }, (_, index) => ({
    id: `child-${index}`,
    label: `Child ${index}`,
  }));
  const el = (await fixture(html`<lr-tree style="--show-duration:0ms"></lr-tree>`)) as LyraTree;
  el.data = [{ id: 'root', label: 'Root', children }];
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as LyraTreeItem;

  expect(el.dataTruncated).to.be.true;
  expect(el.data[0]!.children).to.have.length(999);
  expect(root.childItems()).to.have.length(0);

  root.expand();
  await el.updateComplete;
  const rendered = root.childItems();
  expect(rendered).to.have.length(999);
  expect(rendered[0]!.getAttribute('aria-setsize')).to.equal('2000');
});

it('mirrors the collapsed disclosure chevron under RTL while keeping expanded chevrons downward', async () => {
  // Reads real computed transforms off rendered nodes instead of substring-matching the exported
  // stylesheet source, which would still pass even if a selector typo left the rule dead.
  const branch: LyraTreeNodeData = { id: 'branch', label: 'Branch', children: [{ id: 'leaf', label: 'Leaf' }] };

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
  expect(ev.detail).to.deep.equal({ nodeId: '1', expanded: true });
});

it('emits lr-node-select when a node label is activated', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const leaf = required(
    ([...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[]).find(
      (node) => node.item?.id === '2',
    ),
    'leaf tree item',
  );
  const label = leaf.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  setTimeout(() => label.click());
  const ev = await oneEvent(el, 'lr-node-select');
  expect(ev.detail).to.deep.equal({ nodeId: '2' });
});

it('moves real DOM focus to a node when its row (not just the label text) is clicked', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const leaf = required(
    ([...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[]).find(
      (node) => node.item?.id === '2',
    ),
    'leaf tree item',
  );
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

  expect((deepActiveElement()) === (root as unknown as Element)).to.equal(true);
});

it('a mouse click on a node\'s toggle syncs activeId to that node, not just the previously-focused item', async () => {
  const nested = [
    { id: 'x', label: 'X', children: [{ id: 'x.1', label: 'X1' }] },
    { id: 'y', label: 'Y', children: [{ id: 'y.1', label: 'Y1' }] },
  ];
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = nested;
  await el.updateComplete;
  const items = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
  const x = required(items[0], 'first branch');
  const y = required(items[1], 'second branch');
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
  expect((deepActiveElement()) === (y1)).to.equal(true);
});

it('a mouse click that collapses an expanded ancestor of the active node leaves exactly one node with a roving tabindex of 0', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const items = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
  const root = required(items[0], 'root tree item');
  const leaf = required(items[1], 'leaf tree item');

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
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  expect(root.expanded).to.be.true;
  await el.collapseAll();
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
  const items = [...el.querySelectorAll('lr-tree-item')] as LyraTreeItem[];
  const disabled = required(items[0], 'disabled branch');
  const visible = required(items[1], 'visible tree item');

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
  await el.collapseAll();
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

  const items = [...el.querySelectorAll('lr-tree-item')] as LyraTreeItem[];
  const branchAfter = required(items[0], 'updated branch');
  const visible = required(items[1], 'visible tree item');
  expect((branchAfter) === (branch)).to.equal(true);
  expect(branchAfter.expanded).to.be.false;
  expect((branchAfter.shadowRoot!.querySelector('[part="group"]')) === null).to.be.true;
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
  const leaf = required(
    ([...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[]).find(
      (node) => node.item?.id === '2',
    ),
    'leaf tree item',
  );

  await el.expandAll();

  expect(leaf.expanded).to.be.false;
  expect((leaf as unknown as HTMLElement).hasAttribute('expanded')).to.be.false;

  await el.collapseAll();
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

  expect((request.detail.item) === (lazy)).to.equal(true);
  expect(Object.isFrozen(request.detail)).to.equal(true);
  expect(lazy.loading, 'expandAll() must trigger beginLazyLoad() exactly like a click-driven expand() does').to.be
    .true;
  expect(lazy.expanded, 'a lazy node must not report expanded until its children actually arrive').to.be.false;
});

it('collapseAll() leaves exactly one node with a roving tabindex of 0 after the active item was a nested descendant', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const items = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
  const root = required(items[0], 'root tree item');
  const leaf = required(items[1], 'leaf tree item');

  root.expand();
  await el.updateComplete;
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  const childA = root.shadowRoot!.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  expect((childA as unknown as HTMLElement).tabIndex).to.equal(0);

  await el.collapseAll();
  await el.updateComplete;

  expect(root.expanded).to.be.false;
  const tabbable = [root, leaf].filter((n) => (n as unknown as HTMLElement).tabIndex === 0);
  expect(tabbable.length).to.equal(1);
});

it('preserves per-node expanded state when data is reassigned a new array with the same ids', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  root.expanded = true;
  await el.updateComplete;

  // Simulate a re-fetch producing a brand-new array reference with identical ids/labels.
  el.data = JSON.parse(JSON.stringify(data));
  await el.updateComplete;

  const rootAfter = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  expect((rootAfter) === (root)).to.equal(true, 'the same node instance should be reused, not recreated');
  expect(rootAfter.expanded).to.be.true;
});

it('reconciles added, removed, and reordered top-level items by id', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const originalNodes = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
  const rootNode = required(originalNodes[0], 'original root tree item');
  const leafNode = required(originalNodes[1], 'original leaf tree item');

  el.data = [{ id: '2', label: 'Leaf' }, { id: '3', label: 'New' }, ...data.slice(0, 1)];
  await el.updateComplete;

  const nodesAfter = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
  expect(nodesAfter.map((node) => node.item?.id)).to.deep.equal(['2', '3', '1']);
  expect(nodesAfter[0] === leafNode, 'leaf node instance should be reused').to.equal(true);
  expect(nodesAfter[2] === rootNode, 'root node instance should be reused').to.equal(true);
});

it('refocuses the newly active node when a data reassignment removes the node that currently holds DOM focus', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  (root as unknown as HTMLElement).focus();
  expect((deepActiveElement()) === (root as unknown as Element)).to.equal(true);

  el.data = [{ id: '2', label: 'Leaf' }];
  await el.updateComplete;

  const newRoot = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  expect(required(newRoot.item, 'new root row data').id).to.equal('2');
  expect((deepActiveElement()) === (newRoot as unknown as Element)).to.equal(true);
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

it('normalizeTreeData: skips a node whose id property read throws (hostile Proxy) without crashing', async () => {
  const hostileNode = new Proxy(
    { label: 'Hostile' },
    {
      getOwnPropertyDescriptor(target, prop) {
        if (prop === 'id') throw new Error('hostile id read');
        return Object.getOwnPropertyDescriptor(target, prop);
      },
    },
  );
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [hostileNode, { id: 'valid', label: 'Valid' }] as never;
  await el.updateComplete;
  expect(el.data.map((n) => n.id)).to.deep.equal(['valid']);
});

it('normalizeTreeData: treats an unreadable children.length as zero (hostile Proxy) without crashing', async () => {
  const hostileChildren = new Proxy([{ id: 'inner', label: 'Inner' }], {
    get(target, prop, receiver) {
      if (prop === 'length') throw new Error('hostile length');
      return Reflect.get(target, prop, receiver);
    },
  });
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [{ id: 'parent', label: 'Parent', children: hostileChildren as never }];
  await el.updateComplete;
  const parent = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  expect(parent.hasChildren).to.equal(false);
});

it('data setter: normalizes a non-array value to an empty tree instead of throwing', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = { not: 'an array' } as never;
  await el.updateComplete;
  expect(el.data).to.deep.equal([]);
  expect(el.querySelectorAll('lr-tree-item').length).to.equal(0);
});

it('data setter: skips a null/array-shaped node entry, keeping valid neighbors', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [null, [1, 2, 3], { id: 'valid', label: 'Valid' }] as never;
  await el.updateComplete;
  expect(el.data.map((n) => n.id)).to.deep.equal(['valid']);
});

it('leaf-multiple selection: treats a branch whose every child is disabled as unselected (no enabled leaves to derive from)', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.selection = 'leaf-multiple';
  el.data = [
    {
      id: 'p',
      label: 'Parent',
      children: [
        { id: 'c1', label: 'Child 1', disabled: true },
        { id: 'c2', label: 'Child 2', disabled: true },
      ],
    },
  ];
  await el.updateComplete;
  const parent = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  expect(parent.selected).to.equal(false);
});

it('resets activeId away from a node whose ancestor is disabled, even though the node itself is not (isEnabledReachableId)', async () => {
  const el = (await fixture(
    html`<lr-tree
      .activeId=${'child'}
      .data=${[
        { id: 'parent', label: 'Parent', disabled: true, children: [{ id: 'child', label: 'Child' }] },
        { id: 'other', label: 'Other' },
      ]}
    ></lr-tree>`,
  )) as LyraTree;
  await el.updateComplete;
  expect(access(el).activeId).to.equal('other');
});

it('onKeyDown: ignores an unhandled key without side effects', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  (root as unknown as HTMLElement).focus();
  const internals = access(el);
  const activeBefore = internals.activeId;
  const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true, cancelable: true });
  root.dispatchEvent(event);
  await el.updateComplete;
  expect(event.defaultPrevented).to.equal(false);
  expect(internals.activeId).to.equal(activeBefore);
});

it('collapseAll() resets activeId to the first enabled root when the active node was a nested descendant', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
  root.expand();
  await el.updateComplete;
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(access(el).activeId).to.equal('1.1');

  await el.collapseAll();
  await el.updateComplete;
  expect(access(el).activeId).to.equal('1');
});

it('collapseAll() resets a dangling/non-existent activeId to the first enabled root', async () => {
  // Unlike a nested descendant's ancestor collapsing (resynced via that node's own collapse()
  // emitting lr-node-toggle -> onNodeActivate), a dangling id matches no real node, so nothing
  // emits an event to resync it -- collapseAll()'s own explicit activeTopLevel fallback is the
  // only thing that can recover it.
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const internals = access(el);
  internals.activeId = 'does-not-exist';
  await el.updateComplete;

  await el.collapseAll();
  await el.updateComplete;
  expect(internals.activeId).to.equal('1');
});

describe('explicitly empty host aria-label', () => {
  it('lets the host aria-label win over the label property, including an explicitly empty one', async () => {
    const explicit = (await fixture(
      html`<lr-tree label="Files" aria-label="" .data=${data}></lr-tree>`,
    )) as LyraTree;
    await explicit.updateComplete;
    const base = explicit.shadowRoot!.querySelector('[part~="tree"]')!;
    expect(base.hasAttribute('aria-label')).to.equal(true);
    expect(base.getAttribute('aria-label')).to.equal('');

    const authored = (await fixture(
      html`<lr-tree label="Files" aria-label="Project files" .data=${data}></lr-tree>`,
    )) as LyraTree;
    await authored.updateComplete;
    expect(authored.shadowRoot!.querySelector('[part~="tree"]')!.getAttribute('aria-label')).to.equal(
      'Project files',
    );

    const omitted = (await fixture(html`<lr-tree label="Files" .data=${data}></lr-tree>`)) as LyraTree;
    await omitted.updateComplete;
    expect(omitted.shadowRoot!.querySelector('[part~="tree"]')!.getAttribute('aria-label')).to.equal('Files');
  });
});
