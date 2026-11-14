import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './tree.js';
import type { LyraTree } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';

describe('lr-tree in a windowless document', () => {
  it('keeps authored items usable after adoption into a document without a window', async () => {
    const mount = await fixture<HTMLDivElement>(html`<div>
      <lr-tree label="Topics" selection="multiple">
        <lr-tree-item label="Parent" selected><lr-tree-item label="Child"></lr-tree-item></lr-tree-item>
        <lr-tree-item label="Sibling"></lr-tree-item>
      </lr-tree>
    </div>`);
    const tree = mount.querySelector('lr-tree') as LyraTree;
    await tree.updateComplete;
    const owner = document.implementation.createHTMLDocument('Detached editor');
    try {
      owner.body.append(owner.adoptNode(tree));
      await tree.updateComplete;

      expect(tree.ownerDocument.defaultView).to.equal(null);
      expect(tree.isConnected).to.equal(true);
      expect(tree.selectedItems.map((item) => item.label)).to.deep.equal(['Parent', 'Child']);
    } finally {
      mount.append(document.adoptNode(tree));
    }
    await tree.updateComplete;
    expect(tree.selectedItems.map((item) => item.label)).to.deep.equal(['Parent', 'Child']);
  });

  it('expands an item without scheduling after-expand when its document has no window', async () => {
    const mount = await fixture<HTMLDivElement>(html`<div>
      <lr-tree-item label="Parent" style="--show-duration:0ms"><lr-tree-item label="Child"></lr-tree-item></lr-tree-item>
    </div>`);
    const item = mount.querySelector('lr-tree-item') as LyraTreeItem;
    await item.updateComplete;
    const events: string[] = [];
    for (const name of ['lr-expand', 'lr-after-expand']) item.addEventListener(name, () => events.push(name));
    const owner = document.implementation.createHTMLDocument('Detached editor');
    try {
      owner.body.append(owner.adoptNode(item));
      item.expand();
      await item.updateComplete;
      // wait-reason: a 0ms lifecycle timer would have fired by now had one been scheduled
      await aTimeout(20);

      expect(item.expanded).to.equal(true);
      expect(events).to.deep.equal(['lr-expand']);
    } finally {
      mount.append(document.adoptNode(item));
    }
  });
});
