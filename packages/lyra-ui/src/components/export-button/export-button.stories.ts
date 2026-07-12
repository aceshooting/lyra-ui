import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { CsvColumn } from '../../lyra.js';

const rows = [
  { id: 'a', name: 'Alpha', score: 92 },
  { id: 'b', name: 'Beta', score: 81 },
  { id: 'c', name: 'Gamma', score: 76 },
];

const columns: CsvColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'score', label: 'Score' },
];

const meta: Meta = {
  title: 'ExportButton',
  component: 'lyra-export-button',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const SingleFormat: Story = {
  render: () => html`
    <lyra-export-button filename="demo" .rows=${rows} .columns=${columns}></lyra-export-button>
  `,
};

export const MultiFormatMenu: Story = {
  render: () => html`
    <lyra-export-button
      filename="demo"
      .rows=${rows}
      .columns=${columns}
      .formats=${['csv', 'json']}
    ></lyra-export-button>
  `,
};
