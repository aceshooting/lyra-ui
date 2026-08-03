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
