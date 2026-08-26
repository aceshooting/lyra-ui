import { fixture, expect, html } from '@open-wc/testing';
import './tree.js';
import type { LyraTree } from './tree.js';

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

it('renders an unset badge tone through the neutral text token', async () => {
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = data;
  await el.updateComplete;
  const root = el.querySelector('lr-tree-item') as HTMLElement;
  const badge = root.shadowRoot!.querySelector('[part="badge"]') as HTMLElement;
  expect((badge as HTMLElement).dataset['tone']).to.equal('neutral');
  expect(getComputedStyle(badge).color).to.equal('rgb(107, 114, 128)');
});
