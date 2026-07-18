import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './neighbor-list.js';
import type { LyraNeighborRow } from './neighbor-list.class.js';

const meta: Meta = {
  title: 'Neighbor List',
  component: 'lyra-neighbor-list',
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
  render: () => html`<lyra-neighbor-list .rows=${rows}></lyra-neighbor-list>`,
};

export const Grouped: Story = {
  render: () => html`<lyra-neighbor-list .rows=${rows} group-by-relation></lyra-neighbor-list>`,
};

export const Expandable: Story = {
  render: () => html`<lyra-neighbor-list .rows=${rows} expandable></lyra-neighbor-list>`,
};

export const Empty: Story = {
  render: () => html`<lyra-neighbor-list></lyra-neighbor-list>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;"><lyra-neighbor-list .rows=${rows} group-by-relation></lyra-neighbor-list></div>`,
};
