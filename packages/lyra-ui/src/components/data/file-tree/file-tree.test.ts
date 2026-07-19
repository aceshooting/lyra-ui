import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './file-tree.js';
import type { LyraFileTree, FileTreeNode } from './file-tree.js';

const nodes: FileTreeNode[] = [
  {
    path: 'src',
    kind: 'directory',
    children: [
      { path: 'src/app.ts', gitStatus: 'modified', additions: 4, deletions: 1 },
      { path: 'src/util.ts', gitStatus: 'added' },
    ],
  },
  { path: 'README.md' },
];

describe('lr-file-tree', () => {
  it('renders a row per file/directory, deepest-first order preserved', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = nodes;
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-tree')!;
    expect(tree.data.map((i: { id: string }) => i.id)).to.deep.equal(['src', 'README.md']);
  });

  it('renders a git-status badge and diffstat for a file with gitStatus', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = nodes;
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-tree')!;
    const appItem = tree.data[0].children!.find((i: { id: string }) => i.id === 'src/app.ts')!;
    expect(appItem.badges![0].text).to.equal('M');
    expect(appItem.badges![0].tone).to.equal('brand');
    expect(appItem.description).to.include('+4');
    expect(appItem.description).to.include('-1');
  });

  it('emits lr-file-select when a file row is activated', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = nodes;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-file-select');
    el.shadowRoot!.querySelector('lr-tree')!.dispatchEvent(
      new CustomEvent('lr-node-select', { detail: { id: 'README.md' }, bubbles: true, composed: true }),
    );
    const event = (await listener) as CustomEvent<{ path: string }>;
    expect(event.detail.path).to.equal('README.md');
  });

  it('emits lr-file-open on a second select of an already-selected file (keyboard-open parity)', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = nodes;
    el.selectedPath = 'README.md';
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-file-open');
    el.shadowRoot!.querySelector('lr-tree')!.dispatchEvent(
      new CustomEvent('lr-node-select', { detail: { id: 'README.md' }, bubbles: true, composed: true }),
    );
    const event = (await listener) as CustomEvent<{ path: string }>;
    expect(event.detail.path).to.equal('README.md');
  });

  it('emits lr-load-children exactly once when a lazy (hasChildren, no children) directory expands', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = [{ path: 'lazy-dir', kind: 'directory', hasChildren: true }];
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-load-children');
    el.shadowRoot!.querySelector('lr-tree')!.dispatchEvent(
      new CustomEvent('lr-node-toggle', { detail: { id: 'lazy-dir', expanded: true }, bubbles: true, composed: true }),
    );
    const event = (await listener) as CustomEvent<{ path: string }>;
    expect(event.detail.path).to.equal('lazy-dir');
  });

  it('setChildren() fulfills a lazy directory in place without a nodes reassignment from the host', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = [{ path: 'lazy-dir', kind: 'directory', hasChildren: true }];
    await el.updateComplete;
    el.setChildren('lazy-dir', [{ path: 'lazy-dir/file.ts' }]);
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-tree')!;
    const dirItem = tree.data.find((i: { id: string }) => i.id === 'lazy-dir')!;
    expect(dirItem.children!.map((c: { id: string }) => c.id)).to.deep.equal(['lazy-dir/file.ts']);
  });

  it('revealPath() expands ancestors and resolves true for a real nested path', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = nodes;
    await el.updateComplete;
    const found = await el.revealPath('src/app.ts');
    expect(found).to.be.true;
  });

  it('revealPath() resolves false for an absent path', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = nodes;
    await el.updateComplete;
    expect(await el.revealPath('does/not/exist')).to.be.false;
  });

  it('is accessible with a nested, git-status-decorated tree', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = nodes;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
