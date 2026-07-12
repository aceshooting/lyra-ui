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

export const NoColumnsConfigured: Story = {
  render: () => html`<lyra-table .columns=${[]} .rows=${rows}></lyra-table>`,
};

export const ActiveSort: Story = {
  render: () =>
    html`<lyra-table .columns=${columns} .rows=${rows} sort-key="score" sort-dir="desc"></lyra-table>`,
};

export const SelectedRow: Story = {
  render: () => html`<lyra-table .columns=${columns} .rows=${rows} .selectedKey=${'b'}></lyra-table>`,
};

export const LoadMore: Story = {
  render: () =>
    html`<lyra-table .columns=${columns} .rows=${rows} has-more more-label="Load more rows"></lyra-table>`,
};

interface DetailRow extends DemoRow {
  region: string;
  updated: string;
}

const detailRows: DetailRow[] = [
  { id: 'a', name: 'Alpha', score: 92, region: 'EU-West', updated: '2 min ago' },
  { id: 'b', name: 'Beta', score: 81, region: 'US-East', updated: '5 min ago' },
  { id: 'c', name: 'Gamma', score: 76, region: 'AP-South', updated: '1 hr ago' },
];

// Narrow the story's own container, so the `priority`-hidden columns below
// actually hide without needing to shrink the whole Storybook viewport.
const priorityColumns: TableColumn<DetailRow>[] = [
  { key: 'name', label: 'Name', sortable: true, sticky: true, cell: (r) => r.name },
  { key: 'score', label: 'Score', sortable: true, align: 'end', cell: (r) => r.score },
  { key: 'region', label: 'Region', priority: 'medium', cell: (r) => r.region },
  { key: 'updated', label: 'Updated', priority: 'low', cell: (r) => r.updated },
];

export const PriorityAndSticky: Story = {
  render: () =>
    html`<div style="max-width: 420px;">
      <lyra-table .columns=${priorityColumns} .rows=${detailRows}></lyra-table>
    </div>`,
};

// Same `priority` columns as PriorityAndSticky, but at a container width the
// `@container` breakpoints never actually hide anything at — demonstrates
// that `[part='reveal-columns-button']` correctly stays absent (rather than
// rendering as a permanent no-op control) when nothing is really hidden.
export const PriorityWideContainerNoButton: Story = {
  render: () =>
    html`<div style="max-width: 960px;">
      <lyra-table .columns=${priorityColumns} .rows=${detailRows}></lyra-table>
    </div>`,
};

// A <button> inside cell() must own its own click/Enter activation — the
// table's row-click delegation must not intercept it (see table.ts's
// INTERACTIVE_SELECTOR guard).
const actionColumns: TableColumn<DemoRow>[] = [
  { key: 'name', label: 'Name', cell: (r) => r.name },
  { key: 'score', label: 'Score', align: 'end', cell: (r) => r.score },
  {
    key: 'actions',
    label: 'Actions',
    cell: (r) =>
      html`<button type="button" @click=${() => alert(`Editing ${r.name}`)}>Edit</button>`,
  },
];

export const RowActions: Story = {
  render: () => html`<lyra-table .columns=${actionColumns} .rows=${rows}></lyra-table>`,
};
