import { fixture, expect, html } from '@open-wc/testing';
import './tree.js';
import type { LyraTree } from './tree.js';
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
