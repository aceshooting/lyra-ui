import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tree-item.js';

const meta: Meta = { title: 'Navigation/Tree node', component: 'lr-tree-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-tree-item .item=${{ id: 'root', label: 'Root', children: [] }}></lr-tree-item>` };

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
