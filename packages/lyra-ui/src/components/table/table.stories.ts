import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { TableColumn } from '../../lyra.js';

interface DemoRow {
  id: string;
  name: string;
  score: number;
}

const rows: DemoRow[] = [
  { id: 'a', name: 'Alpha', score: 92 },
  { id: 'b', name: 'Beta', score: 81 },
  { id: 'c', name: 'Gamma', score: 76 },
];

const columns: TableColumn<DemoRow>[] = [
  { key: 'name', label: 'Name', sortable: true, cell: (r) => r.name },
  { key: 'score', label: 'Score', sortable: true, align: 'end', cell: (r) => r.score },
];

const meta: Meta = {
  title: 'Table',
  component: 'lyra-table',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-table .columns=${columns} .rows=${rows}></lyra-table>`,
};

export const Empty: Story = {
  render: () => html`<lyra-table .columns=${columns} .rows=${[]}></lyra-table>`,
};
