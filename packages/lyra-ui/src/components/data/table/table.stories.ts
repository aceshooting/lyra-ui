import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, render } from 'lit';
import type { TableColumn } from './table.class.js';
import { narrowStoryFrames } from '../../../../../../.storybook/narrow-story.js';

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
  component: 'lr-table',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A bounded sort/select-aware grid. Column inspection stops after the first 10,000 source positions; columns, rows, selected keys, and expanded keys are detached at assignment and capped at 10,000 retained entries. Malformed and whitespace-only controlled keys are omitted while valid off-page keys remain available for server pagination. Key reads expose immutable ReadonlySet facades, and consumers reassign collections after changes. Unique nonempty column and row keys are first-wins before render, counts, focus, actions, and events. A bare table projects at most 100 rows per page; sortable headers emit a cancelable lr-sort-request followed by lr-sort only when accepted. Built-in filter/loading/empty/more/column-toggle copy localizes only while its optional override is omitted; supplied strings, including empty strings, render verbatim.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-table .columns=${columns} .rows=${rows}></lr-table>`,
};

export const ResizableColumns: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Drag a separator, or focus it and use ArrowLeft/ArrowRight (10px), Shift+Arrow (50px), Home, and End. The numeric ARIA range stays in CSS pixels while the current value is localized for assistive technology.',
      },
    },
  },
  render: () => html`
    <lr-table
      lang="ar-EG"
      .strings=${{ resizeValuePixels: 'العرض {value} بكسل' }}
      .columns=${[
        { ...columns[0]!, width: '192px', minWidth: '128px', maxWidth: '320px', resizable: true },
        { ...columns[1]!, resizable: true },
      ]}
      .rows=${rows}
      @lr-column-resize=${(event: CustomEvent) => console.log(event.detail)}
    ></lr-table>
  `,
};

export const Empty: Story = {
  render: () => html`<lr-table .columns=${columns} .rows=${[]}></lr-table>`,
};

export const NoColumnsConfigured: Story = {
  render: () => html`<lr-table .columns=${[]} .rows=${rows}></lr-table>`,
};

export const EmptyStateAddressability: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The built-in empty state carries `part="empty"` and re-exports its inner parts as `empty-heading`/`empty-description`/`empty-icon`/`empty-actions`/`empty-base`, so it can be restyled without replacing it. `empty-compact` overrides each branch’s built-in density. The `empty` slot replaces it wholesale on the two data-empty branches; the no-columns branch keeps its own configuration-problem copy.',
      },
    },
  },
  render: () => html`
    <style>
      .styled-empty::part(empty-heading) {
        color: var(--lr-color-danger);
      }
    </style>
    <lr-table class="styled-empty" .columns=${columns} .rows=${[]} empty-heading="Nothing to show"></lr-table>
    <lr-table .columns=${columns} .rows=${[]} empty-compact></lr-table>
    <lr-table .columns=${columns} .rows=${[]}>
      <div slot="empty" style="padding: 1rem; text-align: center">
        <p>No scores recorded yet.</p>
        <button type="button">Import a spreadsheet</button>
      </div>
    </lr-table>
  `,
};

const titledColumns: TableColumn<DemoRow>[] = [
  {
    key: 'name',
    label: 'Name',
    cellTitle: (r) => `Row id ${r.id} — ${r.name}`,
    cell: (r) => r.name,
  },
  { key: 'score', label: 'Score', align: 'end', cell: (r) => r.score },
];

export const CellTitles: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`columns[].cellTitle(row)` sets the generated `<td>`’s native `title`, symmetrical with `cellStyle`. Returning `undefined` or an empty string omits the attribute entirely (an empty `title=""` would suppress an ancestor’s tooltip), and the attribute is suppressed while that cell is being edited. Use it only for a longer form of what the cell already shows — some screen readers announce a `<td title>` as the cell’s accessible name.',
      },
    },
  },
  render: () => html`<lr-table .columns=${titledColumns} .rows=${rows} .rowKey=${(r: DemoRow) => r.id}></lr-table>`,
};

export const FixedLayout: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`layout="fixed"` forces `table-layout: fixed` with no column widths declared, so columns share the width evenly instead of sizing to their content. It is a floor, not an override: the default `layout="auto"` still resolves to fixed as soon as a column declares a `width` or a drag-resize starts. Under `fixed` with no widths the first row decides every column’s width, and `minWidth`/`maxWidth` are ignored.',
      },
    },
  },
  render: () => html`
    <lr-table
      layout="fixed"
      .columns=${[
        { key: 'name', label: 'Name', cell: (r: DemoRow) => r.name },
        { key: 'score', label: 'Score', align: 'end', cell: (r: DemoRow) => r.score },
        { key: 'note', label: 'Note', cell: () => 'A deliberately long note that would otherwise widen its column.' },
      ]}
      .rows=${rows}
      .rowKey=${(r: DemoRow) => r.id}
    ></lr-table>
  `,
};

const responsiveScrollColumns: TableColumn<DemoRow>[] = [
  { key: 'name', label: 'Long localized account name', cell: (row) => row.name },
  { key: 'score', label: 'Current quality score', align: 'end', cell: (row) => row.score },
  { key: 'id', label: 'Persistent external identifier', cell: (row) => row.id },
];

export const ResponsiveScroll: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`scroll-mode="auto"` leaves the table in ordinary page flow while these columns fit, so a sticky header can follow the page. Narrow the canvas to 320px and the same rendered table becomes its own horizontal scrollport instead of widening the page. The existing `self` default and explicit `page` mode remain unchanged.',
      },
    },
  },
  render: () => html`
    <div style="inline-size: min(100%, 60rem)">
      <lr-table
        scroll-mode="auto"
        accessible-label="Accounts"
        .columns=${responsiveScrollColumns}
        .rows=${rows}
      ></lr-table>
    </div>
  `,
};

export const SelectedRowColor: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-table-row-selected-bg` recolors the `aria-selected` row on its own. Shadow Parts forbids an attribute selector after `::part()`, so `::part(row)[aria-selected]` is invalid CSS — without this property the only way to restyle the selected row was to override the library-wide `--lr-color-brand-quiet` token. Unset, it renders exactly as before.',
      },
    },
  },
  render: () => html`
    <lr-table
      style="--lr-table-row-selected-bg: var(--lr-color-success-quiet)"
      selection-mode="single"
      .columns=${columns}
      .rows=${rows}
      .rowKey=${(r: DemoRow) => r.id}
      .selectedRowKeys=${new Set(['b'])}
    ></lr-table>
  `,
};

