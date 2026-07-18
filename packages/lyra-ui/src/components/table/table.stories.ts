import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, render } from 'lit';
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

export const ResizableColumns: Story = {
  render: () => html`
    <lyra-table
      .columns=${[
        { ...columns[0]!, width: '12rem', minWidth: '8rem', resizable: true },
        { ...columns[1]!, resizable: true },
      ]}
      .rows=${rows}
      @lyra-column-resize=${(event: CustomEvent) => console.log(event.detail)}
    ></lyra-table>
  `,
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

export const Filterable: Story = {
  render: () =>
    html`<lyra-table
      filterable
      .columns=${columns}
      .rows=${rows}
      .rowKey=${(r: DemoRow) => r.id}
    ></lyra-table>`,
};

export const Paginated: Story = {
  render: () =>
    html`<lyra-table
      page-size="2"
      .columns=${columns}
      .rows=${[
        ...rows,
        { id: 'd', name: 'Delta', score: 68 },
        { id: 'e', name: 'Epsilon', score: 64 },
      ]}
      .rowKey=${(r: DemoRow) => r.id}
    ></lyra-table>`,
};

export const Loading: Story = {
  render: () => html`<lyra-table loading .columns=${columns} .rows=${rows}></lyra-table>`,
};

const editableStoryColumns: TableColumn<DemoRow>[] = [
  { key: 'name', label: 'Name', editable: true, editValue: (r) => r.name, cell: (r) => r.name },
  { key: 'score', label: 'Score', editable: true, editType: 'number', editValue: (r) => r.score, cell: (r) => r.score },
];

export const EditableCells: Story = {
  render: () =>
    html`<lyra-table
      .columns=${editableStoryColumns}
      .rows=${rows}
      .rowKey=${(r: DemoRow) => r.id}
      @lyra-cell-edit=${(event: CustomEvent) => console.log(event.detail)}
    ></lyra-table>`,
};

export const GroupedRows: Story = {
  render: () =>
    html`<lyra-table
      .columns=${columns}
      .rows=${rows}
      .groupBy=${(r: DemoRow) => (r.score > 80 ? 'Passing' : 'Needs review')}
      .groupLabel=${(key: string | number, grouped: DemoRow[]) => html`<strong>${key}</strong> (${grouped.length})`}
    ></lyra-table>`,
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

// `show-all-columns` restores a previously-persisted reveal preference up
// front, instead of always starting collapsed.
export const PriorityColumnsRevealed: Story = {
  render: () =>
    html`<div style="max-width: 420px;">
      <lyra-table .columns=${priorityColumns} .rows=${detailRows} show-all-columns></lyra-table>
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

// expandedKeys is consumer-owned (mirrors selectedKey/sortKey) -- this story
// uses a plain module-level Set + a manual re-render to demonstrate the
// wiring a real consumer would do with their own framework's state.
const expandableExpandedKeys = new Set<string | number>();

function renderExpandableRows(): unknown {
  return html`<lyra-table
    .columns=${detailColumns}
    .rows=${detailRows}
    .rowKey=${(r: DetailRow) => r.id}
    .expandedContent=${(r: DetailRow) =>
      html`<div style="padding: 4px 8px;">
        <strong>${r.name}</strong> — region ${r.region}, updated ${r.updated}
      </div>`}
    .expandedKeys=${expandableExpandedKeys}
    @lyra-row-expand-toggle=${(e: CustomEvent<{ key: string | number }>) => {
      const key = e.detail.key;
      if (expandableExpandedKeys.has(key)) expandableExpandedKeys.delete(key);
      else expandableExpandedKeys.add(key);
      // Re-render this story's own root -- Storybook's `render()` return
      // value isn't reactive on its own, so force one by re-invoking it via
      // the same pattern lite-chart.stories.ts's own interactive stories use.
      const root = (e.currentTarget as HTMLElement).parentElement;
      if (root) render(renderExpandableRows(), root);
    }}
  ></lyra-table>`;
}

const detailColumns: TableColumn<DetailRow>[] = [
  { key: 'name', label: 'Name', cell: (r) => r.name },
  { key: 'score', label: 'Score', align: 'end', cell: (r) => r.score },
];

export const ExpandableRows: Story = {
  render: () => html`<div>${renderExpandableRows()}</div>`,
};

// canExpand opts a specific row out of the toggle entirely (e.g. an
// unconfigured provider with nothing to show) -- its leading cell renders
// empty instead of a button, and its key being in expandedKeys (it isn't,
// here) would still not render a panel for it.
export const ExpandableRowsWithOptOut: Story = {
  render: () =>
    html`<lyra-table
      .columns=${detailColumns}
      .rows=${detailRows}
      .rowKey=${(r: DetailRow) => r.id}
      .expandedContent=${(r: DetailRow) => html`<div style="padding: 4px 8px;">${r.name} details</div>`}
      .canExpand=${(r: DetailRow) => r.id !== 'c'}
      .expandedKeys=${new Set(['a'])}
    ></lyra-table>`,
};

interface PivotRow {
  id: string;
  project: string;
  mon: number;
  tue: number;
  wed: number;
}

const pivotColumns: TableColumn<PivotRow>[] = [
  { key: 'project', label: 'Project', cell: (r) => r.project },
  {
    key: 'mon',
    label: 'Mon',
    align: 'end',
    heatValue: (r) => r.mon,
    footer: (rs) => rs.reduce((sum, r) => sum + r.mon, 0),
    cell: (r) => r.mon,
  },
  {
    key: 'tue',
    label: 'Tue',
    align: 'end',
    heatValue: (r) => r.tue,
    footer: (rs) => rs.reduce((sum, r) => sum + r.tue, 0),
    cell: (r) => r.tue,
  },
  {
    key: 'wed',
    label: 'Wed',
    align: 'end',
    heatValue: (r) => r.wed,
    footer: (rs) => rs.reduce((sum, r) => sum + r.wed, 0),
    cell: (r) => r.wed,
  },
];

const pivotRows: PivotRow[] = [
  { id: 'a', project: 'Alpha', mon: 2, tue: 5, wed: 1 },
  { id: 'b', project: 'Beta', mon: 6, tue: 1, wed: 4 },
  { id: 'c', project: 'Gamma', mon: 0, tue: 3, wed: 7 },
];

// Demonstrates heat-tint mode (a shared scale across every hour-bucket column) and rowTotal/grandTotal
// together on a small entity x day-of-week pivot grid, mirroring cv-timesheet.ts's motivating shape.
export const PivotWithTotalsAndHeatTint: Story = {
  render: () =>
    html`<lyra-table
      .columns=${pivotColumns}
      .rows=${pivotRows}
      .rowKey=${(r: PivotRow) => r.id}
      .rowTotal=${(r: PivotRow) => r.mon + r.tue + r.wed}
      .grandTotal=${(rs: PivotRow[]) => rs.reduce((sum, r) => sum + r.mon + r.tue + r.wed, 0)}
    ></lyra-table>`,
};
