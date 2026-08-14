import { fixture, expect, html } from '@open-wc/testing';
import './tree.js';
import type { LyraTree } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';
import { configureTreeItemOwner, treeItemOwnerContext } from './tree-owner-controller.js';

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

it('truncates a long label instead of overflowing, and caps indentation at depth', async () => {
  const item = { id: 'deep', label: 'A very long label '.repeat(20) };
  const el = (await fixture(html`<lr-tree-item .item=${item}></lr-tree-item>`)) as LyraTreeItem;
  configureTreeItemOwner(el, {
    ...treeItemOwnerContext(el),
    activeId: el.nodeId,
    ancestry: [],
    depth: 50,
    setSize: 1,
    posInSet: 1,
    selection: 'single',
    ownsSelection: true,
    expandIcon: null,
    collapseIcon: null,
  });
  await el.updateComplete;

  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const labelStyle = getComputedStyle(label);
  expect(labelStyle.overflow).to.equal('hidden');
  expect(labelStyle.textOverflow).to.equal('ellipsis');
  expect(labelStyle.whiteSpace).to.equal('nowrap');
  expect(labelStyle.minWidth).to.equal('0px');

  const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  // Depth 50 would be 50rem (800px) of indent uncapped; the cap holds it at
  // 8rem plus the 0.5rem base (--lr-space-s fallback) = 8.5rem = 136px.
  expect(getComputedStyle(row).getPropertyValue('padding-inline-start')).to.equal('136px');
});