export const ActiveSort: Story = {
  render: () => html`<lr-table .columns=${columns} .rows=${rows} sort-key="score" sort-dir="desc"></lr-table>`,
};

export const SortTransaction: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Activate a sortable header to see the canonical frozen request/commit vocabulary. Preventing lr-sort-request would leave sort state unchanged and suppress the commit.',
      },
    },
  },
  render: () => {
    const report = (event: CustomEvent): void => {
      const output = (event.currentTarget as HTMLElement).parentElement?.querySelector('output');
      if (output) output.textContent = `${event.type}: ${JSON.stringify(event.detail)}`;
    };
    return html`
      <div style="display:grid;gap:var(--lr-space-s)">
        <lr-table
          accessible-label="Transactional sorting"
          .columns=${columns}
          .rows=${rows}
          @lr-sort-request=${report}
          @lr-sort=${report}
        ></lr-table>
        <output aria-live="polite">Activate a sortable header</output>
      </div>
    `;
  },
};

export const SelectedRow: Story = {
  render: () => html`
    <lr-table
      selection-mode="single"
      .columns=${columns}
      .rows=${rows}
      .selectedRowKeys=${new Set(['b'])}
    ></lr-table>
  `,
};

export const ControlledCollectionFocus: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The first button focuses the final roving row and then removes it from the controlled `rows` array. Focus clamps to the nearest surviving row, so ArrowUp/ArrowDown keep working. Reordering while a keyed row survives preserves that logical row; moving focus outside before an update prevents restoration.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s);">
      <div style="display: flex; gap: var(--lr-space-xs); flex-wrap: wrap;">
        <button
          type="button"
          @click=${(event: Event) => {
            const table = (event.currentTarget as HTMLElement)
              .closest('div')
              ?.parentElement?.querySelector('lr-table') as HTMLElement & {
              rows: readonly DemoRow[];
              shadowRoot: ShadowRoot;
            };
            const renderedRows = table?.shadowRoot.querySelectorAll<HTMLElement>('[part="row"]');
            renderedRows?.[renderedRows.length - 1]?.focus();
            if (table) table.rows = table.rows.slice(0, -1);
          }}
        >
          Focus and remove last row
        </button>
        <button
          type="button"
          @click=${(event: Event) => {
            const table = (event.currentTarget as HTMLElement)
              .closest('div')
              ?.parentElement?.querySelector('lr-table') as (HTMLElement & { rows: readonly DemoRow[] }) | null;
            if (table) table.rows = rows;
          }}
        >
          Reset rows
        </button>
      </div>
      <lr-table
        accessible-label="Controlled collection focus"
        .columns=${columns}
        .rows=${rows}
        .rowKey=${(row: DemoRow) => row.id}
      ></lr-table>
    </div>
  `,
};

export const LoadMore: Story = {
  render: () => html`<lr-table .columns=${columns} .rows=${rows} has-more more-label="Load more rows"></lr-table>`,
};

export const Filterable: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Typing publishes only the table-level `lr-filter-change` contract; the internal native `input` and `change` events stay contained.',
      },
    },
  },
  render: () =>
    html`<lr-table filterable .columns=${columns} .rows=${rows} .rowKey=${(r: DemoRow) => r.id}></lr-table>`,
};

export const Paginated: Story = {
  render: () =>
    html`<lr-table
      page-size="2"
      .columns=${columns}
      .rows=${[...rows, { id: 'd', name: 'Delta', score: 68 }, { id: 'e', name: 'Epsilon', score: 64 }]}
      .rowKey=${(r: DemoRow) => r.id}
    ></lr-table>`,
};

export const Loading: Story = {
  render: () => html`<lr-table loading .columns=${columns} .rows=${rows}></lr-table>`,
};

export const LoadingBeforeSchema: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Loading takes precedence while the column schema is unresolved. Even when skeleton appearance is requested, the table shows its spinner until columns arrive instead of flashing the no-columns empty state; once columns are supplied, the same loading state can render the schema-shaped skeleton.',
      },
    },
  },
  render: () => html`<lr-table loading loading-appearance="skeleton" .columns=${[]}></lr-table>`,
};

export const LoadingSkeleton: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`loading-appearance="skeleton"` keeps the real `<colgroup>`/`<thead>` (plus any filter and pagination chrome) and fills the body with placeholder rows, so the grid holds its shape on a cold load instead of flashing a spinner. Declare `columns[].width` or `layout="fixed"` to keep column widths pixel-identical once real rows land. Placeholder count comes from `skeleton-rows`, else the page size, else 3; both explicit and derived counts are capped at 20. Each post-mount transition into loading is announced once through the shared light-DOM polite sink.',
      },
    },
  },
  render: () => html`<lr-table
    loading
    loading-appearance="skeleton"
    layout="fixed"
    .columns=${columns}
    .rows=${[]}
  ></lr-table>`,
};

const editableStoryColumns: TableColumn<DemoRow>[] = [
  {
    key: 'name',
    label: 'Name',
    editTrigger: 'double-click',
    editValue: (r) => r.name,
    cell: (r) => r.name,
  },
  {
    key: 'score',
    label: 'Score',
    editTrigger: 'double-click',
    editType: 'number',
    editValue: (r) => r.score,
    cell: (r) => r.score,
  },
];

export const EditableCells: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Double-click a cell to edit it. Draft native `input`/`change` events stay internal; a commit publishes the documented `lr-cell-edit` transaction.',
      },
    },
  },
  render: () =>
    html`<lr-table
      .columns=${editableStoryColumns}
      .rows=${rows}
      .rowKey=${(r: DemoRow) => r.id}
      @lr-cell-edit=${(event: CustomEvent) => console.log(event.detail)}
    ></lr-table>`,
};

interface RateRow {
  id: string;
  tier: string;
  rate: number;
  note: string;
}

// Consumer-owned rows, mutated only in response to `lr-cell-edit` -- the table
// itself never writes back into `rows`. A settings/rate grid is exactly the
// case `editTrigger: 'always'` exists for: every row in the column is meant to be
// typed into, so requiring a double-click per cell first is pure friction.
let rateRows: RateRow[] = [
  { id: 'a', tier: 'Standard', rate: 0.12, note: 'per request' },
  { id: 'b', tier: 'Priority', rate: 0.34, note: 'per request' },
  { id: 'c', tier: 'Batch', rate: 0.05, note: 'per 1k requests' },
];

const rateColumns: TableColumn<RateRow>[] = [
  { key: 'tier', label: 'Tier', cell: (r) => r.tier },
  {
    key: 'rate',
    label: 'Rate (USD)',
    align: 'end',
    editTrigger: 'always',
    editType: 'number',
    editValue: (r) => r.rate,
    cell: (r) => r.rate,
  },
  { key: 'note', label: 'Billed', cell: (r) => r.note },
];

function renderRateTable(): unknown {
  return html`<lr-table
    aria-label="Pricing tiers"
    .columns=${rateColumns}
    .rows=${rateRows}
    .rowKey=${(r: RateRow) => r.id}
    @lr-cell-edit=${(e: CustomEvent<{ row: RateRow; value: string | number }>) => {
      rateRows = rateRows.map((row) => (row.id === e.detail.row.id ? { ...row, rate: Number(e.detail.value) } : row));
      // Storybook's `render()` return value isn't reactive on its own -- force a
      // re-render the same way ExpandableRows below does.
      const root = (e.currentTarget as HTMLElement).parentElement;
      if (root) render(renderRateTable(), root);
    }}
  ></lr-table>`;
}

export const AlwaysOnEditors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "`editTrigger: 'always'` renders a persistent editor in every body cell of that column, from first paint. Each editor is a plain tab stop outside the header/row roving-tabindex model, so Tab walks the column while arrow keys still navigate the grid from a row's own tab stop (and move the caret once you are inside a field). Enter commits and keeps focus; blurring after a change commits too; Escape has nothing to cancel back to, so it is left for an ancestor dialog/popover. The value binds as a content attribute, so an out-of-band `rows` update never overwrites a draft the user is still typing.",
      },
    },
  },
  render: () => html`<div>${renderRateTable()}</div>`,
};

export const GroupedRows: Story = {
  render: () =>
    html`<lr-table
      .columns=${columns}
      .rows=${rows}
      .groupBy=${(r: DemoRow) => (r.score > 80 ? 'Passing' : 'Needs review')}
      .groupLabel=${(key: string | number, grouped: readonly DemoRow[]) => html`<strong>${key}</strong> (${grouped.length})`}
    ></lr-table>`,
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
  { key: 'name', label: 'Name', sortable: true, sticky: 'start', cell: (r) => r.name },
  { key: 'score', label: 'Score', sortable: true, align: 'end', cell: (r) => r.score },
  { key: 'region', label: 'Region', priority: 'medium', cell: (r) => r.region },
  { key: 'updated', label: 'Updated', priority: 'low', cell: (r) => r.updated },
];

export const PriorityAndSticky: Story = {
  render: () =>
    html`<div style="max-width: 420px;">
      <lr-table .columns=${priorityColumns} .rows=${detailRows}></lr-table>
    </div>`,
};

// Same `priority` columns as PriorityAndSticky, but at a container width the
// `@container` breakpoints never actually hide anything at — demonstrates
// that `[part='reveal-columns-button']` correctly stays absent (rather than
// rendering as a permanent no-op control) when nothing is really hidden.
export const PriorityWideContainerNoButton: Story = {
  render: () =>
    html`<div style="max-width: 960px;">
      <lr-table .columns=${priorityColumns} .rows=${detailRows}></lr-table>
    </div>`,
};

// `priority-columns-visible` restores a previously-persisted reveal preference up
// front, instead of always starting collapsed.
export const PriorityColumnsRevealed: Story = {
  render: () =>
    html`<div style="max-width: 420px;">
      <lr-table .columns=${priorityColumns} .rows=${detailRows} priority-columns-visible></lr-table>
    </div>`,
};

// A real control inside cell() owns its click/Enter activation, while a passive custom element
// remains part of the row activation surface.
const actionColumns: TableColumn<DemoRow>[] = [
  { key: 'name', label: 'Name', cell: (r) => r.name },
  {
    key: 'score',
    label: 'Score',
    align: 'end',
    cell: (r) => html`<lr-format-number value=${r.score}></lr-format-number>`,
  },
  {
    key: 'actions',
    label: 'Actions',
    cell: (r) => html`<button type="button" @click=${() => alert(`Editing ${r.name}`)}>Edit</button>`,
  },
];

export const RowActions: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The native Edit button owns its action, but the passive `<lr-format-number>` remains part of the row click surface. Open-shadow custom controls are recognized through the event composed path; an opaque closed-shadow control can opt out of row activation by marking its host `data-table-interactive`.',
      },
    },
  },
  render: () => html`<lr-table .columns=${actionColumns} .rows=${rows}></lr-table>`,
};

const narrowPriorityActionColumns: TableColumn<DetailRow>[] = [
  {
    key: 'name',
    label: 'Very long localized resource name',
    sticky: 'start',
    cell: (row) => row.name,
  },
  { key: 'score', label: 'Quality score', align: 'end', cell: (row) => row.score },
  { key: 'region', label: 'Deployment region', priority: 'medium', cell: (row) => row.region },
  { key: 'updated', label: 'Last synchronization timestamp', priority: 'low', cell: (row) => row.updated },
  {
    key: 'actions',
    label: 'Actions',
    cell: (row) => html`<button type="button" @click=${() => alert(`Editing ${row.name}`)}>Review</button>`,
  },
];

export const NarrowPriorityActions: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Paired LTR/RTL allocations at the default 20rem (320px) contract exercise priority hiding, a sticky long label, and row actions together.',
      },
    },
  },
  render: () =>
    narrowStoryFrames(
      (direction) => html`
        <lr-table
          accessible-label=${direction === 'rtl' ? 'موارد النشر' : 'Bereitstellungsressourcen'}
          .columns=${narrowPriorityActionColumns}
          .rows=${[
            {
              ...detailRows[0]!,
              name:
                direction === 'rtl'
                  ? 'موردمترجملطويلجداًوغيرقابلللالتفاف'
                  : 'SehrLangerNichtUmbrechbarerRessourcenname',
            },
            detailRows[1]!,
          ]}
        ></lr-table>
      `
    ),
};

// expandedRowKeys is consumer-owned, unlike self-managed selection/client sorting. This story
// uses a plain module-level Set + a manual re-render to demonstrate the
// wiring a real consumer would do with their own framework's state.
const expandableExpandedKeys = new Set<string | number>();

function renderExpandableRows(): unknown {
  return html`<lr-table
    style="font-family: monospace; --lr-font-size-md-sm: 20px"
    .columns=${detailColumns}
    .rows=${detailRows}
    .rowKey=${(r: DetailRow) => r.id}
    .expandedContent=${(r: DetailRow) =>
      html`<div style="padding: 4px 8px;"><strong>${r.name}</strong> — region ${r.region}, updated ${r.updated}</div>`}
    .expandedRowKeys=${expandableExpandedKeys}
    @lr-row-expand-toggle=${(e: CustomEvent<{ rowKey: string | number }>) => {
      const key = e.detail.rowKey;
      if (expandableExpandedKeys.has(key)) expandableExpandedKeys.delete(key);
      else expandableExpandedKeys.add(key);
      // Re-render this story's own root -- Storybook's `render()` return
      // value isn't reactive on its own, so force one by re-invoking it via
      // the same pattern lite-chart.stories.ts's own interactive stories use.
      const root = (e.currentTarget as HTMLElement).parentElement;
      if (root) render(renderExpandableRows(), root);
    }}
  ></lr-table>`;
}

const detailColumns: TableColumn<DetailRow>[] = [
  { key: 'name', label: 'Name', cell: (r) => r.name },
  { key: 'score', label: 'Score', align: 'end', cell: (r) => r.score },
];

export const ExpandableRows: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The row-expand control inherits table typography, so its 1em chevron scales together with the surrounding table text.',
      },
    },
  },
  render: () => html`<div>${renderExpandableRows()}</div>`,
};

// canExpand opts a specific row out of the toggle entirely (e.g. an
// unconfigured provider with nothing to show) -- its leading cell renders
// empty instead of a button, and its key being in expandedRowKeys (it isn't,
// here) would still not render a panel for it.
export const ExpandableRowsWithOptOut: Story = {
  render: () =>
    html`<lr-table
      .columns=${detailColumns}
      .rows=${detailRows}
      .rowKey=${(r: DetailRow) => r.id}
      .expandedContent=${(r: DetailRow) => html`<div style="padding: 4px 8px;">${r.name} details</div>`}
      .canExpand=${(r: DetailRow) => r.id !== 'c'}
      .expandedRowKeys=${new Set(['a'])}
    ></lr-table>`,
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
    html`<lr-table
      .columns=${pivotColumns}
      .rows=${pivotRows}
      .rowKey=${(r: PivotRow) => r.id}
      .rowTotal=${(r: PivotRow) => r.mon + r.tue + r.wed}
      .grandTotal=${(rs: readonly PivotRow[]) => rs.reduce((sum, r) => sum + r.mon + r.tue + r.wed, 0)}
    ></lr-table>`,
};

export const AncestorThemeHooks: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Heat-tint and resize hooks, including independent handle hover and press paint, inherit from a theme wrapper. A value set directly on the table still wins through the normal cascade.',
      },
    },
  },
  render: () => html`
    <div
      style="--lr-table-heat-tint-lo: var(--lr-color-success-quiet); --lr-table-heat-tint-hi: var(--lr-color-success); --lr-table-resize-min-width: var(--lr-size-8rem); --lr-table-resize-handle-hover-bg: var(--lr-color-warning); --lr-table-resize-handle-hover-opacity: 0.45; --lr-table-resize-handle-active-bg: var(--lr-color-danger); --lr-table-resize-handle-active-opacity: 0.8"
    >
      <lr-table
        .columns=${pivotColumns.map((column) => ({ ...column, resizable: true }))}
        .rows=${pivotRows}
        .rowKey=${(row: PivotRow) => row.id}
      ></lr-table>
    </div>
  `,
};
