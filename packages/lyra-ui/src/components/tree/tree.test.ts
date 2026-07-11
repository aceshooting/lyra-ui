import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './tree.js';
import type { LyraTree } from './tree.js';
import type { LyraTreeNode } from './tree-node.js';

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

it('renders top-level treeitems with a tree role', async () => {
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[role="tree"]')).to.exist;
  const items = el.querySelectorAll('lyra-tree-node');
  expect(items.length).to.equal(2);
});

it('emits lyra-node-toggle when a parent node is expanded', async () => {
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lyra-tree-node') as HTMLElement;
  const toggle = root.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  setTimeout(() => toggle.click());
  const ev = await oneEvent(el, 'lyra-node-toggle');
  expect(ev.detail).to.deep.equal({ id: '1', expanded: true });
});

it('emits lyra-node-select when a node label is activated', async () => {
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const leaf = [...el.querySelectorAll('lyra-tree-node')].find(
    (n) => (n as any).item.id === '2',
  ) as HTMLElement;
  const label = leaf.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  setTimeout(() => label.click());
  const ev = await oneEvent(el, 'lyra-node-select');
  expect(ev.detail).to.deep.equal({ id: '2' });
});

it('expandAll()/collapseAll() toggle every parent node', async () => {
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  el.expandAll();
  await el.updateComplete;
  const root = el.querySelector('lyra-tree-node') as any;
  expect(root.expanded).to.be.true;
  el.collapseAll();
  await el.updateComplete;
  expect(root.expanded).to.be.false;
});

it('preserves per-node expanded state when data is reassigned a new array with the same ids', async () => {
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lyra-tree-node') as any;
  root.expanded = true;
  await el.updateComplete;

  // Simulate a re-fetch producing a brand-new array reference with identical ids/labels.
  el.data = JSON.parse(JSON.stringify(data));
  await el.updateComplete;

  const rootAfter = el.querySelector('lyra-tree-node') as any;
  expect(rootAfter).to.equal(root, 'the same node instance should be reused, not recreated');
  expect(rootAfter.expanded).to.be.true;
});

it('reconciles added, removed, and reordered top-level items by id', async () => {
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [rootNode, leafNode] = [...el.querySelectorAll('lyra-tree-node')] as any[];

  el.data = [{ id: '2', label: 'Leaf' }, { id: '3', label: 'New' }, ...data.slice(0, 1)];
  await el.updateComplete;

  const nodesAfter = [...el.querySelectorAll('lyra-tree-node')] as any[];
  expect(nodesAfter.map((n) => n.item.id)).to.deep.equal(['2', '3', '1']);
  expect(nodesAfter[0]).to.equal(leafNode, 'leaf node instance should be reused');
  expect(nodesAfter[2]).to.equal(rootNode, 'root node instance should be reused');
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
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
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lyra-tree-node')] as HTMLElement[];
  expect(root.tabIndex).to.equal(0);
  expect(leaf.tabIndex).to.equal(-1);
});

it('nests role="group" as a DOM descendant of its role="treeitem" host', async () => {
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lyra-tree-node') as unknown as LyraTreeNode;
  root.expand();
  await root.updateComplete;
  expect(root.getAttribute('role')).to.equal('treeitem');
  expect(root.shadowRoot!.querySelector('[role="group"]')).to.exist;
});

it('ArrowDown moves the roving tabindex to the next visible item', async () => {
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lyra-tree-node')] as unknown as LyraTreeNode[];
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  expect((leaf as unknown as HTMLElement).tabIndex).to.equal(0);
  expect(deepActiveElement()).to.equal(leaf);
});

it('ArrowRight expands a collapsed node without moving focus, then a 2nd press steps into its first child', async () => {
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lyra-tree-node') as unknown as LyraTreeNode;
  (root as unknown as HTMLElement).focus();

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(root.expanded).to.be.true;
  expect(deepActiveElement()).to.equal(root as unknown as Element);

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  const firstChild = root.shadowRoot!.querySelector('lyra-tree-node');
  expect(deepActiveElement()).to.equal(firstChild);
});

