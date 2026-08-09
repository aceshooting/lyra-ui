import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tree-item.js';

const meta: Meta = { title: 'Navigation/Tree node', component: 'lr-tree-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-tree-item .item=${{ id: 'root', label: 'Root', children: [] }}></lr-tree-item>` };

export const AccessibleNameOverride: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'A host `aria-label` is author-owned and remains authoritative when the assigned item or its `accessibleLabel` refreshes. Removing the host attribute restores the current data-model name.',
      },
    },
  },
  render: () => html`
    <div role="tree" aria-label="Cases" style="max-width: 20rem">
      <lr-tree-item
        aria-label="Author-defined case name"
        .item=${{
          id: 'case',
          label: 'C-42/24',
          accessibleLabel: 'Data-defined case name',
          children: [],
        }}
      ></lr-tree-item>
    </div>
  `,
};

/**
 * The declarative child model — no `item` object. The label is the default slot's content (or the
 * `label` attribute when nothing is slotted), and nested `<lr-tree-item>` children carry the
 * hierarchy; the component moves them onto its own internal `children` slot. Wrapped in a
 * `role="tree"` because a `treeitem` is only ARIA-valid inside one.
 */
export const Declarative: StoryObj = {
  render: () => html`
    <div role="tree" aria-label="Documentation" style="max-width: 20rem">
      <lr-tree-item expanded>
        Guides
        <lr-tree-item selected>Installation</lr-tree-item>
        <lr-tree-item label="Theming"></lr-tree-item>
        <lr-tree-item disabled>Coming soon</lr-tree-item>
      </lr-tree-item>
    </div>
  `,
};
