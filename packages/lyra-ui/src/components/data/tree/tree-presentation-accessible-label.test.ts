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

it('uses accessibleLabel as the treeitem host name without changing its visible label', async () => {
  const el = (await fixture(html`<lr-tree label="Cases"></lr-tree>`)) as LyraTree;
  el.data = [
    {
      id: 'case',
      label: 'C-42/24',
      description: 'Judgment',
      accessibleLabel: 'Case C-42/24, Judgment, 3 cited decisions',
    },
  ];
  await el.updateComplete;

  const node = el.querySelector('lr-tree-item') as HTMLElement;
  expect(node.getAttribute('aria-label')).to.equal(
    'Case C-42/24, Judgment, 3 cited decisions',
  );
  expect(node.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('C-42/24');
});
