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
