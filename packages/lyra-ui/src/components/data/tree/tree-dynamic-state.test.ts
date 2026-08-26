import { fixture, expect, html } from '@open-wc/testing';
import './tree.js';
import type { LyraTree } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';

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

function required<T>(value: T | undefined, context: string): T {
  if (value === undefined) throw new Error(`Missing ${context}`);
  return value;
}

/** Walks into shadow roots to find the actually-focused element (a focused
 *  element inside a shadow tree only surfaces as its shadow host via the
 *  plain `document.activeElement`). */
function deepActiveElement(root: Document | ShadowRoot = document): Element | null {
  const active = root.activeElement;
  return active?.shadowRoot?.activeElement ? deepActiveElement(active.shadowRoot) : active;
}

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

  const rootData = required(nested[0], 'root data item');
  const children = required(rootData.children, 'root data children');
  root.item = {
    ...required(root.item, 'rendered root item data'),
    children: [required(children[1], 'second child data'), required(children[0], 'first child data')],
  };
  await root.updateComplete;

  const after = [...root.shadowRoot!.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
  expect((after[0]) === (childB)).to.equal(true, 'the "B" node instance should be reused after reordering');
  expect(required(after[0], 'reordered first child').expanded).to.be.true;
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

it('names the internal role="tree" element from a forwarded host aria-label, and from the label prop when the host carries none', async () => {
  // Precedence changed in 10.0.0: a host aria-label now wins over the `label` property, which is
  // what AGENTS.md requires ("a host aria-label wins over any computed internal accessible name")
  // and what segmented, avatar-group, card, file-icon, flow-controls, document-viewer,
  // highlight-layer and geojson-view already did. lr-tree was the sole outlier, resolving `label`
  // first, so an author who set both got the property rather than the attribute they wrote on the
  // element itself.
  const el = (await fixture(
    html`<lr-tree aria-label="Forwarded label"></lr-tree>`,
  )) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[role="tree"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Forwarded label');

  el.label = 'File explorer';
  await el.updateComplete;
  expect(base.getAttribute('aria-label'), 'host aria-label outranks the label property').to.equal(
    'Forwarded label',
  );

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(base.getAttribute('aria-label'), 'label names the tree when the host carries none').to.equal(
    'File explorer',
  );
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
  expect((deepActiveElement()) === (a as unknown as Element)).to.equal(true);

  (a as unknown as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }),
  );
  await el.updateComplete;
  const b = root.shadowRoot!.querySelectorAll('lr-tree-item')[1] as unknown as LyraTreeItem;
  expect((deepActiveElement()) === (b as unknown as Element)).to.equal(true);

  // Legitimate direct write path (also used by this file's own
  // "reorders a nested children array" test above) -- no `data`
  // reassignment on `<lr-tree>`, no `lr-node-toggle` event.
  const rootItem = required(root.item, 'rendered root item data');
  root.item = {
    ...rootItem,
    children: [...required(rootItem.children, 'rendered root children'), { id: 'c', label: 'C' }],
  };
  await root.updateComplete;

  (b as unknown as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }),
  );
  await el.updateComplete;
  const c = root.shadowRoot!.querySelectorAll('lr-tree-item')[2] as unknown as LyraTreeItem;
  expect((deepActiveElement()) === (c as unknown as Element)).to.equal(true);
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
  expect((deepActiveElement()) === (root as unknown as Element)).to.equal(true);

  el.expandAll();
  await el.updateComplete;

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  const childA = root.shadowRoot!.querySelector('lr-tree-item');
  expect((deepActiveElement()) === (childA)).to.equal(true);
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
