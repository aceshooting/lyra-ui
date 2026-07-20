import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { TreeItem } from '../../../lyra.js';

const data: TreeItem[] = [
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

const meta: Meta = {
  title: 'Tree',
  component: 'lr-tree',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-tree style="max-width: 20rem" label="File explorer" .data=${data}></lr-tree>`,
};

export const RichRows: Story = {
  render: () => html`
    <lr-tree
      style="max-width: 20rem"
      label="Case hierarchy"
      .data=${[
        {
          id: 'judgment',
          label: 'C-42/24 — Commission v Example',
          description: 'Grand Chamber · Judgment · 14 July 2026',
          accessibleLabel:
            'Case C-42/24, Commission v Example, Grand Chamber judgment, 14 July 2026',
          badge: 12,
          icon: html`<svg aria-hidden="true" viewBox="0 0 16 16" width="1em" height="1em">
            <circle cx="8" cy="8" r="6" fill="currentColor"></circle>
          </svg>`,
          children: [
            {
              id: 'opinion',
              label: 'Opinion of the Advocate General',
              description: 'Delivered 20 February 2026',
              icon: html`<span aria-hidden="true">◇</span>`,
            },
          ],
        },
      ] satisfies TreeItem[]}
    ></lr-tree>
  `,
};

/** Demonstrates the imperative `expandAll()`/`collapseAll()` methods. */
export const ExpandCollapseAll: Story = {
  render: () => {
    const getTree = () => document.getElementById('imperative-tree') as HTMLElement & {
      expandAll: () => void;
      collapseAll: () => void;
    };
    return html`
      <div style="display:flex; flex-direction:column; gap:1rem; max-width:20rem">
        <div style="display:flex; gap:0.5rem">
          <button @click=${() => getTree().expandAll()}>Expand all</button>
          <button @click=${() => getTree().collapseAll()}>Collapse all</button>
        </div>
        <lr-tree id="imperative-tree" label="File explorer" .data=${data}></lr-tree>
      </div>
    `;
  },
};

/**
 * `reorderable` opts into keyboard reordering. Focus a row and press
 * **Ctrl/Cmd+ArrowUp / Ctrl/Cmd+ArrowDown** to move it within its own parent's child list.
 * `lr-reorder` is only a *request* — `data` is host-owned, so this story applies the move itself
 * and reassigns `data`; focus follows the moved row. The move is sibling-scoped: Ctrl+ArrowDown on
 * the last child of a subtree does nothing rather than reparenting it.
 */
export const Reorderable: Story = {
  render: () => {
    const seed: TreeItem[] = [
      {
        id: 'inputs',
        label: 'Inputs',
        children: [
          { id: 'in-1', label: 'Customer id' },
          { id: 'in-2', label: 'Date range' },
          { id: 'in-3', label: 'Currency' },
        ],
      },
      {
        id: 'outputs',
        label: 'Outputs',
        children: [
          { id: 'out-1', label: 'Report url' },
          { id: 'out-2', label: 'Row count' },
        ],
      },
    ];
    const onReorder = (event: Event): void => {
      const tree = event.currentTarget as HTMLElement & { data: TreeItem[] };
      const { parentId, fromIndex, toIndex } = (
        event as CustomEvent<{ parentId: string | null; fromIndex: number; toIndex: number }>
      ).detail;
      const move = (list: TreeItem[]): TreeItem[] => {
        const next = [...list];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      };
      const apply = (list: TreeItem[]): TreeItem[] =>
        list.map((item) =>
          item.id === parentId && item.children
            ? { ...item, children: move(item.children) }
            : item.children
              ? { ...item, children: apply(item.children) }
              : item,
        );
      tree.data = parentId === null ? move(tree.data) : apply(tree.data);
    };
    return html`
      <lr-tree
        style="max-width: 20rem"
        label="Workflow slots"
        reorderable
        .data=${seed}
        @lr-reorder=${onReorder}
      ></lr-tree>
    `;
  },
  play: async ({ canvasElement }) => {
    const tree = canvasElement.querySelector('lr-tree') as HTMLElement & {
      expandAll: () => Promise<void> | void;
    };
    await tree.expandAll();
  },
};

const buildDeepData = (depth: number): TreeItem[] => {
  let node: TreeItem = { id: `d${depth}`, label: `A very long deeply-nested label all the way at depth ${depth}` };
  for (let d = depth - 1; d >= 0; d--) {
    node = { id: `d${d}`, label: `Level ${d} node with a fairly long descriptive label`, children: [node] };
  }
  return [node];
};

/** A single branch nested well past the 8rem indentation cap, so the capped indent and truncated label are both visible without expanding anything by hand. */
export const DeeplyNested: Story = {
  render: () =>
    html`<lr-tree style="max-width: 20rem" label="Deeply nested example" .data=${buildDeepData(12)}></lr-tree>`,
  play: async ({ canvasElement }) => {
    const tree = canvasElement.querySelector('lr-tree') as HTMLElement & { expandAll: () => void };
    tree.expandAll();
  },
};