it('Home/End jump to the first/last visible item', async () => {
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lyra-tree-node')] as unknown as LyraTreeNode[];
  (root as unknown as HTMLElement).focus();
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(deepActiveElement()).to.equal(leaf as unknown as Element);

  leaf.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(deepActiveElement()).to.equal(root as unknown as Element);
});

it('Enter fires lyra-node-select on the focused item', async () => {
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lyra-tree-node') as unknown as LyraTreeNode;
  (root as unknown as HTMLElement).focus();
  setTimeout(() =>
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })),
  );
  const ev = await oneEvent(el, 'lyra-node-select');
  expect(ev.detail).to.deep.equal({ id: '1' });
});

it('preserves nested per-node expanded state when a nested children array is reordered', async () => {
  const nested = [
    { id: '1', label: 'Root', children: [{ id: '1.1', label: 'A' }, { id: '1.2', label: 'B' }] },
  ];
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = nested;
  await el.updateComplete;
  const root = el.querySelector('lyra-tree-node') as unknown as LyraTreeNode;
  root.expand();
  await root.updateComplete;
  const childB = root.shadowRoot!.querySelectorAll('lyra-tree-node')[1] as unknown as LyraTreeNode;
  childB.expanded = true;
  await root.updateComplete;

  root.item = { ...root.item, children: [nested[0].children![1], nested[0].children![0]] };
  await root.updateComplete;

  const after = [...root.shadowRoot!.querySelectorAll('lyra-tree-node')] as unknown as LyraTreeNode[];
  expect(after[0]).to.equal(childB, 'the "B" node instance should be reused after reordering');
  expect(after[0].expanded).to.be.true;
});

it('renders the toggle as an svg chevron rather than a text glyph', async () => {
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lyra-tree-node') as HTMLElement;
  const toggle = root.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  expect(toggle.querySelector('svg')).to.exist;
  expect(toggle.textContent?.trim()).to.equal('');
});

it('rotates the toggle chevron when the node is expanded', async () => {
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lyra-tree-node') as unknown as LyraTreeNode;
  const toggle = root.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  expect(getComputedStyle(toggle).transform).to.equal('none');
  root.expand();
  await root.updateComplete;
  expect(getComputedStyle(toggle).transform).to.not.equal('none');
});

it('gives the toggle a touch-friendly clickable box via padding, not just a bare 1rem glyph', async () => {
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lyra-tree-node') as HTMLElement;
  const toggle = root.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  expect(parseFloat(getComputedStyle(toggle).paddingTop)).to.be.greaterThan(0);
  const box = toggle.getBoundingClientRect();
  expect(box.width).to.be.at.least(24); // >= 1.5rem
  expect(box.height).to.be.at.least(24);
});

it('truncates a long label instead of overflowing, and caps indentation at depth', async () => {
  const item = { id: 'deep', label: 'A very long label '.repeat(20) };
  const el = (await fixture(
    html`<lyra-tree-node .item=${item} .depth=${50}></lyra-tree-node>`,
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
  // 8rem plus the 0.5rem base (--lyra-space-s fallback) = 8.5rem = 136px.
  expect(getComputedStyle(row).getPropertyValue('padding-inline-start')).to.equal('136px');
});

it('renders the badge with the higher-contrast text token instead of text-quiet', async () => {
  const el = (await fixture(html`<lyra-tree></lyra-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lyra-tree-node') as HTMLElement;
  const badge = root.shadowRoot!.querySelector('[part="badge"]') as HTMLElement;
  // --lyra-color-text falls back to #1a1a1a (rgb(26, 26, 26)) with no WA
  // tokens loaded in the test env; --lyra-color-text-quiet falls back to
  // #6b7280 (rgb(107, 114, 128)) — this pins the fix, not just "changed".
  expect(getComputedStyle(badge).color).to.equal('rgb(26, 26, 26)');
});
