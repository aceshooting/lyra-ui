import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { DataGridColumn, DataGridRequest } from './data-grid.js';

interface DemoRow {
  id: number;
  name: string;
  team: string;
  score: number;
  joined: string;
  children?: DemoRow[];
}

const rows: DemoRow[] = [
  { id: 1, name: 'Ada Lovelace', team: 'Compiler', score: 97, joined: '2024-01-15' },
  { id: 2, name: 'Grace Hopper', team: 'Compiler', score: 94, joined: '2024-02-10' },
  { id: 3, name: 'Margaret Hamilton', team: 'Runtime', score: 99, joined: '2024-03-12' },
  { id: 4, name: 'Edsger Dijkstra', team: 'Runtime', score: 91, joined: '2024-04-20' },
  { id: 5, name: 'Barbara Liskov', team: 'Types', score: 96, joined: '2024-05-08' },
];

const columns: DataGridColumn<DemoRow>[] = [
  { field: 'name', label: 'Name', minWidth: 180, filterable: true, pinned: 'left' },
  { field: 'team', label: 'Team', filterable: true },
  { field: 'score', label: 'Score', align: 'end', aggregation: 'mean' },
  { field: 'joined', label: 'Joined', sortFn: 'datetime' },
];

const meta: Meta = {
  title: 'Data Grid',
  component: 'lr-data-grid',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Data grid with client and server processing. `selectedRows` is writable and maps current source-row objects onto `selectedKeys` for controlled selection.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-data-grid label="Engineering roster" .columns=${columns} .data=${rows}></lr-data-grid>
  `,
};

export const FullClientFeatures: Story = {
  render: () => html`
    <lr-data-grid
      label="Engineering roster"
      row-key="id"
      selectable="multiple"
      with-search
      with-column-menu
      with-columns-menu
      resizable
      reorderable
      pinnable
      paginate
      page-size="3"
      striped
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `,
};

export const Grouped: Story = {
  render: () => html`
    <lr-data-grid
      label="Roster grouped by team"
      group-by="team"
      row-key="id"
      selectable="multiple"
      .expandedKeys=${['group:root:team:string:Compiler', 'group:root:team:string:Runtime']}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `,
};

export const TreeAndDetails: Story = {
  render: () => {
    const treeRows: DemoRow[] = [{
      ...rows[0]!,
      children: [
        { id: 11, name: 'Parser', team: 'Compiler', score: 92, joined: '2024-06-01' },
        { id: 12, name: 'Optimizer', team: 'Compiler', score: 95, joined: '2024-06-02' },
      ],
    }];
    return html`
      <lr-data-grid
        label="Compiler work tree"
        child-rows="children"
        row-key="id"
        .expandedKeys=${[1]}
        .rowDetail=${(row: DemoRow) => html`<strong>${row.name}</strong> scored ${row.score}.`}
        .columns=${columns}
        .data=${treeRows}
      ></lr-data-grid>
    `;
  },
};

export const ServerData: Story = {
  render: () => html`
    <lr-data-grid
      label="Server roster"
      server
      paginate
      with-search
      page-size="2"
      .columns=${columns}
      .dataSource=${async (request: DataGridRequest) => {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const filtered = rows.filter((row) => row.name.toLowerCase().includes(request.search.toLowerCase()));
        const start = request.page * request.pageSize;
        return { rows: filtered.slice(start, start + request.pageSize), total: filtered.length };
      }}
    ></lr-data-grid>
  `,
};

export const CustomStates: Story = {
  render: () => html`
    <div style="display:grid;gap:var(--lr-space-l)">
      <lr-data-grid label="Empty roster" .columns=${columns} .data=${[]}>
        <p slot="empty">No engineers have been added.</p>
      </lr-data-grid>
      <lr-data-grid label="Loading roster" loading .columns=${columns} .data=${rows}>
        <strong slot="loading">Refreshing the roster…</strong>
      </lr-data-grid>
      <lr-data-grid
        label="Filtered roster"
        .searchTerm=${'not present'}
        .columns=${columns}
        .data=${rows}
      >
        <p slot="no-results">No engineers match the active filters.</p>
      </lr-data-grid>
    </div>
  `,
};

export const Virtualized: Story = {
  render: () => html`
    <lr-data-grid
      label="Large engineering roster"
      row-key="id"
      .columns=${columns}
      .data=${Array.from({ length: 120 }, (_value, index) => ({
        id: index + 1,
        name: `Engineer ${index + 1}`,
        team: `Team ${(index % 6) + 1}`,
        score: 70 + (index % 30),
        joined: `2024-${String((index % 12) + 1).padStart(2, '0')}-15`,
      }))}
    ></lr-data-grid>
  `,
};

export const NarrowRtl: Story = {
  render: () => html`
    <div dir="rtl" style="inline-size:320px">
      <lr-data-grid
        label="فريق الهندسة"
        with-search
        paginate
        page-size="3"
        .columns=${columns}
        .data=${rows}
      ></lr-data-grid>
    </div>
  `,
};
