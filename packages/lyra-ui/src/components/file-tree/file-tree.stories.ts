import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './file-tree.js';
import type { FileTreeNode } from './file-tree.class.js';

const meta: Meta = {
  title: 'File Tree',
  component: 'lyra-file-tree',
  tags: ['autodocs'],
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
  render: () => html`<lyra-file-tree style="max-width:20rem" .nodes=${nodes}></lyra-file-tree>`,
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
    return html`<lyra-file-tree style="max-width:20rem" .nodes=${gitStatusNodes}></lyra-file-tree>`;
  },
};

/** A narrow host (320px), matching the library's baseline narrow-allocation check for a
 *  multi-column/badge-bearing row. */
export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lyra-file-tree .nodes=${nodes}></lyra-file-tree></div>`,
};

/** `hasChildren` with no `children` array renders a placeholder row and fires `lyra-load-children`
 *  on first expand; the host is expected to call `setChildren()` once the real listing arrives. */
export const LazyLoading: Story = {
  render: () => {
    const el = document.createElement('lyra-file-tree') as HTMLElement & {
      nodes: FileTreeNode[];
      setChildren: (path: string, children: FileTreeNode[]) => void;
    };
    el.style.maxWidth = '20rem';
    el.nodes = [{ path: 'lazy-dir', kind: 'directory', hasChildren: true }];
    el.addEventListener('lyra-load-children', ((e: CustomEvent<{ path: string }>) => {
      setTimeout(() => {
        el.setChildren(e.detail.path, [
          { path: `${e.detail.path}/loaded-a.ts` },
          { path: `${e.detail.path}/loaded-b.ts`, gitStatus: 'added' },
        ]);
      }, 500);
    }) as EventListener);
    return el;
  },
};
