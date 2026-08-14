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

it('renders a structured icon and secondary description without adding another interactive row', async () => {
  const icon = html`<svg data-test-icon viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"></circle></svg>`;
  const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
  el.data = [{ id: 'rich', label: 'Judgment', icon, description: 'Grand Chamber · 2026', badges: [{ text: '3' }], }];
  await el.updateComplete;

  const node = el.querySelector('lr-tree-item') as HTMLElement;
  const iconPart = node.shadowRoot!.querySelector('[part="icon"]')!;
  const description = node.shadowRoot!.querySelector('[part="description"]')!;

  expect(iconPart.querySelector('[data-test-icon]') !== null).to.be.true;
  expect(iconPart.getAttribute('aria-hidden')).to.equal('true');
  expect(description.textContent).to.equal('Grand Chamber · 2026');
  expect(node.shadowRoot!.querySelectorAll('[role]').length).to.equal(0);
  await expect(el).to.be.accessible();
});
