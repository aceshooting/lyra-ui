import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraTreeNodeData } from '../../../lyra.js';

const data: LyraTreeNodeData[] = [
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

/**
 * Data-model children live behind another shadow root at every depth. This one selector matches
 * only the generated top-level host, whose same-name part forwarding carries the theme through
 * every recursively rendered child.
 */
export const RecursivePartTheming: Story = {
  render: () => html`
    <style>
      lr-tree.recursive-parts-demo > lr-tree-item::part(row) {
        border-inline-start: var(--lr-border-width-medium) solid var(--lr-color-brand);
        background: var(--lr-color-brand-quiet);
      }

      lr-tree.recursive-parts-demo > lr-tree-item::part(label) {
        color: var(--lr-color-brand);
        font-weight: var(--lr-font-weight-semibold);
      }
    </style>
    <lr-tree
      class="recursive-parts-demo"
      style="max-inline-size: var(--lr-size-20rem)"
      label="Documentation"
      .data=${[
        {
          id: 'guides',
          label: 'Guides',
          children: [
            {
              id: 'installation',
              label: 'Installation',
              children: [{ id: 'setup', label: 'Setup' }],
            },
          ],
        },
      ] satisfies LyraTreeNodeData[]}
    ></lr-tree>
  `,
  play: async ({ canvasElement }) => {
    const tree = canvasElement.querySelector('lr-tree') as HTMLElement & { expandAll: () => Promise<void> };
    await tree.expandAll();
  },
};

/**
 * The declarative child model: nested `<lr-tree-item>` elements, no `data` property anywhere. Each
 * item's label is its own slotted content (or its `label` attribute), and `expanded`/`disabled`/
 * `selected` are plain attributes. This is the shape `wa-tree`/`sl-tree` markup renames into.
 */
export const DeclarativeItems: Story = {
  render: () => html`
    <lr-tree style="max-width: 20rem" label="Documentation">
      <lr-tree-item expanded>
        Guides
        <lr-tree-item selected>Installation</lr-tree-item>
        <lr-tree-item>Theming</lr-tree-item>
        <lr-tree-item disabled>Coming soon</lr-tree-item>
      </lr-tree-item>
      <lr-tree-item label="Components">
        <lr-tree-item label="lr-button"></lr-tree-item>
        <lr-tree-item label="lr-tree"></lr-tree-item>
      </lr-tree-item>
      <lr-tree-item>Changelog</lr-tree-item>
    </lr-tree>
  `,
};

/** Multiple selection displays checkboxes, cascades branch selection, and derives indeterminate parents. */
export const MultipleSelection: Story = {
  render: () => html`
    <lr-tree style="max-width: 20rem" label="Release contents" selection="multiple">
      <lr-tree-item expanded>
        Packages
        <lr-tree-item selected>Core</lr-tree-item>
        <lr-tree-item>Icons</lr-tree-item>
        <lr-tree-item disabled>Private fixtures</lr-tree-item>
      </lr-tree-item>
      <lr-tree-item>Documentation</lr-tree-item>
    </lr-tree>
  `,
};

/** Invalid duplicate data ids remain visible for diagnosis, but only their first depth-first
 * occurrence owns the public identity; later rows fail closed as disabled. */
export const InvalidDuplicateIds: Story = {
  render: () => html`
    <lr-tree
      style="max-width: 20rem"
      label="Import preview with duplicate ids"
      .data=${[
        { id: 'shared', label: 'Canonical shared record' },
        { id: 'shared', label: 'Conflicting shared record' },
        { id: 'unique', label: 'Unique record' },
      ] satisfies LyraTreeNodeData[]}
    ></lr-tree>
  `,
};

/** Large object trees are snapshotted and bounded on assignment. A collapsed branch does not
 * instantiate any of its descendants; disclosure projects only the accepted prefix while keeping
 * the declared sibling count in ARIA. */
export const BoundedLazyProjection: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The 1,005-child input is intentionally over the 1,000-node budget. Inspect `dataTruncated`, then expand the row to see lazy descendant projection.',
      },
    },
  },
  render: () => html`
    <lr-tree
      style="max-inline-size:var(--lr-size-20rem); --show-duration:0ms"
      label="Bounded import"
      .data=${[
        {
          id: 'root',
          label: 'Imported records (1,005 declared)',
          children: Array.from({ length: 1_005 }, (_, index) => ({
            id: `record-${index}`,
            label: `Record ${index + 1}`,
          })),
        },
      ] satisfies LyraTreeNodeData[]}
    ></lr-tree>
  `,
};

export const RetintedSelectionCheckboxes: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Checked and indeterminate checkbox foregrounds, backgrounds, and borders are independently themeable.',
      },
    },
  },
  render: () => html`
    <div
      style="--lr-tree-checkbox-checked-border-color: var(--lr-color-success); --lr-tree-checkbox-checked-bg: var(--lr-color-success-quiet); --lr-tree-checkbox-checked-color: var(--lr-color-success); --lr-tree-checkbox-indeterminate-border-color: var(--lr-color-warning); --lr-tree-checkbox-indeterminate-bg: var(--lr-color-warning-quiet); --lr-tree-checkbox-indeterminate-color: var(--lr-color-warning)"
    >
      <lr-tree style="max-width: var(--lr-size-20rem)" label="Themed selection" selection="multiple">
        <lr-tree-item expanded>
          Partially selected package
          <lr-tree-item selected>Selected child</lr-tree-item>
          <lr-tree-item>Unselected child</lr-tree-item>
        </lr-tree-item>
        <lr-tree-item selected>Fully selected package</lr-tree-item>
      </lr-tree>
    </div>
  `,
};

