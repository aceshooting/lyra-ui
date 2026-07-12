import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { TreeItem } from '../../lyra.js';

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
  component: 'lyra-tree',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-tree style="max-width: 20rem" label="File explorer" .data=${data}></lyra-tree>`,
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
        <lyra-tree id="imperative-tree" label="File explorer" .data=${data}></lyra-tree>
      </div>
    `;
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
    html`<lyra-tree style="max-width: 20rem" label="Deeply nested example" .data=${buildDeepData(12)}></lyra-tree>`,
  play: async ({ canvasElement }) => {
    const tree = canvasElement.querySelector('lyra-tree') as HTMLElement & { expandAll: () => void };
    tree.expandAll();
  },
};
