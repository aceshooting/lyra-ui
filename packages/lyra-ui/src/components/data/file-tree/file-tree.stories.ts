import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './file-tree.js';
import type { FileTreeNode } from './file-tree.class.js';

const meta: Meta = {
  title: 'File Tree',
  component: 'lr-file-tree',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A path-keyed file explorer. Each assignment creates a frozen, clone-owned model from at most the first 10,000 inspected source positions across 64 descendant levels; reassign after changes. A localized `limit` notice appears when 10,000 valid source items are retained and more remain. Empty and blank paths are omitted; the first successfully admitted occurrence owns each path. A record with unreadable optional metadata cannot suppress a later valid file at the same path.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const nodes: FileTreeNode[] = [
  {
    path: 'src',
    kind: 'directory',
    children: [
      { path: 'src/app.ts', gitStatus: 'modified', additions: 12, deletions: 3 },
      { path: 'src/util.ts', gitStatus: 'added', additions: 40 },
      { path: 'src/legacy.ts', gitStatus: 'deleted', deletions: 20 },
    ],
  },
  { path: 'node_modules', kind: 'directory', hasChildren: true },
  { path: 'README.md' },
  { path: 'package.json', gitStatus: 'modified', additions: 1, deletions: 1 },
];

export const Default: Story = {
  render: () => html`<lr-file-tree style="max-width:20rem" .nodes=${nodes}></lr-file-tree>`,
};

/** Every `GitStatus` value at once, so each badge tone/letter mapping can be checked side by side. */
export const GitStatusBadges: Story = {
  render: () => {
    const gitStatusNodes: FileTreeNode[] = [
      { path: 'added.ts', gitStatus: 'added', additions: 30 },
      { path: 'modified.ts', gitStatus: 'modified', additions: 5, deletions: 2 },
      { path: 'deleted.ts', gitStatus: 'deleted', deletions: 18 },
      { path: 'renamed.ts', gitStatus: 'renamed' },
      { path: 'untracked.ts', gitStatus: 'untracked' },
      { path: 'conflicted.ts', gitStatus: 'conflicted' },
      { path: 'ignored.log', gitStatus: 'ignored' },
    ];
    return html`<lr-file-tree style="max-width:20rem" .nodes=${gitStatusNodes}></lr-file-tree>`;
  },
};

/** A narrow host (320px), matching the library's baseline narrow-allocation check for a
 *  multi-column/badge-bearing row. */
export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lr-file-tree .nodes=${nodes}></lr-file-tree></div>`,
};

/** `hasChildren` with no `children` array renders a placeholder row and fires `lr-load-children`
 *  on first expand; the host is expected to call `setChildren()` once the real listing arrives. */
export const LazyLoading: Story = {
  render: () => {
    const el = document.createElement('lr-file-tree') as HTMLElement & {
      nodes: readonly FileTreeNode[];
      setChildren: (path: string, children: FileTreeNode[]) => void;
    };
    el.style.maxWidth = '20rem';
    el.nodes = [{ path: 'lazy-dir', kind: 'directory', hasChildren: true }];
    el.addEventListener('lr-load-children', ((e: CustomEvent<{ filePath: string }>) => {
      setTimeout(() => {
        el.setChildren(e.detail.filePath, [
          { path: `${e.detail.filePath}/loaded-a.ts` },
          { path: `${e.detail.filePath}/loaded-b.ts`, gitStatus: 'added' },
        ]);
      }, 500);
    }) as EventListener);
    return el;
  },
};

/** Raise the bounded projection budget while retaining the default when max-nodes is omitted. */
export const RaisedNodeLimit: Story = {
  render: () => html`<lr-file-tree label="Larger collection" max-nodes="1200"
    .nodes=${Array.from({length:1100},(_,index)=>({path:`file-${index + 1}.ts`}))}></lr-file-tree>`,
};

/** The application owns full storage and lookup; the component retains only its displayed window. */
export const IndexedSource: Story = {
  render: () => {
    let selected: string | undefined;
    let revision = 0;
    const source: import('./file-tree.class.js').FileTreeSource = { revision: 1, async project(request) {
      if (request.action.type === 'select') selected = request.action.selected ? request.action.key : undefined;
      const snapshot = selected;
      return { state: String(++revision), total: 1_000_000,
        rows: { count: 1_000_000, keyAt: index => `record-${index}`,
          indexOfKey: (key: string | number) => Number(String(key).slice(7)),
          itemAt(index) { const key = `record-${index}`; return { key, value: { path: key, name: `Document ${index + 1}.txt`, kind: 'file' }, parentKey: null,
            level: 1, position: index + 1, setSize: 1_000_000, childCount: 0, expanded: false, selected: key === snapshot }; },
        }, ...(request.action.type === 'reveal' ? { focusIndex: Number(request.action.key.slice(7)) } : {}),
      };
    } };
    return html`<style>
      lr-file-tree.source-demo::part(source-list) { border: var(--lr-border-width-thin) solid var(--lr-color-border); }
      lr-file-tree.source-demo::part(source-label) { font-weight: var(--lr-font-weight-medium); }
    </style><p>Use End to reach the millionth record. Selection is an immutable provider projection.</p>
    <lr-file-tree class="source-demo" label="Indexed records" .treeSource=${source}></lr-file-tree>`;
  },
};
