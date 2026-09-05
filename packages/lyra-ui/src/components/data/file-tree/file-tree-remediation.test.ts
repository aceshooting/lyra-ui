import { expect, fixture, html } from '@open-wc/testing';
import './file-tree.js';
import type { FileTreeNode, LyraFileTree } from './file-tree.js';

for (const field of ['name', 'kind', 'mimeType', 'gitStatus', 'additions', 'deletions', 'hasChildren', 'children']) {
  it(`admits the next valid same-path node after a rejected ${field} getter`, async () => {
    const malformed = Object.defineProperty({ path: 'same.txt' }, field, {
      enumerable: true,
      get() { throw new TypeError('Unavailable file metadata'); },
    }) as FileTreeNode;
    const el = await fixture<LyraFileTree>(html`<lr-file-tree></lr-file-tree>`);
    el.nodes = [
      malformed,
      { path: 'same.txt', name: 'First valid file', kind: 'file' },
      { path: 'same.txt', name: 'Duplicate file' },
      { path: 'neighbor.txt', name: 'Neighbor' },
    ];
    await el.updateComplete;
    expect(el.nodes.map((node) => node.path)).to.deep.equal(['same.txt', 'neighbor.txt']);
    expect(el.nodes[0]!.name).to.equal('First valid file');
    expect(Object.isFrozen(el.nodes[0])).to.equal(true);
    const tree = el.shadowRoot!.querySelector('lr-tree')!;
    await tree.updateComplete;
    expect(tree.data.map((node) => node.label)).to.deep.equal(['First valid file', 'Neighbor']);
    expect(tree.querySelector('lr-tree-item')!.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('First valid file');
  });
}

it('keeps first-valid path ownership across nested file collections', async () => {
  const malformed = Object.defineProperty({ path: 'shared.txt' }, 'name', {
    get() { throw new TypeError('Unavailable file name'); },
  }) as FileTreeNode;
  const el = await fixture<LyraFileTree>(html`<lr-file-tree></lr-file-tree>`);
  el.nodes = [
    { path: 'folder', children: [malformed] },
    { path: 'shared.txt', name: 'Valid root' },
    { path: 'later', children: [{ path: 'shared.txt', name: 'Later duplicate' }] },
  ];
  await el.updateComplete;
  expect(el.nodes.map((node) => node.path)).to.deep.equal(['folder', 'shared.txt', 'later']);
  expect(el.nodes[0]!.children!.length).to.equal(0);
  expect(el.nodes[2]!.children!.length).to.equal(0);
});
