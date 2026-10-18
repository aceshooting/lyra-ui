import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './neighbor-list.js';
import type { LyraNeighborRow } from './neighbor-list.class.js';

const meta: Meta = {
  title: 'Neighbor List',
  component: 'lr-neighbor-list',
};
export default meta;
type Story = StoryObj;

const rows: LyraNeighborRow[] = [
  { relation: 'works_for', direction: 'out', node: { id: 'org1', label: 'Acme Corp', type: 'org', degree: 3 } },
  { relation: 'works_for', direction: 'out', node: { id: 'org2', label: 'Sorbonne', type: 'org' } },
  { relation: 'married_to', direction: 'both', node: { id: 'p2', label: 'Pierre Curie', type: 'person' } },
  { relation: 'discovered', direction: 'in', node: { id: 'elem1', label: 'Polonium', type: 'element' } },
];

export const Default: Story = {
  render: () => html`<lr-neighbor-list .rows=${rows}></lr-neighbor-list>`,
};

export const Grouped: Story = {
  render: () => html`<lr-neighbor-list .rows=${rows} group-by-relation></lr-neighbor-list>`,
};

export const Expandable: Story = {
  render: () => html`<lr-neighbor-list .rows=${rows} expandable></lr-neighbor-list>`,
};

export const TypeLabels: Story = {
  render: () => html`<lr-neighbor-list
    .rows=${rows}
    .types=${[
      { id: 'org', label: 'Organization' },
      { id: 'person', label: 'Person' },
      { id: 'element', label: 'Chemical element' },
    ]}
  ></lr-neighbor-list>`,
};

export const Empty: Story = {
  render: () => html`<lr-neighbor-list></lr-neighbor-list>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;"><lr-neighbor-list .rows=${rows} group-by-relation></lr-neighbor-list></div>`,
};

/** The notice describes source admission, independently from row virtualization. */
export const InputLimit: Story = {
  render: () => html`<lr-neighbor-list .rows=${Array.from({ length: 10_001 }, (_, index) => ({
    relation: 'related', direction: 'out' as const, node: { id: `node-${index}`, label: `Node ${index}` },
  }))}></lr-neighbor-list>`,
};

/** Provider records are node neighborhoods; edge relation metadata is not inferred. */
export const SourceNeighborhood: Story = {
  render: () => {
    const total = 1_000_000;
    const row = (index: number) => ({ key: `node:${index}`, order: index,
      value: { kind: 'node' as const, value: { id: String(index), label: `Neighbor ${index}` } } });
    const source: import('./neighbor-list.class.js').NeighborListSource = {
      revision: 1,
      records: {
        revision: 1,
        query: async ({ page, pageSize }) => ({ rows: Array.from({ length: Math.min(pageSize, total - page * pageSize) }, (_, offset) => row(page * pageSize + offset)), total, summary: { nodes: total, edges: total } }),
        lookup: async keys => keys.filter(key => /^node:\d+$/.test(key) && Number(key.slice(5)) < total).map(key => row(Number(key.slice(5)))),
        locate: async key => /^node:\d+$/.test(key) && Number(key.slice(5)) < total ? Number(key.slice(5)) : null,
      },
      scene: async () => ({ nodes: [], edges: [], total: { nodes: total, edges: total }, coverage: 'neighborhood', worldBounds: null }),
    };
    return html`<lr-neighbor-list .graphSource=${source} .centerKey=${'node:center'} expandable></lr-neighbor-list>`;
  },
};
