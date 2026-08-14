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

  root.item = { ...root.item, children: [nested[0].children![1], nested[0].children![0]] };
  await root.updateComplete;

  const after = [...root.shadowRoot!.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
  expect((after[0]) === (childB)).to.equal(true, 'the "B" node instance should be reused after reordering');
  expect(after[0].expanded).to.be.true;
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
  root.item = { ...root.item, children: [...root.item.children!, { id: 'c', label: 'C' }] };
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
