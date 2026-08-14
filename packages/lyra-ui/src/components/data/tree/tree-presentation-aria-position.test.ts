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

it('sets aria-level, aria-setsize, and aria-posinset to the correct values for top-level and nested items', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const [root, leaf] = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];

  expect((root as unknown as HTMLElement).getAttribute('aria-level')).to.equal('1');
  expect((root as unknown as HTMLElement).getAttribute('aria-setsize')).to.equal('2');
  expect((root as unknown as HTMLElement).getAttribute('aria-posinset')).to.equal('1');
  expect((leaf as unknown as HTMLElement).getAttribute('aria-level')).to.equal('1');
  expect((leaf as unknown as HTMLElement).getAttribute('aria-setsize')).to.equal('2');
  expect((leaf as unknown as HTMLElement).getAttribute('aria-posinset')).to.equal('2');

  root.expand();
  await el.updateComplete;
  const [childA, childB] = [
    ...(root as unknown as HTMLElement).shadowRoot!.querySelectorAll('lr-tree-item'),
  ] as unknown as HTMLElement[];
  expect(childA.getAttribute('aria-level')).to.equal('2');
  expect(childA.getAttribute('aria-setsize')).to.equal('2');
  expect(childA.getAttribute('aria-posinset')).to.equal('1');
  expect(childB.getAttribute('aria-level')).to.equal('2');
  expect(childB.getAttribute('aria-setsize')).to.equal('2');
  expect(childB.getAttribute('aria-posinset')).to.equal('2');
});
