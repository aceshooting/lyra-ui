import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './tree.js';
import type { LyraTree, TreeItem } from './tree.js';
import type { LyraTreeNode } from './tree-node.js';
import { styles as treeNodeStyles } from './tree-node.styles.js';

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

it('mirrors the collapsed disclosure chevron under RTL while keeping expanded chevrons downward', () => {
  const css = treeNodeStyles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include(":host(:dir(rtl)) [part='toggle'] { transform: rotate(180deg);");
  expect(css).to.include(":host([expanded]:dir(rtl)) [part='toggle'] { transform: rotate(90deg);");
});

it('renders top-level treeitems with a tree role', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[role="tree"]')).to.exist;
  const items = el.querySelectorAll('lr-tree-node');
  expect(items.length).to.equal(2);
});

it('emits lr-node-toggle when a parent node is expanded', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-node') as HTMLElement;
  const toggle = root.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  setTimeout(() => toggle.click());
  const ev = await oneEvent(el, 'lr-node-toggle');
  expect(ev.detail).to.deep.equal({ id: '1', expanded: true });
});

it('emits lr-node-select when a node label is activated', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const leaf = [...el.querySelectorAll('lr-tree-node')].find(
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
  const leaf = [...el.querySelectorAll('lr-tree-node')].find(
    (n) => (n as unknown as LyraTreeNode).item.id === '2',
  ) as unknown as LyraTreeNode;
  const row = (leaf as unknown as HTMLElement).shadowRoot!.querySelector('[part="row"]') as HTMLElement;

  row.click();
  await el.updateComplete;

  expect(deepActiveElement() === (leaf as unknown as Element)).to.equal(true);
});

it('a click on the toggle button does not also fire lr-node-select via bubbling into the row', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-node') as unknown as LyraTreeNode;
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
  const root = el.querySelector('lr-tree-node') as unknown as LyraTreeNode;
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
  const [x, y] = [...el.querySelectorAll('lr-tree-node')] as unknown as LyraTreeNode[];
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
  const y1 = y.shadowRoot!.querySelector('lr-tree-node');
  expect(deepActiveElement()).to.equal(y1);
});

it('a mouse click that collapses an expanded ancestor of the active node leaves exactly one node with a roving tabindex of 0', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lr-tree-node')] as unknown as LyraTreeNode[];

  root.expand();
  await el.updateComplete;
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;

  const childA = root.shadowRoot!.querySelector('lr-tree-node') as unknown as LyraTreeNode;
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
  const root = el.querySelector('lr-tree-node') as any;
  expect(root.expanded).to.be.true;
  el.collapseAll();
  await el.updateComplete;
  expect(root.expanded).to.be.false;
});

it('expandAll() does not mark leaf nodes as expanded, so a following collapseAll() can still reset every parent', async () => {
  const withLeaf = [
    { id: '1', label: 'Root', children: [{ id: '1.1', label: 'Child' }] },
    { id: '2', label: 'Leaf' },
  ];
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = withLeaf;
  await el.updateComplete;
  const leaf = [...el.querySelectorAll('lr-tree-node')].find(
    (n) => (n as any).item.id === '2',
  ) as unknown as LyraTreeNode;

  await el.expandAll();

  expect(leaf.expanded).to.be.false;
  expect((leaf as unknown as HTMLElement).hasAttribute('expanded')).to.be.false;

  el.collapseAll();
  await el.updateComplete;
  const root = el.querySelector('lr-tree-node') as unknown as LyraTreeNode;
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

  const root = el.querySelector('lr-tree-node') as unknown as LyraTreeNode;
  expect(root.expanded).to.be.true;
  const child = (root as unknown as HTMLElement).shadowRoot!.querySelector(
    'lr-tree-node',
  ) as unknown as LyraTreeNode;
  expect(child, 'the first-level child should already be rendered').to.exist;
  expect(child.expanded).to.be.true;
  const grandchild = (child as unknown as HTMLElement).shadowRoot!.querySelector('lr-tree-node');
  expect(grandchild, 'the second-level grandchild should already be rendered').to.exist;
});

it('collapseAll() leaves exactly one node with a roving tabindex of 0 after the active item was a nested descendant', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lr-tree-node')] as unknown as LyraTreeNode[];

  root.expand();
  await el.updateComplete;
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  const childA = root.shadowRoot!.querySelector('lr-tree-node') as unknown as LyraTreeNode;
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
  const root = el.querySelector('lr-tree-node') as any;
  root.expanded = true;
  await el.updateComplete;

  // Simulate a re-fetch producing a brand-new array reference with identical ids/labels.
  el.data = JSON.parse(JSON.stringify(data));
  await el.updateComplete;

  const rootAfter = el.querySelector('lr-tree-node') as any;
  expect(rootAfter).to.equal(root, 'the same node instance should be reused, not recreated');
  expect(rootAfter.expanded).to.be.true;
});

