import { expect, fixture, html } from '@open-wc/testing';
import './tree.js';
import type { LyraTree, LyraTreeNodeData, TreeBadge } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';

/** The normalized node object the tree currently holds for its first top-level row. */
function rowNode(tree: LyraTree): LyraTreeNodeData | undefined {
  return tree.querySelector<LyraTreeItem>('lr-tree-item')?.item;
}

async function mount(): Promise<LyraTree> {
  return fixture<LyraTree>(html`<lr-tree label="Files"></lr-tree>`);
}

const glyph = (name: string) => html`<span class="glyph">${name}</span>`;
const otherGlyph = (name: string) => html`<i class="other">${name}</i>`;

describe('lr-tree node reuse across data refreshes', () => {
  it('keeps the node object when a refresh recreates an equal icon template', async () => {
    const tree = await mount();
    tree.data = [{ id: 'a', label: 'Alpha', icon: glyph('folder') }];
    await tree.updateComplete;
    const before = rowNode(tree);
    expect(before).not.to.equal(undefined);
    tree.data = [{ id: 'a', label: 'Alpha', icon: glyph('folder') }];
    await tree.updateComplete;
    expect(rowNode(tree) === before).to.equal(true);
  });

  it('replaces the node when its icon values, template or kind of value changes', async () => {
    const tree = await mount();
    // Each step differs from the one before it in a different way: template values, template
    // literal, a missing icon, a plain string, and a non-template object (never treated as equal).
    const icons: unknown[] = [
      glyph('folder'), glyph('file'), otherGlyph('file'), null, glyph('file'), 'plain', 'other', { name: 'a' }, { name: 'a' },
    ];
    let previous: LyraTreeNodeData | undefined;
    for (const [position, icon] of icons.entries()) {
      tree.data = [{ id: 'a', label: 'Alpha', icon }];
      await tree.updateComplete;
      const current = rowNode(tree);
      if (position > 0) expect(current === previous, `step ${position}`).to.equal(false);
      previous = current;
    }
  });

  it('keeps the node object for equal badges and replaces it for any difference', async () => {
    const tree = await mount();
    const badges = (...texts: string[]): TreeBadge[] => texts.map((text) => ({ text, tone: 'brand' }));
    tree.data = [{ id: 'a', label: 'Alpha', badges: badges('2') }];
    await tree.updateComplete;
    const first = rowNode(tree);
    tree.data = [{ id: 'a', label: 'Alpha', badges: badges('2') }];
    await tree.updateComplete;
    expect(rowNode(tree) === first, 'equal badges').to.equal(true);
    tree.data = [{ id: 'a', label: 'Alpha', badges: badges('2', '3') }];
    await tree.updateComplete;
    const longer = rowNode(tree);
    expect(longer === first, 'more badges').to.equal(false);
    tree.data = [{ id: 'a', label: 'Alpha' }];
    await tree.updateComplete;
    const bare = rowNode(tree);
    expect(bare === longer, 'no badges').to.equal(false);
    expect(bare?.badges).to.equal(undefined);
    tree.data = [{ id: 'a', label: 'Alpha', badges: badges('2') }];
    await tree.updateComplete;
    expect(rowNode(tree) === bare, 'badges added again').to.equal(false);
    expect(rowNode(tree)?.badges?.length).to.equal(1);
  });
});
