import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './file-tree.js';
import type { LyraFileTree, FileTreeNode } from './file-tree.class.js';
import type { LyraTree } from '../tree/tree.js';
import type { LyraTreeItem } from '../tree/tree-item.js';
import type { LyraHierarchySource, LyraHierarchyQuery } from '../../../data-sources.js';

function innerTree(el: LyraFileTree): LyraTree {
  const tree = el.shadowRoot?.querySelector('lr-tree') as LyraTree | null;
  if (!tree) throw new Error('Missing inner tree');
  return tree;
}

function rows(el: LyraFileTree): LyraTreeItem[] {
  return [...innerTree(el).querySelectorAll('lr-tree-item')] as LyraTreeItem[];
}

function rowText(row: LyraTreeItem): string {
  return (row.shadowRoot?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function statusSource(): LyraHierarchySource<FileTreeNode, LyraHierarchyQuery> {
  const values = [
    { path: 'clean.ts', kind: 'file', gitStatus: 'modified', additions: 4, deletions: 2 },
    { path: 'odd.ts', kind: 'file', gitStatus: 'exploded', additions: -1, deletions: 1.5 },
  ];
  return {
    revision: 1,
    async project() {
      return {
        state: 'initial',
        total: values.length,
        rows: {
          count: values.length,
          keyAt: (index: number) => values[index]!.path,
          indexOfKey: (key: string | number) => values.findIndex((value) => value.path === key),
          itemAt: (index: number) => ({
            key: values[index]!.path, value: values[index] as unknown as FileTreeNode, parentKey: null,
            level: 1, position: index + 1, setSize: values.length, childCount: 0, expanded: false, selected: false,
          }),
        },
      };
    },
  };
}

describe('lr-file-tree edges', () => {
  it('formats a partial diff with a zero for the missing side and ignores non-numeric counts', async () => {
    const el = await fixture<LyraFileTree>(html`<lr-file-tree label="Changes"></lr-file-tree>`);
    el.nodes = [
      { path: 'removed.ts', deletions: 3 },
      { path: 'text-count.ts', additions: '7' as unknown as number, deletions: null as unknown as number },
    ];
    await el.updateComplete;
    await innerTree(el).updateComplete;
    const [removed, textCount] = rows(el);
    await removed!.updateComplete;

    expect(rowText(removed!)).to.contain('+0 -3');
    expect(rowText(textCount!)).to.contain('+0 -0');
  });

  it('declines source-only and bulk calls that do not apply to the active mode', async () => {
    const el = await fixture<LyraFileTree>(html`<lr-file-tree label="Files" style="height: 200px"></lr-file-tree>`);
    el.nodes = [{ path: 'src', children: [{ path: 'src/a.ts' }] }];
    await el.updateComplete;
    expect(await el.revealSourceKey('src')).to.equal(false);

    el.treeSource = statusSource();
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part~="source-row"]').length === 2, 'source rows render', { timeout: 2000 });
    expect(el.expandAll()).to.equal(undefined);
    el.collapseAll();
    expect(el.shadowRoot!.querySelector('lr-tree') === null).to.equal(true);
  });

  it('drops unknown statuses and invalid counts from provider rows', async () => {
    const el = await fixture<LyraFileTree>(html`<lr-file-tree label="Files" style="height: 200px"></lr-file-tree>`);
    el.treeSource = statusSource();
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part~="source-row"]').length === 2, 'source rows render', { timeout: 2000 });
    const clean = el.shadowRoot!.querySelector('[data-source-key="clean.ts"]')!;
    const odd = el.shadowRoot!.querySelector('[data-source-key="odd.ts"]')!;

    expect((clean.textContent ?? '').replace(/\s+/g, ' ')).to.contain('+4 -2');
    expect(clean.querySelectorAll('span[aria-label]').length).to.equal(1);
    expect((odd.textContent ?? '').replace(/\s+/g, ' ')).to.not.contain('-1');
    expect(odd.querySelectorAll('span[aria-label]').length).to.equal(0);
  });

  it('resolves a reveal false when the listing is replaced before it settles', async () => {
    const el = await fixture<LyraFileTree>(html`<lr-file-tree label="Files" style="--show-duration:0ms"></lr-file-tree>`);
    el.nodes = [{ path: 'src', children: [{ path: 'src/lib', children: [{ path: 'src/lib/a.ts' }] }] }];
    await el.updateComplete;
    await innerTree(el).updateComplete;

    const reveal = el.revealPath('src/lib/a.ts');
    el.nodes = [{ path: 'other.ts' }];

    expect(await reveal).to.equal(false);
    await el.updateComplete;
    expect(rows(el).map((row) => row.nodeId)).to.deep.equal(['other.ts']);
  });

  it('reports loading while the provider is pending, then the settled rows', async () => {
    const ready = statusSource();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const pending: LyraHierarchySource<FileTreeNode, LyraHierarchyQuery> = {
      revision: 1,
      async project(request) { await gate; return ready.project(request); },
    };
    const el = await fixture<LyraFileTree>(html`<lr-file-tree label="Files" style="height: 200px"
      .strings=${{ loading: 'Fetching files' }}></lr-file-tree>`);
    el.treeSource = pending;
    await waitUntil(() => (el.shadowRoot!.textContent ?? '').includes('Fetching files'), 'loading state renders', { timeout: 2000 });
    expect(el.shadowRoot!.querySelectorAll('[part~="source-row"]').length).to.equal(0);

    release();
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part~="source-row"]').length === 2, 'rows render', { timeout: 2000 });
    expect((el.shadowRoot!.textContent ?? '').includes('Fetching files')).to.equal(false);
  });
});