it('reconciles added, removed, and reordered top-level items by id', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [rootNode, leafNode] = [...el.querySelectorAll('lr-tree-node')] as any[];

  el.data = [{ id: '2', label: 'Leaf' }, { id: '3', label: 'New' }, ...data.slice(0, 1)];
  await el.updateComplete;

  const nodesAfter = [...el.querySelectorAll('lr-tree-node')] as any[];
  expect(nodesAfter.map((n) => n.item.id)).to.deep.equal(['2', '3', '1']);
  expect(nodesAfter[0]).to.equal(leafNode, 'leaf node instance should be reused');
  expect(nodesAfter[2]).to.equal(rootNode, 'root node instance should be reused');
});

it('refocuses the newly active node when a data reassignment removes the node that currently holds DOM focus', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-node') as unknown as LyraTreeNode;
  (root as unknown as HTMLElement).focus();
  expect(deepActiveElement()).to.equal(root as unknown as Element);

  el.data = [{ id: '2', label: 'Leaf' }];
  await el.updateComplete;

  const newRoot = el.querySelector('lr-tree-node') as unknown as LyraTreeNode;
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
  const [root, leaf] = [...el.querySelectorAll('lr-tree-node')] as HTMLElement[];
  expect(root.tabIndex).to.equal(0);
  expect(leaf.tabIndex).to.equal(-1);
});

it('nests role="group" as a DOM descendant of its role="treeitem" host', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-node') as unknown as LyraTreeNode;
  root.expand();
  await root.updateComplete;
  expect(root.getAttribute('role')).to.equal('treeitem');
  expect(root.shadowRoot!.querySelector('[role="group"]')).to.exist;
});

it('ArrowDown moves the roving tabindex to the next visible item', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lr-tree-node')] as unknown as LyraTreeNode[];
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
  const root = el.querySelector('lr-tree-node') as unknown as LyraTreeNode;
  (root as unknown as HTMLElement).focus();

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(root.expanded).to.be.true;
  expect(deepActiveElement()).to.equal(root as unknown as Element);

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  const firstChild = root.shadowRoot!.querySelector('lr-tree-node');
  expect(deepActiveElement()).to.equal(firstChild);
});

it('Home/End jump to the first/last visible item', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lr-tree-node')] as unknown as LyraTreeNode[];
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
  const root = el.querySelector('lr-tree-node') as unknown as LyraTreeNode;
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
  const [root, leaf] = [...el.querySelectorAll('lr-tree-node')] as unknown as LyraTreeNode[];
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
  const root = el.querySelector('lr-tree-node') as unknown as LyraTreeNode;
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
  const root = el.querySelector('lr-tree-node') as unknown as LyraTreeNode;
  root.expand();
  await el.updateComplete;
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;

  const childA = root.shadowRoot!.querySelector('lr-tree-node') as unknown as LyraTreeNode;
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
  const root = el.querySelector('lr-tree-node') as unknown as LyraTreeNode;
  root.expand();
  await root.updateComplete;
  const childB = root.shadowRoot!.querySelectorAll('lr-tree-node')[1] as unknown as LyraTreeNode;
  childB.expanded = true;
  await root.updateComplete;

  root.item = { ...root.item, children: [nested[0].children![1], nested[0].children![0]] };
  await root.updateComplete;

  const after = [...root.shadowRoot!.querySelectorAll('lr-tree-node')] as unknown as LyraTreeNode[];
  expect(after[0]).to.equal(childB, 'the "B" node instance should be reused after reordering');
  expect(after[0].expanded).to.be.true;
});

it('renders the toggle as an svg chevron rather than a text glyph', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-node') as HTMLElement;
  const toggle = root.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  expect(toggle.querySelector('svg')).to.exist;
  expect(toggle.textContent?.trim()).to.equal('');
});

it('hides the toggle placeholder for a leaf node with no children', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const leaf = [...el.querySelectorAll('lr-tree-node')].find(
    (n) => (n as any).item.id === '2',
  ) as HTMLElement;
  const toggle = leaf.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  expect(toggle.hidden).to.be.true;
  expect(getComputedStyle(toggle).visibility).to.equal('hidden');
  // Still visibility, not display:none -- the box keeps its layout space so
  // this leaf row's label lines up with a sibling row that has a chevron.
  expect(getComputedStyle(toggle).display).to.not.equal('none');

  const root = el.querySelector('lr-tree-node') as HTMLElement;
  const rootToggle = root.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  expect(rootToggle.hidden).to.be.false;
  expect(getComputedStyle(rootToggle).visibility).to.equal('visible');
});

it('rotates the toggle chevron when the node is expanded', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-node') as unknown as LyraTreeNode;
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
  const root = el.querySelector('lr-tree-node') as HTMLElement;
  const toggle = root.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  expect(parseFloat(getComputedStyle(toggle).paddingTop)).to.be.greaterThan(0);
  const box = toggle.getBoundingClientRect();
  expect(box.width).to.be.at.least(24); // >= 1.5rem
  expect(box.height).to.be.at.least(24);
});