/** Tree-wide icons are inherited by every disclosure; an item-level slot can override either one. */
export const CustomDisclosureIcons: Story = {
  render: () => html`
    <lr-tree style="max-width: 20rem" label="Custom disclosure icons">
      <span slot="collapse-icon" aria-hidden="true">⊞</span>
      <span slot="expand-icon" aria-hidden="true">⊟</span>
      <lr-tree-item>
        Guides
        <lr-tree-item>Installation</lr-tree-item>
        <lr-tree-item>Theming</lr-tree-item>
      </lr-tree-item>
      <lr-tree-item>
        Components
        <span slot="collapse-icon" aria-hidden="true">＋</span>
        <span slot="expand-icon" aria-hidden="true">−</span>
        <lr-tree-item>Tree</lr-tree-item>
      </lr-tree-item>
    </lr-tree>
  `,
};

/** Lazy items request children once and remain visibly busy until content arrives. */
export const LazyLoading: Story = {
  render: () => {
    const latestGeneration = new WeakMap<HTMLElement, number>();
    const loadChildren = (
      event: CustomEvent<{
        item: HTMLElement & { lazy: boolean; loading: boolean };
        generation: number;
      }>
    ): void => {
      const { item, generation } = event.detail;
      latestGeneration.set(item, generation);
      window.setTimeout(() => {
        if (!item.isConnected || !item.loading || latestGeneration.get(item) !== generation) return;
        for (const label of ['Birch', 'Cedar', 'Maple', 'Pine']) {
          const child = document.createElement(item.localName);
          child.setAttribute('label', label);
          item.appendChild(child);
        }
        item.lazy = false;
      }, 450);
    };
    return html`
      <lr-tree style="max-width: 20rem" label="Available trees" @lr-lazy-load=${loadChildren}>
        <lr-tree-item lazy>Available trees</lr-tree-item>
      </lr-tree>
    `;
  },
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
          accessibleLabel: 'Case C-42/24, Commission v Example, Grand Chamber judgment, 14 July 2026',
          badges: [{ text: '12', label: '12 related filings' }],
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
      ] satisfies LyraTreeNodeData[]}
    ></lr-tree>
  `,
};

export const RetintedBadges: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Every badge tone exposes independent foreground and background hooks without changing the tree selection colors.',
      },
    },
  },
  render: () => html`
    <lr-tree
      style="
        max-width:20rem;
        --lr-tree-badge-brand-color: var(--lr-color-danger);
        --lr-tree-badge-brand-bg: var(--lr-color-danger-quiet);
        --lr-tree-badge-success-color: var(--lr-color-brand);
        --lr-tree-badge-success-bg: var(--lr-color-brand-quiet);
        --lr-tree-badge-warning-color: var(--lr-color-success);
        --lr-tree-badge-warning-bg: var(--lr-color-success-quiet);
        --lr-tree-badge-danger-color: var(--lr-color-warning);
        --lr-tree-badge-danger-bg: var(--lr-color-warning-quiet);
      "
      label="Retinted badge tones"
      .data=${[
        {
          id: 'root',
          label: 'Build',
          badges: [
            { text: 'Brand', tone: 'brand' },
            { text: 'Ready', tone: 'success' },
            { text: 'Wait', tone: 'warning' },
            { text: 'Fail', tone: 'danger' },
          ],
        },
      ] satisfies LyraTreeNodeData[]}
    ></lr-tree>
  `,
};

/** Demonstrates the imperative `expandAll()`/`collapseAll()` methods. */
export const ExpandCollapseAll: Story = {
  render: () => {
    const getTree = () =>
      document.getElementById('imperative-tree') as HTMLElement & {
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
 * and reassigns `data`; focus follows the moved row and the success announcement fires only after
 * that rendered order confirms the request. The move is sibling-scoped: Ctrl+ArrowDown on the last
 * child of a subtree does nothing rather than reparenting it.
 */
export const Reorderable: Story = {
  render: () => {
    const seed: LyraTreeNodeData[] = [
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
      const tree = event.currentTarget as HTMLElement & { data: LyraTreeNodeData[] };
      const { parentNodeId, fromIndex, toIndex } = (
        event as CustomEvent<{ parentNodeId: string | null; fromIndex: number; toIndex: number }>
      ).detail;
      const move = (list: LyraTreeNodeData[]): LyraTreeNodeData[] => {
        const next = [...list];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      };
      const apply = (list: LyraTreeNodeData[]): LyraTreeNodeData[] =>
        list.map((item) =>
          item.id === parentNodeId && item.children
            ? { ...item, children: move(item.children) }
            : item.children
            ? { ...item, children: apply(item.children) }
            : item
        );
      tree.data = parentNodeId === null ? move(tree.data) : apply(tree.data);
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

const buildDeepData = (depth: number): LyraTreeNodeData[] => {
  let node: LyraTreeNodeData = { id: `d${depth}`, label: `A very long deeply-nested label all the way at depth ${depth}` };
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

/** All five mirrored indentation properties are consumed by each item; this example sets them on
 * the root item so its generated descendants inherit the same guide treatment. */
export const CustomIndentGuides: Story = {
  render: () => html`
    <lr-tree style="max-inline-size: var(--lr-size-20rem)" label="Custom indentation guides">
      <lr-tree-item
        expanded
        style="
          --indent-size: var(--lr-space-2xl);
          --indent-guide-color: var(--lr-color-brand);
          --indent-guide-offset: var(--lr-space-2xs);
          --indent-guide-style: dashed;
          --indent-guide-width: var(--lr-border-width-medium);
        "
      >
        Guides
        <lr-tree-item expanded>
          Components
          <lr-tree-item>Tree item</lr-tree-item>
        </lr-tree-item>
      </lr-tree-item>
    </lr-tree>
  `,
};
