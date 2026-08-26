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

it('sets aria-level, aria-setsize, and aria-posinset to the correct values for top-level and nested items', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const items = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
  const root = required(items[0], 'root tree item');
  const leaf = required(items[1], 'leaf tree item');

  expect((root as unknown as HTMLElement).getAttribute('aria-level')).to.equal('1');
  expect((root as unknown as HTMLElement).getAttribute('aria-setsize')).to.equal('2');
  expect((root as unknown as HTMLElement).getAttribute('aria-posinset')).to.equal('1');
  expect((leaf as unknown as HTMLElement).getAttribute('aria-level')).to.equal('1');
  expect((leaf as unknown as HTMLElement).getAttribute('aria-setsize')).to.equal('2');
  expect((leaf as unknown as HTMLElement).getAttribute('aria-posinset')).to.equal('2');

  root.expand();
  await el.updateComplete;
  const children = [
    ...(root as unknown as HTMLElement).shadowRoot!.querySelectorAll('lr-tree-item'),
  ] as unknown as HTMLElement[];
  const childA = required(children[0], 'first child tree item');
  const childB = required(children[1], 'second child tree item');
  expect(childA.getAttribute('aria-level')).to.equal('2');
  expect(childA.getAttribute('aria-setsize')).to.equal('2');
  expect(childA.getAttribute('aria-posinset')).to.equal('1');
  expect(childB.getAttribute('aria-level')).to.equal('2');
  expect(childB.getAttribute('aria-setsize')).to.equal('2');
  expect(childB.getAttribute('aria-posinset')).to.equal('2');
});