it('truncates a long label instead of overflowing, and caps indentation at depth', async () => {
  const item = { id: 'deep', label: 'A very long label '.repeat(20) };
  const el = (await fixture(
    html`<lr-tree-node .item=${item} .depth=${50}></lr-tree-node>`,
  )) as LyraTreeNode;
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
  const root = el.querySelector('lr-tree-node') as HTMLElement;
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
  const [root, leaf] = [...el.querySelectorAll('lr-tree-node')] as unknown as LyraTreeNode[];

  expect((root as unknown as HTMLElement).getAttribute('aria-level')).to.equal('1');
  expect((root as unknown as HTMLElement).getAttribute('aria-setsize')).to.equal('2');
  expect((root as unknown as HTMLElement).getAttribute('aria-posinset')).to.equal('1');
  expect((leaf as unknown as HTMLElement).getAttribute('aria-level')).to.equal('1');
  expect((leaf as unknown as HTMLElement).getAttribute('aria-setsize')).to.equal('2');
  expect((leaf as unknown as HTMLElement).getAttribute('aria-posinset')).to.equal('2');

  root.expand();
  await el.updateComplete;
  const [childA, childB] = [
    ...(root as unknown as HTMLElement).shadowRoot!.querySelectorAll('lr-tree-node'),
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
  const root = el.querySelector('lr-tree-node') as HTMLElement;
  const badge = root.shadowRoot!.querySelector('[part="badge"]');
  expect(badge).to.exist;
  expect(badge!.textContent).to.equal('0');
});

describe('tree-node badges', () => {
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
    const node = el.querySelector('lr-tree-node') as LyraTreeNode;
    const badgeParts = node.shadowRoot!.querySelectorAll('[part="badge"]');
    expect(badgeParts.length).to.equal(0);
  });

  it('renders badges chips with data-tone after the legacy badge', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = dataWithBadges;
    await el.updateComplete;
    const node = el.querySelector('lr-tree-node') as LyraTreeNode;
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
    const node = el.querySelector('lr-tree-node') as LyraTreeNode;
    const badgeParts = [...node.shadowRoot!.querySelectorAll('[part="badge"]')] as HTMLElement[];
    expect(badgeParts[1].getAttribute('aria-label')).to.equal('Modified'); // label wins
    expect(badgeParts[2].getAttribute('aria-label')).to.equal('+2'); // falls back to text
  });

  it('defaults an unset tone to neutral', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = [{ id: 'a', label: 'x', badges: [{ text: 'U' }] }];
    await el.updateComplete;
    const node = el.querySelector('lr-tree-node') as LyraTreeNode;
    expect((node.shadowRoot!.querySelector('[part="badge"]') as HTMLElement).dataset.tone).to.equal('neutral');
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
  const root = el.querySelector('lr-tree-node') as unknown as LyraTreeNode;
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
  const root = el.querySelector('lr-tree-node') as unknown as LyraTreeNode;
  root.expand();
  await el.updateComplete;
  (root as unknown as HTMLElement).focus();

  // Warm up the visible-node list by navigating into A, then B, before the
  // direct mutation below -- this is what exposes a stale memoized cache.
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  const a = root.shadowRoot!.querySelector('lr-tree-node') as unknown as LyraTreeNode;
  expect(deepActiveElement()).to.equal(a as unknown as Element);

  (a as unknown as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }),
  );
  await el.updateComplete;
  const b = root.shadowRoot!.querySelectorAll('lr-tree-node')[1] as unknown as LyraTreeNode;
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
  const c = root.shadowRoot!.querySelectorAll('lr-tree-node')[2] as unknown as LyraTreeNode;
  expect(deepActiveElement()).to.equal(c as unknown as Element);
});

it('keeps arrow-key navigation correct after expandAll() reveals nodes that were not previously visible', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-node') as unknown as LyraTreeNode;
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
  const childA = root.shadowRoot!.querySelector('lr-tree-node');
  expect(deepActiveElement()).to.equal(childA);
});

it('renders a structured icon and secondary description without adding another interactive row', async () => {
  const icon = html`<svg data-test-icon viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"></circle></svg>`;
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [{ id: 'rich', label: 'Judgment', icon, description: 'Grand Chamber · 2026', badge: 3 }];
  await el.updateComplete;

  const node = el.querySelector('lr-tree-node') as HTMLElement;
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

  const node = el.querySelector('lr-tree-node') as HTMLElement;
  expect(node.getAttribute('aria-label')).to.equal(
    'Case C-42/24, Judgment, 3 cited decisions',
  );
  expect(node.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('C-42/24');
});

it('removes a stale accessible label when reassigned row data no longer supplies one', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [{ id: 'case', label: 'Case', accessibleLabel: 'Detailed case label' }];
  await el.updateComplete;
  const node = el.querySelector('lr-tree-node') as HTMLElement;
  expect(node.getAttribute('aria-label')).to.equal('Detailed case label');

  el.data = [{ id: 'case', label: 'Case' }];
  await el.updateComplete;

  expect(node.hasAttribute('aria-label')).to.equal(false);
});
