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

it('renders a badge value of 0 instead of treating it as absent', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [{ id: '1', label: 'Root', badges: [{ text: '0' }], }];
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as HTMLElement;
  const badge = root.shadowRoot!.querySelector('[part="badge"]');
  expect(badge !== null).to.be.true;
  expect(badge!.textContent).to.equal('0');
});
