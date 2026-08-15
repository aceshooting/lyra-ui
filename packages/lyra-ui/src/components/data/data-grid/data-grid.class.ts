import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { ComplexAttributeConverter } from 'lit';
import { resolveCssLength } from '../../../internal/css-length.js';
import {
  getNumberFormat,
  resolveIntlLocale,
} from '../../../internal/intl-cache.js';
import { chevronIcon } from '../../../internal/icons.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import {
  finiteCount,
  finiteDuration,
  finiteInteger,
  finiteRange,
} from '../../../internal/numbers.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { srOnly } from '../../../internal/a11y.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import {
  writeClipboardText,
  type LyraClipboardWriteOutcome,
} from '../../../internal/clipboard.js';
import {
  aggregateValues,
  columnId,
  columnValue,
  filterRows,
  pathValue,
  rowsAsDelimited,
  searchRows,
  sortRows,
} from './data-grid-processing.js';
import { styles } from './data-grid.styles.js';
import type {
  DataGridAppearance,
  DataGridCellContextMenuDetail,
  DataGridColumn,
  DataGridCopyOptions,
  DataGridCsvOptions,
  DataGridExportOptions,
  DataGridFacets,
  DataGridFilter,
  DataGridKey,
  DataGridJsonValue,
  DataGridPinSide,
  DataGridRequest,
  DataGridResponse,
  DataGridScrollOptions,
  DataGridSelectable,
  DataGridSize,
  DataGridSortingState,
  DataGridState,
  LyraDataGridEventMap,
  SortingState,
} from './data-grid-types.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import {
  LYRA_DEFAULT_collapse,
  LYRA_DEFAULT_copied,
  LYRA_DEFAULT_copyFailed,
  LYRA_DEFAULT_dataGridColumnMenu,
  LYRA_DEFAULT_dataGridPinEnd,
  LYRA_DEFAULT_dataGridPinStart,
  LYRA_DEFAULT_dataGridRowsPerPage,
  LYRA_DEFAULT_dataGridTreeLimitReached,
  LYRA_DEFAULT_dataGridUnpin,
  LYRA_DEFAULT_expand,
  LYRA_DEFAULT_loading,
  LYRA_DEFAULT_next,
  LYRA_DEFAULT_noColumns,
  LYRA_DEFAULT_noData,
  LYRA_DEFAULT_noMatches,
  LYRA_DEFAULT_paginationFirstPage,
  LYRA_DEFAULT_paginationJumpToPage,
  LYRA_DEFAULT_paginationLabel,
  LYRA_DEFAULT_paginationLastPage,
  LYRA_DEFAULT_previous,
  LYRA_DEFAULT_resizeColumn,
  LYRA_DEFAULT_search,
  LYRA_DEFAULT_select,
  LYRA_DEFAULT_showAllColumns,
  LYRA_DEFAULT_tableFilterLabel,
} from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export * from './data-grid-types.js';

const selectableConverter: ComplexAttributeConverter<DataGridSelectable> = {
  fromAttribute(value): DataGridSelectable {
    if (value === null) return 'none';
    if (value === '' || value === 'multiple') return 'multiple';
    return value === 'single' || value === 'none' ? value : 'none';
  },
  toAttribute(value): string | null {
    if (value === 'none') return null;
    return value === '' || value === 'multiple' ? '' : value;
  },
};

interface DataDisplayRow<Row> {
  kind: 'row';
  row: Row;
  key: DataGridKey;
  depth: number;
  sourceIndex: number;
}

interface DataDisplayGroup<Row> {
  kind: 'group';
  key: string;
  value: unknown;
  columnId: string;
  rows: Row[];
  depth: number;
}

type DisplayItem<Row> = DataDisplayRow<Row> | DataDisplayGroup<Row>;

function snapshotColumns<Row>(
  value: readonly DataGridColumn<Row>[]
): readonly DataGridColumn<Row>[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  const output: DataGridColumn<Row>[] = [];
  for (const column of value) {
    try {
      if (
        column === null ||
        typeof column !== 'object' ||
        Array.isArray(column)
      )
        continue;
      output.push(Object.freeze({ ...column }));
    } catch {
      // Keep later valid definitions when a hostile record/getter fails.
    }
  }
  return Object.freeze(output);
}

interface ResizeSession {
  columnId: string;
  startClientX: number;
  startWidth: number;
  initialStateWidth: number | undefined;
  pointerId: number;
  moved: boolean;
  direction: 'ltr' | 'rtl';
}

interface ColumnDragSession {
  readonly sourceId: string;
  readonly token: string;
}

const INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, summary, [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"]), [role="button"], [role="checkbox"], [role="radio"]';
const VIRTUALIZATION_THRESHOLD = 80;
const VIRTUAL_OVERSCAN = 5;
const DATA_GRID_TREE_NODE_LIMIT = 10_000;
const DATA_GRID_TREE_DEPTH_LIMIT = 64;
const DATA_GRID_DRAG_TYPE = 'application/x-lyra-data-grid-column';

function frozenArray<Value>(values: Iterable<Value>): readonly Value[] {
  return Object.freeze([...values]);
}

/** Converts arbitrary filter state into an isolated JSON-safe value. Sets intentionally become
 * arrays because the filter matcher already treats both as the same multi-value vocabulary. */
function serializableFilterValue(value: unknown): DataGridJsonValue {
  try {
    const serialized = JSON.stringify({ value }, (_key, nested: unknown) => {
      if (typeof nested === 'bigint') return nested.toString();
      if (typeof nested === 'number' && !Number.isFinite(nested)) return null;
      if (
        nested !== null &&
        typeof nested === 'object' &&
        Object.prototype.toString.call(nested) === '[object Set]'
      )
        return [...(nested as Set<unknown>)];
      return nested;
    });
    if (!serialized) return null;
    const snapshot =
      (JSON.parse(serialized) as { value?: unknown }).value ?? null;
    const stack = [snapshot];
    const visited = new Set<unknown>();
    while (stack.length > 0) {
      const current = stack.pop();
      if (
        current === null ||
        typeof current !== 'object' ||
        visited.has(current)
      )
        continue;
      visited.add(current);
      for (const nested of Object.values(current)) stack.push(nested);
      Object.freeze(current);
    }
    return snapshot as DataGridJsonValue;
  } catch {
    return null;
  }
}

function isKey(value: unknown): value is DataGridKey {
  return (
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function keysEqual(left: DataGridKey, right: DataGridKey): boolean {
  return typeof left === typeof right && left === right;
}

function arrayHasKey(keys: readonly DataGridKey[], key: DataGridKey): boolean {
  return keys.some((candidate) => keysEqual(candidate, key));
}

function isElementValue(value: unknown): value is Element {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<Element>;
  return candidate.nodeType === 1 && typeof candidate.closest === 'function';
}

function valueControl(
  value: EventTarget | null | undefined
): { value: string } | null {
  if (
    !isElementValue(value) ||
    typeof (value as Partial<HTMLInputElement>).value !== 'string'
  )
    return null;
  return value as HTMLInputElement | HTMLSelectElement;
}

function checkableControl(
  value: EventTarget | null | undefined
): HTMLInputElement | null {
  if (
    !isElementValue(value) ||
    typeof (value as Partial<HTMLInputElement>).checked !== 'boolean'
  )
    return null;
  return value as HTMLInputElement;
}

function dateText(value: object): string | undefined {
  try {
    const timestamp = Date.prototype.getTime.call(value);
    return Number.isFinite(timestamp)
      ? Date.prototype.toISOString.call(value)
      : '';
  } catch {
    return undefined;
  }
}

function humanizeIdentifier(value: string, locale: string): string {
  const intlLocale = resolveIntlLocale(locale);
  return value
    .replaceAll(/[._-]+/gu, ' ')
    .replaceAll(/([a-z\d])([A-Z])/gu, '$1 $2')
    .replace(/^./u, (first) => first.toLocaleUpperCase(intlLocale));
}

function safeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const serializedDate = dateText(value);
    if (serializedDate !== undefined) return serializedDate;
  }
  if (Array.isArray(value)) return value.map(safeText).join(', ');
  if (typeof value === 'object') {
    try {
      return (
        JSON.stringify(value, (_key, nested) =>
          typeof nested === 'bigint' ? nested.toString() : nested
        ) ?? ''
      );
    } catch {
      return '';
    }
  }
  return String(value);
}

/** Normalizes `DataGridPinSide`'s `'start'`/`'end'` spelling to the `'left'`/`'right'` values the
 *  render/layout/sort logic below is keyed to. Both spellings mean the same inline-start/
 *  inline-end edges -- the CSS already resolves `[data-pin='left'|'right']` through
 *  `inset-inline-start`/`inset-inline-end`, so either spelling mirrors under `dir="rtl"`
 *  identically. Mirrors `table.class.ts`'s `stickyDirection()`. Storage (`columnPinning`,
 *  `column.pinned`) and `getColumnPin()` keep echoing back whichever spelling the caller set --
 *  only render/layout call sites normalize through this. */
function normalizePinSide(side: DataGridPinSide): 'left' | 'right' | false {
  if (side === 'start') return 'left';
  if (side === 'end') return 'right';
  return side;
}

function normalizedGroupBy(
  value: string | readonly string[] | null
): readonly string[] {
  if (typeof value !== 'string') {
    return (value ?? [])
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, DATA_GRID_TREE_DEPTH_LIMIT);
  }
  return value
    .split(/[\s,]+/u)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, DATA_GRID_TREE_DEPTH_LIMIT);
}

/**
 * `<lr-data-grid>` — a virtualized data grid for client or server data, with sorting, filtering,
 * grouping, trees, paging, pinning, resizing, reordering, selection, copying, and CSV export.
 * Mirrors the public `<wa-data-grid>` surface under the `lr-` prefix.
 *
 * Arrays are shallow-reactive: reassign `data`, `columns`, and controlled state arrays after
 * changing them. Set `label` or a host `aria-label` to name the internal grid. Initial declarative
 * loading stays silent; each later transition into loading appends the localized loading text to
 * the document's shared light-DOM polite sink while the visible overlay remains non-live. Public
 * collections are clone-owned readonly snapshots. Nested rows are projected iteratively with a
 * 10,000-node/64-descendant-level budget and a localized limit notice.
 *
 * @customElement lr-data-grid
 * @slot empty - Content rendered when the source has no rows.
 * @slot loading - Content rendered over the grid while data is loading.
 * @slot no-results - Content rendered when active search or filters match no rows.
 * @event request - Fired when server data is requested. `detail` contains sort, filter, search,
 *   page, page-size, and abort-signal state.
 * @event lr-cell-click - Fired when a data cell is activated.
 * @event lr-cell-contextmenu - Fired before a native cell context menu. Cancelable; preventing
 *   default suppresses the native menu.
 * @event lr-column-move - Fired while and after a user column move; `detail.finished` marks commit.
 * @event lr-column-pin - Fired after a user pins or unpins a column.
 * @event lr-column-resize - Fired while and after a user resize; `detail.finished` marks commit.
 *   Pointer cancellation or lost capture restores the pre-gesture width, reports that rollback as
 *   `finished: false` when a live resize occurred, and never emits a commit.
 * @event lr-column-visibility-change - Fired after a user changes column visibility.
 * @event lr-copy - A clipboard write fulfilled. Frozen detail: `{ ok: true, text }`.
 * @event lr-copy-error - A clipboard write failed. Frozen detail:
 *   `{ ok: false, text, reason, error }`.
 * @event lr-error - A clipboard write failed; compatibility notification without raw error text.
 * @event lr-data-error - Fired when a server request rejects; prior rows remain rendered.
 * @event lr-filter-change - Fired after a user changes a column filter.
 * @event lr-group-collapse - Fired after a user collapses a client-side group. Frozen detail:
 *   `{ key, columnId, value, rows }`.
 * @event lr-group-expand - Fired after a user expands a client-side group. Frozen detail:
 *   `{ key, columnId, value, rows }`.
 * @event lr-page-change - Fired after a user changes the zero-based page or page size.
 * @event lr-row-collapse - Fired after a user collapses a tree row or row detail.
 * @event lr-row-expand - Fired after a user expands a tree row or row detail.
 * @event lr-row-select - Fired after a user changes selection.
 * @event lr-sort-change - Fired after a user changes sorting.
 * @event focus - Native focus relayed once from the toolbar search or active column-filter input.
 * @event blur - Native blur relayed once from the toolbar search or active column-filter input.
 * @csspart body - Scrollable body viewport.
 * @csspart cell - A data cell.
 * @csspart column-menu - A per-column menu.
 * @csspart column-menu-button - A per-column menu trigger.
 * @csspart columns-menu - The all-columns visibility menu.
 * @csspart data-grid - The outer data-grid container.
 * @csspart drag-ghost - Preview shown while a column is dragged.
 * @csspart ellipsis - Omitted-page indicator in the pager.
 * @csspart empty - Empty-data state.
 * @csspart expand-button - A tree/detail/group expand control.
 * @csspart filter-button - A column filter trigger.
 * @csspart filter-panel - The active column filter editor.
 * @csspart first-button - First-page button.
 * @csspart first-icon - The first-page directional icon.
 * @csspart footer - Footer container.
 * @csspart footer-cell - A footer cell.
 * @csspart footer-row - Footer row.
 * @csspart group-count - Number of rows in a group.
 * @csspart group-row - A grouped row.
 * @csspart group-value - Group value and disclosure control.
 * @csspart header - Header row.
 * @csspart header-cell - A column header cell.
 * @csspart last-button - Last-page button.
 * @csspart last-icon - The last-page directional icon.
 * @csspart live-region - The visually-hidden, `aria-hidden` mirror of the last polite
 * announcement. The announcement itself lands in the shared light-DOM polite region
 * (`acquireAnnouncementSink()` in `internal/announcer.ts`), because a live region inside a shadow
 * root is not reliably announced; this part is a styling/inspection surface only.
 * @csspart loading-overlay - Visible, non-live loading-state overlay. The grid carries
 *   `aria-busy`; post-mount loading announcements use the shared light-DOM polite sink.
 * @csspart next-button - Next-page button.
 * @csspart next-icon - The next-page directional icon.
 * @csspart no-results - No-filter-results state.
 * @csspart page - A numbered page button.
 * @csspart page-current - The current numbered page button.
 * @csspart page-size - Page-size selector.
 * @csspart pager - Pagination controls.
 * @csspart pager-button - Shared part for every pager button.
 * @csspart pin-indicator - Pinned-column edge marker.
 * @csspart previous-button - Previous-page button.
 * @csspart previous-icon - The previous-page directional icon.
 * @csspart resize-handle - Pointer and keyboard column resize handle.
 * @csspart row - A data row.
 * @csspart row-detail - Expanded detail content.
 * @csspart search - Global row-search input.
 * @csspart select-all-checkbox - Current-page select-all checkbox.
 * @csspart sort-indicator - Current sort-direction indicator.
 * @csspart sort-number - Multi-sort priority number.
 * @csspart table - Grid table wrapper.
 * @csspart toolbar - Search and column controls.
 * @csspart tree-limit - Localized notice rendered when nested input exceeds the 10,000-node or
 *   64-descendant-level projection budget.
 * @cssprop [--accent-color=var(--lr-color-brand)] - Accent used by focus and active states.
 * @cssprop [--background-color=var(--lr-color-surface)] - Grid background.
 * @cssprop [--border-color=var(--lr-color-border)] - Grid and cell border color.
 * @cssprop [--border-radius=var(--lr-radius)] - Outer and control corner radius.
 * @cssprop [--border-width=var(--lr-border-width-thin)] - Grid and cell border width.
 * @cssprop [--cell-padding=var(--lr-space-m)] - Header, cell, and footer padding.
 * @cssprop [--focus-ring=var(--lr-focus-ring-width) solid var(--lr-focus-ring-color)] - Focus ring.
 * @cssprop [--header-background=var(--lr-color-surface-raised)] - Header background.
 * @cssprop [--header-row-height=var(--lr-size-3-5rem)] - Header-row minimum height.
 * @cssprop [--header-text-color=var(--lr-color-text)] - Header foreground.
 * @cssprop [--indent-size=var(--lr-size-1-25rem)] - Tree-level indentation.
 * @cssprop [--max-height=var(--lr-size-30rem)] - Scroll viewport maximum height; `none` renders all.
 * @cssprop [--row-height=var(--lr-size-3-5rem)] - Estimated and minimum row height.
 * @cssprop --row-hover-background - Hovered-row background.
 * @cssprop [--selected-background=var(--lr-color-brand-quiet)] - Selected-row background.
 * @cssprop [--stripe-background=var(--lr-color-surface-raised)] - Alternating-row background.
 * @cssprop [--text-color=var(--lr-color-text)] - Grid foreground.
 * @cssprop [--transition-duration=var(--lr-duration-fast)] - Interaction transition duration.
 * @status experimental
 * @since 4.0.0
 */
export class LyraDataGrid<Row = Record<string, unknown>> extends LyraElement<
  LyraDataGridEventMap<Row>
> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> =
    {
      ...super.defaultStrings,
      collapse: LYRA_DEFAULT_collapse,
      copied: LYRA_DEFAULT_copied,
      copyFailed: LYRA_DEFAULT_copyFailed,
      dataGridColumnMenu: LYRA_DEFAULT_dataGridColumnMenu,
      dataGridPinEnd: LYRA_DEFAULT_dataGridPinEnd,
      dataGridPinStart: LYRA_DEFAULT_dataGridPinStart,
      dataGridRowsPerPage: LYRA_DEFAULT_dataGridRowsPerPage,
      dataGridTreeLimitReached: LYRA_DEFAULT_dataGridTreeLimitReached,
      dataGridUnpin: LYRA_DEFAULT_dataGridUnpin,
      expand: LYRA_DEFAULT_expand,
      loading: LYRA_DEFAULT_loading,
      next: LYRA_DEFAULT_next,
      noColumns: LYRA_DEFAULT_noColumns,
      noData: LYRA_DEFAULT_noData,
      noMatches: LYRA_DEFAULT_noMatches,
      paginationFirstPage: LYRA_DEFAULT_paginationFirstPage,
      paginationJumpToPage: LYRA_DEFAULT_paginationJumpToPage,
      paginationLabel: LYRA_DEFAULT_paginationLabel,
      paginationLastPage: LYRA_DEFAULT_paginationLastPage,
      previous: LYRA_DEFAULT_previous,
      resizeColumn: LYRA_DEFAULT_resizeColumn,
      search: LYRA_DEFAULT_search,
      select: LYRA_DEFAULT_select,
      showAllColumns: LYRA_DEFAULT_showAllColumns,
      tableFilterLabel: LYRA_DEFAULT_tableFilterLabel,
    };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, sizes, srOnly, styles];

  /** Bordered or borderless container treatment. */
  @property({ reflect: true }) appearance: DataGridAppearance = 'outlined';
  /** Dot path or callback returning nested child rows. */
  @property({ attribute: 'child-rows' }) childRows:
    | string
    | ((row: Row) => readonly Row[] | undefined)
    | null = null;
  private _columnOrder: readonly string[] = Object.freeze([]);
  /** Clone-owned controlled column order; an empty array uses declaration order. */
  @property({ attribute: false })
  get columnOrder(): readonly string[] {
    return this._columnOrder;
  }
  set columnOrder(value: readonly string[]) {
    const previous = this._columnOrder;
    this._columnOrder = frozenArray(
      Array.isArray(value)
        ? value.filter((id): id is string => typeof id === 'string')
        : []
    );
    this.requestUpdate('columnOrder', previous);
  }

  private _columns: readonly DataGridColumn<Row>[] = Object.freeze([]);
  /** Clone-owned readonly column-definition sequence. Reassign to update.
   * @default [] */
  @property({ attribute: false })
  get columns(): readonly DataGridColumn<Row>[] {
    return this._columns;
  }
  set columns(value: readonly DataGridColumn<Row>[]) {
    const previous = this._columns;
    this._columns = snapshotColumns(value);
    this.requestUpdate('columns', previous);
  }

  private _data: readonly Row[] = Object.freeze([]);
  /** Clone-owned readonly client rows or current server page. Row identities are preserved.
   * @default [] */
  @property({ attribute: false })
  get data(): readonly Row[] {
    return this._data;
  }
  set data(value: readonly Row[]) {
    const previous = this._data;
    this._data = frozenArray(Array.isArray(value) ? value : []);
    this.requestUpdate('data', previous);
  }
  /** Async server loader. Providing one enables server behavior. */
  @property({ attribute: false }) dataSource:
    | ((request: DataGridRequest) => Promise<DataGridResponse<Row>>)
    | null = null;
  private _expandedKeys: readonly DataGridKey[] = Object.freeze([]);
  /** Clone-owned controlled expanded tree/detail/group keys. */
  @property({ attribute: false })
  get expandedKeys(): readonly DataGridKey[] {
    return this._expandedKeys;
  }
  set expandedKeys(value: readonly DataGridKey[]) {
    const previous = this._expandedKeys;
    this._expandedKeys = frozenArray(
      Array.isArray(value) ? value.filter(isKey) : []
    );
    this.requestUpdate('expandedKeys', previous);
  }
  /** Delay before server search/filter requests. */
  @property({ type: Number, attribute: 'filter-debounce' })
  filterDebounce = 250;
  /** Number of rows after client search and filters, before paging. */
  get filteredCount(): number {
    return this.processedClientRows.length;
  }
  /** Keeps matching descendants and their ancestors during tree filtering. */
  @property({ type: Boolean, attribute: 'filter-from-leaf-rows' })
  filterFromLeafRows = false;
  private _filters: readonly DataGridFilter[] = Object.freeze([]);
  /** Clone-owned controlled per-column filters. */
  @property({ attribute: false })
  get filters(): readonly DataGridFilter[] {
    return this._filters;
  }
  set filters(value: readonly DataGridFilter[]) {
    const previous = this._filters;
    const next: DataGridFilter[] = [];
    if (Array.isArray(value)) {
      for (const filter of value) {
        try {
          if (!filter || typeof filter.id !== 'string') continue;
          const filterValue =
            filter.value instanceof Set
              ? frozenArray(filter.value)
              : Array.isArray(filter.value)
              ? frozenArray(filter.value)
              : filter.value;
          next.push(Object.freeze({ id: filter.id, value: filterValue }));
        } catch {
          // Keep later valid filters when a hostile record/getter fails.
        }
      }
    }
    this._filters = Object.freeze(next);
    this.requestUpdate('filters', previous);
  }
  private _groupBy: string | readonly string[] | null = null;
  /** One or more field/column identifiers used to group client rows.
   * @default null */
  @property({ attribute: 'group-by' })
  get groupBy(): string | readonly string[] | null {
    return this._groupBy;
  }
  set groupBy(value: string | readonly string[] | null) {
    const previous = this._groupBy;
    this._groupBy =
      typeof value === 'string'
        ? value
        : Array.isArray(value)
        ? frozenArray(
            value.filter((item): item is string => typeof item === 'string')
          )
        : null;
    this.requestUpdate('groupBy', previous);
  }
  /** Accessible name used when host `aria-label` is absent. */
  @property() label: string | null = null;
  /** Shows the loading overlay. */
  @property({ type: Boolean, reflect: true }) loading = false;
  /** Maximum simultaneous sorts; zero is unlimited. */
  @property({ type: Number, attribute: 'max-multi-sort' }) maxMultiSort = 0;
  /** Zero-based page index. */
  @property({ type: Number, reflect: true }) page = 0;
  /** Number of available pages. */
  get pageCount(): number {
    const size = this.safePageSize;
    if (size === 0) return 0;
    if (!this.usesServerData && normalizedGroupBy(this.groupBy).length > 0) {
      const groups = this.topLevelGroupBuckets(this.processedClientRows).length;
      return groups <= 0 ? 0 : Math.ceil(groups / size);
    }
    const count = this.safeTotal >= 0 ? this.safeTotal : this.filteredCount;
    return count <= 0 ? 0 : Math.ceil(count / size);
  }
  /** Rows per page. */
  @property({ type: Number, attribute: 'page-size' }) pageSize = 20;
  /** Choices rendered by the page-size selector. */
  private _pageSizeOptions: readonly number[] = Object.freeze([
    10, 20, 50, 100,
  ]);
  /** Clone-owned choices rendered by the page-size selector.
   * @default [10, 20, 50, 100] */
  @property({ attribute: false })
  get pageSizeOptions(): readonly number[] {
    return this._pageSizeOptions;
  }
  set pageSizeOptions(value: readonly number[]) {
    const previous = this._pageSizeOptions;
    this._pageSizeOptions = frozenArray(Array.isArray(value) ? value : []);
    this.requestUpdate('pageSizeOptions', previous);
  }
  /** Enables client slicing and pager controls. */
  @property({ type: Boolean, reflect: true }) paginate = false;
  /** Enables pinning unless a column overrides it. */
  @property({ type: Boolean, reflect: true }) pinnable = false;
  /** Enables column movement unless a column overrides it. */
  @property({ type: Boolean, reflect: true }) reorderable = false;
  /** Enables column resizing unless a column overrides it. */
  @property({ type: Boolean, reflect: true }) resizable = false;
  /** Callback assigning a class to each row. */
  @property({ attribute: false }) rowClass:
    | ((row: Row) => string | null | undefined)
    | null = null;
  /** Callback rendering expandable detail content. */
  @property({ attribute: false }) rowDetail:
    | ((row: Row) => string | TemplateResult | Node)
    | null = null;
  /** Dot path used as the stable row identity. */
  @property({ attribute: 'row-key' }) rowKey: string | null = null;
  /** Optional global-search matcher. */
  @property({ attribute: false }) searchFn:
    | ((value: unknown, term: string, row: Row) => boolean)
    | null = null;
  /** Controlled global search term. */
  @property({ attribute: false }) searchTerm = '';
  /** Row-selection behavior. A bare attribute means `multiple`. */
  @property({ reflect: true, converter: selectableConverter })
  selectable: DataGridSelectable = 'none';
  /** Callback disabling selection for individual rows. */
  @property({ attribute: false }) selectableRows:
    | ((row: Row) => boolean)
    | null = null;
  private _selectedKeys: readonly DataGridKey[] = Object.freeze([]);
  /** Clone-owned controlled selected row keys. */
  @property({ attribute: false })
  get selectedKeys(): readonly DataGridKey[] {
    return this._selectedKeys;
  }
  set selectedKeys(value: readonly DataGridKey[]) {
    const previous = this._selectedKeys;
    this._selectedKeys = frozenArray(
      Array.isArray(value) ? value.filter(isKey) : []
    );
    this.requestUpdate('selectedKeys', previous);
  }
  /** Selected rows, derived from `selectedKeys`. Assigning current source rows updates those keys. */
  get selectedRows(): readonly Row[] {
    return frozenArray(
      this.allSourceRows.filter((row, index) =>
        arrayHasKey(this.selectedKeys, this.keyForRow(row, index))
      )
    );
  }
  set selectedRows(next: readonly Row[]) {
    const source = this.allSourceRows;
    const sourceSet = new Set(source);
    const sourceIndexes = this.sourceIndexMap(source);
    const candidates = Array.isArray(next) ? next : [];
    const seen = new Set<Row>();
    const rows = candidates.filter((row) => {
      if (!sourceSet.has(row) || seen.has(row)) return false;
      seen.add(row);
      return true;
    });
    const limited = this.selectionMode === 'single' ? rows.slice(0, 1) : rows;
    this.selectedKeys = limited.map((row) =>
      this.keyForRow(row, sourceIndexes.get(row) ?? 0)
    );
  }
  /** Uses server/event-driven loading and skips client processing. */
  @property({ type: Boolean, reflect: true }) server = false;
  /** Density on the shared Lyra size ladder. */
  @property({ reflect: true }) size: DataGridSize = 'm';
  private _sort: SortingState = Object.freeze([]);
  /** Clone-owned controlled multi-column sorting state. */
  @property({ attribute: false })
  get sort(): SortingState {
    return this._sort;
  }
  set sort(value: SortingState) {
    const previous = this._sort;
    const next: DataGridSortingState[number][] = [];
    if (Array.isArray(value)) {
      for (const item of value) {
        try {
          if (!item || typeof item.id !== 'string') continue;
          next.push(Object.freeze({ id: item.id, desc: Boolean(item.desc) }));
        } catch {
          // Keep later valid sort records when a hostile record/getter fails.
        }
      }
    }
    this._sort = Object.freeze(next);
    this.requestUpdate('sort', previous);
  }
  /** Starts new sort cycles descending. */
  @property({ type: Boolean, attribute: 'sort-desc-first' }) sortDescFirst =
    false;
  /** Alternates client row backgrounds. */
  @property({ type: Boolean, reflect: true }) striped = false;
  /** Total server rows; `-1` derives the count from loaded data. */
  @property({ type: Number }) total = -1;
  /** Shows a menu on each column. */
  @property({ type: Boolean, attribute: 'with-column-menu', reflect: true })
  withColumnMenu = false;
  /** Shows the all-columns visibility menu. */
  @property({ type: Boolean, attribute: 'with-columns-menu', reflect: true })
  withColumnsMenu = false;
  /** Keeps a sorted column in ascending/descending states instead of removing its sort. */
  @property({ type: Boolean, attribute: 'without-sort-removal', reflect: true })
  withoutSortRemoval = false;
  /** Shows the global search field. */
  @property({ type: Boolean, attribute: 'with-search', reflect: true })
  withSearch = false;

  @state() private columnWidths = new Map<string, number>();
  @state() private columnVisibility = new Map<string, boolean>();
  @state() private columnPinning = new Map<string, DataGridPinSide>();
  @state() private activeFilterColumn: string | null = null;
  @state() private columnsMenuOpen = false;
  @state() private activeColumnMenu: string | null = null;
  @state() private liveText = '';
  @state() private bodyScrollTop = 0;
  @state() private viewportHeight = 0;
  @state() private focusedRow = -1;
  @state() private focusedColumn = 0;
  @state() private dragGhost = '';

  @query('[part="body"]') private bodyElement?: HTMLElement;

  private requestGeneration = 0;
  private requestController?: AbortController;
  private requestTimer?: { owner: Window; handle: number };
  private ownsLoadingState = false;
  private resizeSession?: ResizeSession;
  private columnDragSession?: ColumnDragSession;
  private columnDragSequence = 0;
  private lastSelectedIndex = -1;
  private isMounting = true;
  /** Handle on the shared light-DOM live region announcements actually go through -- a region
   *  rendered inside this shadow root is not reliably announced (JAWS with Firefox ignores one
   *  outright), so `[part="live-region"]` is only an `aria-hidden` mirror. */
  private sink?: AnnouncementSink;

  override connectedCallback(): void {
    super.connectedCallback();
    // Acquired on connect, not on the first announcement: assistive tech has to have been
    // observing a live region *before* text arrives for the change to be announced at all.
    this.sink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    if (this.dataSource) this.scheduleServerRequest(false);
  }

  override disconnectedCallback(): void {
    this.requestGeneration += 1;
    this.requestController?.abort();
    this.requestController = undefined;
    if (this.ownsLoadingState) this.loading = false;
    this.ownsLoadingState = false;
    this.cancelRequestTimer();
    if (this.resizeSession?.moved)
      this.restoreResizeSession(this.resizeSession, false);
    this.resizeSession = undefined;
    this.activeFilterColumn = null;
    this.activeColumnMenu = null;
    this.columnsMenuOpen = false;
    this.dragGhost = '';
    this.columnDragSession = undefined;
    this.sink?.release();
    this.sink = undefined;
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (this.hasUpdated && changed.has('loading') && this.loading) {
      this.announce(this.localize('loading'));
    }
    const sourceReplaced =
      changed.has('dataSource') && changed.get('dataSource') !== undefined;
    const serverDisabled = changed.has('server') && !this.usesServerData;
    if (
      (sourceReplaced || serverDisabled) &&
      (this.requestController || this.requestTimer !== undefined)
    ) {
      this.requestGeneration += 1;
      this.requestController?.abort();
      this.requestController = undefined;
      this.cancelRequestTimer();
      if (this.ownsLoadingState) this.loading = false;
      this.ownsLoadingState = false;
    }
    if (
      this.resizeSession &&
      (changed.has('resizable') || changed.has('columns')) &&
      !this.columnCanResize(this.resizeSession.columnId)
    ) {
      const session = this.resizeSession;
      this.resizeSession = undefined;
      if (session.moved) this.restoreResizeSession(session, true);
    }
    if (
      this.columnDragSession &&
      (changed.has('reorderable') || changed.has('columns')) &&
      !this.columnCanMove(this.columnDragSession.sourceId)
    ) {
      this.columnDragSession = undefined;
      this.dragGhost = '';
    }
    if (changed.has('columns')) this.handleColumnsChange();

    if (
      !this.usesServerData &&
      (changed.has('data') ||
        changed.has('rowKey') ||
        changed.has('childRows') ||
        changed.has('server') ||
        changed.has('dataSource'))
    ) {
      const validKeys = this.allSourceRows.map((row, index) =>
        this.keyForRow(row, index)
      );
      const validKeySet = new Set(validKeys);
      const selectedKeys = this.selectedKeys.filter((key) =>
        validKeySet.has(key)
      );
      if (
        selectedKeys.length !== this.selectedKeys.length ||
        selectedKeys.some(
          (key, index) => !keysEqual(key, this.selectedKeys[index]!)
        )
      ) {
        this.selectedKeys = selectedKeys;
      }
      this.lastSelectedIndex = -1;
    }

    if (
      this.paginate &&
      (changed.has('data') ||
        changed.has('filters') ||
        changed.has('searchTerm') ||
        changed.has('groupBy') ||
        changed.has('pageSize') ||
        changed.has('total') ||
        changed.has('server') ||
        changed.has('dataSource'))
    ) {
      const lastPage = Math.max(0, this.pageCount - 1);
      this.page = finiteInteger(this.page, 0, 0, lastPage);
    }

    if (
      changed.has('data') ||
      changed.has('columns') ||
      changed.has('filters') ||
      changed.has('searchTerm') ||
      changed.has('sort') ||
      changed.has('expandedKeys') ||
      changed.has('groupBy') ||
      changed.has('page') ||
      changed.has('pageSize') ||
      changed.has('paginate') ||
      changed.has('childRows')
    ) {
      this.focusedRow = finiteInteger(
        this.focusedRow,
        -1,
        -1,
        Math.max(-1, this.displayItems.length - 1)
      );
      this.focusedColumn = finiteInteger(
        this.focusedColumn,
        0,
        0,
        Math.max(0, this.visibleColumns.length - 1)
      );
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (changed.has('dataSource') && this.dataSource)
      this.scheduleServerRequest(false);
    const requestRelevant =
      changed.has('sort') ||
      changed.has('filters') ||
      changed.has('searchTerm') ||
      changed.has('page') ||
      changed.has('pageSize') ||
      changed.has('server');
    if (requestRelevant && (this.server || this.dataSource)) {
      const delayed = changed.has('filters') || changed.has('searchTerm');
      this.scheduleServerRequest(delayed);
    }
    this.isMounting = false;
  }

  /** Send `text` to assistive tech. It goes to the shared light-DOM region -- appended as a new
   *  child node, so an identical repeat (copying twice in a row) is read again rather than being a
   *  silent no-op -- and is mirrored into `[part="live-region"]` for styling/inspection only. */
  private announce(text: string): void {
    this.sink?.announce(text);
    this.liveText = text;
  }

  private get usesServerData(): boolean {
    return this.server || this.dataSource !== null;
  }

  private get safePage(): number {
    return finiteInteger(this.page, 0, 0, Math.max(0, this.pageCount - 1));
  }

  private get safePageSize(): number {
    return finiteCount(this.pageSize);
  }

  private get safeTotal(): number {
    return this.total === -1 ? -1 : finiteCount(this.total);
  }

  private sourceProjection(): {
    readonly rows: readonly Row[];
    readonly truncated: boolean;
  } {
    const result: Row[] = [];
    const visited = new Set<unknown>();
    const stack: Array<{ readonly row: Row; readonly depth: number }> = [];
    for (let index = this.data.length - 1; index >= 0; index -= 1) {
      stack.push({ row: this.data[index]!, depth: 0 });
    }
    let truncated = false;
    while (stack.length > 0 && result.length < DATA_GRID_TREE_NODE_LIMIT) {
      const current = stack.pop()!;
      const trackIdentity =
        (typeof current.row === 'object' && current.row !== null) ||
        typeof current.row === 'function';
      if (trackIdentity && visited.has(current.row)) continue;
      if (trackIdentity) visited.add(current.row);
      result.push(current.row);
      const children = this.childrenFor(current.row);
      if (children.length === 0) continue;
      if (current.depth >= DATA_GRID_TREE_DEPTH_LIMIT) {
        truncated = true;
        continue;
      }
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push({ row: children[index]!, depth: current.depth + 1 });
      }
    }
    if (stack.length > 0) truncated = true;
    return { rows: Object.freeze(result), truncated };
  }

  private get allSourceRows(): readonly Row[] {
    return this.sourceProjection().rows;
  }

  private sourceIndexMap(
    rows: readonly Row[] = this.allSourceRows
  ): Map<Row, number> {
    const indexes = new Map<Row, number>();
    rows.forEach((row, index) => {
      if (!indexes.has(row)) indexes.set(row, index);
    });
    return indexes;
  }

  private get orderedColumns(): Array<{
    column: DataGridColumn<Row>;
    id: string;
    naturalIndex: number;
  }> {
    const entries = this.columns.map((column, naturalIndex) => ({
      column,
      id: columnId(column, naturalIndex),
      naturalIndex,
    }));
    if (this.columnOrder.length === 0) return entries;
    const rank = new Map(this.columnOrder.map((id, index) => [id, index]));
    return entries.sort((left, right) => {
      const leftRank = rank.get(left.id);
      const rightRank = rank.get(right.id);
      if (leftRank === undefined && rightRank === undefined)
        return left.naturalIndex - right.naturalIndex;
      if (leftRank === undefined) return 1;
      if (rightRank === undefined) return -1;
      return leftRank - rightRank;
    });
  }

  private get visibleColumns(): Array<{
    column: DataGridColumn<Row>;
    id: string;
    naturalIndex: number;
  }> {
    const entries = this.orderedColumns.filter(
      ({ column, id }) =>
        this.columnVisibility.get(id) ?? column.hidden !== true
    );
    const rank = (side: 'left' | 'right', id: string): number => {
      const ordered = this.orderedColumns.filter(
        (entry) => normalizePinSide(this.getColumnPin(entry.id)) === side
      );
      return ordered.findIndex((entry) => entry.id === id);
    };
    return entries.sort((left, right) => {
      const leftPin = normalizePinSide(this.getColumnPin(left.id));
      const rightPin = normalizePinSide(this.getColumnPin(right.id));
      if (leftPin === rightPin) return 0;
      if (leftPin === 'left') return -1;
      if (rightPin === 'left') return 1;
      if (leftPin === 'right') return 1;
      if (rightPin === 'right') return -1;
      return rank('left', left.id) - rank('right', right.id);
    });
  }

  private get processedClientRows(): Row[] {
    if (this.usesServerData) return [...this.data];
    if (this.childRows) {
      const included = this.data.filter(
        (row) =>
          this.rowMatches(row) ||
          (this.filterFromLeafRows && this.hasMatchingDescendant(row))
      );
      return sortRows(included, this.columns, this.sort, this.effectiveLocale);
    }
    const filtered = filterRows(
      this.data,
      this.columns,
      this.filters,
      this.effectiveLocale
    );
    const searched = searchRows(
      filtered,
      this.columns,
      this.searchTerm,
      this.effectiveLocale,
      this.searchFn
    );
    return sortRows(searched, this.columns, this.sort, this.effectiveLocale);
  }

  private childrenFor(row: Row): Row[] {
    try {
      const children =
        typeof this.childRows === 'function'
          ? this.childRows(row)
          : this.childRows
          ? pathValue(row, this.childRows)
          : undefined;
      return Array.isArray(children)
        ? (children.slice(0, DATA_GRID_TREE_NODE_LIMIT) as Row[])
        : [];
    } catch {
      return [];
    }
  }

  private keyForRow(row: Row, index: number): DataGridKey {
    const candidate = this.rowKey ? pathValue(row, this.rowKey) : undefined;
    return isKey(candidate) ? candidate : index;
  }

  private renderedColumnElements(
    columnId: string,
    role?: 'columnheader'
  ): HTMLElement[] {
    const prefix = role ? `[role="${role}"]` : '';
    const ownerCss = this.ownerDocument.defaultView?.CSS;
    const escape = ownerCss?.escape;
    if (typeof escape === 'function') {
      try {
        const matches = [
          ...this.renderRoot.querySelectorAll<HTMLElement>(
            `${prefix}[data-column-id="${escape.call(ownerCss, columnId)}"]`
          ),
        ];
        if (matches.length > 0) return matches;
      } catch {
        // A partial DOM may omit CSS.escape or expose an unusable implementation. The exact scan
        // below keeps public sizing methods usable there and cannot turn a caller-supplied id into
        // selector syntax.
      }
    }
    return [
      ...this.renderRoot.querySelectorAll<HTMLElement>(
        `${prefix}[data-column-id]`
      ),
    ].filter((element) => element.getAttribute('data-column-id') === columnId);
  }

  private computedToken(name: string, privateDefault?: string): string {
    if (!this.isConnected) return '';
    const owner = this.ownerDocument.defaultView;
    if (!owner || typeof owner.getComputedStyle !== 'function') return '';
    try {
      const style = owner.getComputedStyle(this);
      return (
        style.getPropertyValue(name).trim() ||
        (privateDefault ? style.getPropertyValue(privateDefault).trim() : '')
      );
    } catch {
      // Detached/partial DOM implementations can expose the API without supporting this host.
      return '';
    }
  }

  /** Sizes one column to its rendered header and cell contents. */
  autoSizeColumn(columnId: string): void {
    const cells = this.renderedColumnElements(columnId);
    if (cells.length === 0) return;
    let width = 0;
    for (const cell of cells) width = Math.max(width, cell.scrollWidth);
    const entry = this.orderedColumns.find(({ id }) => id === columnId);
    if (!entry) return;
    const { minimum, maximum } = this.columnBounds(entry.column);
    this.setColumnWidth(
      columnId,
      finiteRange(width, minimum, minimum, maximum),
      false
    );
  }

  /** Sizes every visible column to its rendered contents. */
  autoSizeColumns(): void {
    for (const { id } of this.visibleColumns) this.autoSizeColumn(id);
  }

  /** Collapses every tree, detail, and group row without emitting user events. */
  collapseAllRows(): void {
    this.expandedKeys = [];
  }

  /** Collapses one tree/detail/group key without emitting a user event. */
  collapseRow(key: string | number): void {
    this.expandedKeys = this.expandedKeys.filter(
      (candidate) => !keysEqual(candidate, key)
    );
  }

  /** Copies selected rows, or all processed rows when nothing is selected, and returns the row count.
   *  An explicit `delimiter` takes precedence over the default selected by `format`. */
  copySelectedRows(options: DataGridCopyOptions = {}): number {
    const rowsToCopy =
      this.selectedRows.length > 0
        ? this.selectedRows
        : this.getProcessedRows();
    const format = options.format ?? 'tsv';
    const text = this.delimitedRows(rowsToCopy, {
      ...options,
      delimiter: options.delimiter ?? (format === 'csv' ? ',' : '\t'),
    });
    void this.copyAndReport(text);
    return rowsToCopy.length;
  }

  /** Expands every expandable row without emitting user events. */
  expandAllRows(): void {
    const keys: DataGridKey[] = [];
    this.allSourceRows.forEach((row, index) => {
      if (this.childrenFor(row).length > 0 || this.rowDetail)
        keys.push(this.keyForRow(row, index));
    });
    for (const group of this.groupItems(this.processedClientRows))
      keys.push(group.key);
    this.expandedKeys = keys;
  }

  /** Expands one tree/detail/group key without emitting a user event. */
  expandRow(key: string | number): void {
    if (!arrayHasKey(this.expandedKeys, key))
      this.expandedKeys = [...this.expandedKeys, key];
  }

  /** Downloads processed rows as formula-safe delimited text (CSV by default). */
  exportDataAsCsv(options: DataGridExportOptions = {}): void {
    const text = this.getDataAsCsv(options);
    const ownerDocument = this.ownerDocument;
    const owner = ownerDocument.defaultView;
    if (!owner || typeof owner.URL.createObjectURL !== 'function') return;
    const url = owner.URL.createObjectURL(
      new owner.Blob([text], { type: 'text/csv;charset=utf-8' })
    );
    try {
      const anchor = ownerDocument.createElement('a');
      anchor.href = url;
      anchor.download = options.fileName || 'data.csv';
      anchor.hidden = true;
      ownerDocument.body?.append(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      owner.URL.revokeObjectURL(url);
    }
  }

  /** Moves focus to the grid's current roving stop. */
  override focus(options: FocusOptions = {}): void {
    const selector =
      this.focusedRow < 0
        ? `[role="columnheader"][data-column-position="${this.focusedColumn}"]`
        : `[role="gridcell"][data-row-position="${this.focusedRow}"][data-column-position="${this.focusedColumn}"]`;
    (this.renderRoot.querySelector(selector) as HTMLElement | null)?.focus(
      options
    );
  }

  /** Computes facets after every other column filter but before this column's own filter. */
  getColumnFacets(columnId: string): DataGridFacets {
    const uniqueValues = new Map<unknown, number>();
    if (this.usesServerData) return Object.freeze({ uniqueValues });
    const entry = this.orderedColumns.find(({ id }) => id === columnId);
    if (!entry) return Object.freeze({ uniqueValues });
    const otherFilters = this.filters.filter(
      (filter) => filter.id !== columnId
    );
    const rows = searchRows(
      filterRows(this.data, this.columns, otherFilters, this.effectiveLocale),
      this.columns,
      this.searchTerm,
      this.effectiveLocale,
      this.searchFn
    );
    let minimum = Number.POSITIVE_INFINITY;
    let maximum = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      const value = columnValue(entry.column, row);
      uniqueValues.set(value, (uniqueValues.get(value) ?? 0) + 1);
      const number = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(number)) {
        minimum = Math.min(minimum, number);
        maximum = Math.max(maximum, number);
      }
    }
    return Number.isFinite(minimum) && Number.isFinite(maximum)
      ? Object.freeze({
          uniqueValues,
          minMax: Object.freeze([minimum, maximum] as const),
        })
      : Object.freeze({ uniqueValues });
  }

  /** Returns one column's current pin side. */
  getColumnPin(columnId: string): DataGridPinSide {
    if (this.columnPinning.has(columnId))
      return this.columnPinning.get(columnId) ?? false;
    return (
      this.orderedColumns.find(({ id }) => id === columnId)?.column.pinned ??
      false
    );
  }

  /** Returns processed rows as formula-safe delimited text without downloading. */
  getDataAsCsv(options: DataGridCsvOptions = {}): string {
    return this.delimitedRows(this.getProcessedRows(), options);
  }

  /** Returns all filtered and sorted rows before pagination. */
  getProcessedRows(): readonly Row[] {
    return frozenArray(this.processedClientRows);
  }

  /** Returns the current page (or all rows when pagination is off). */
  getVisibleRows(): readonly Row[] {
    const rows = this.processedClientRows;
    if (!this.paginate || this.usesServerData) return frozenArray(rows);
    const size = this.safePageSize;
    if (size === 0) return [];
    const start = this.safePage * size;
    if (normalizedGroupBy(this.groupBy).length > 0) {
      return frozenArray(
        this.topLevelGroupBuckets(rows)
          .slice(start, start + size)
          .flatMap((bucket) => bucket.rows)
      );
    }
    return frozenArray(rows.slice(start, start + size));
  }

  /** Returns a serializable snapshot of the grid view state. */
  getState(): DataGridState {
    return Object.freeze({
      order: frozenArray(this.columnOrder),
      widths: Object.freeze(Object.fromEntries(this.columnWidths)),
      visibility: Object.freeze(Object.fromEntries(this.columnVisibility)),
      pinning: Object.freeze(Object.fromEntries(this.columnPinning)),
      sort: frozenArray(this.sort.map((item) => Object.freeze({ ...item }))),
      filters: frozenArray(
        this.filters.map((item) =>
          Object.freeze({
            id: item.id,
            value: serializableFilterValue(item.value),
          })
        )
      ),
      search: this.searchTerm,
      selectedKeys: frozenArray(this.selectedKeys),
      expandedKeys: frozenArray(this.expandedKeys),
      page: this.safePage,
      pageSize: this.safePageSize,
    });
  }

  /** Reconciles column order, widths, visibility, and pinning with the current definitions. */
  handleColumnsChange(): void {
    const valid = new Set(
      this.columns.map((column, index) => columnId(column, index))
    );
    const natural = [...valid];
    const order = this.columnOrder.filter((id) => valid.has(id));
    for (const id of natural) if (!order.includes(id)) order.push(id);
    if (
      this.columnOrder.length > 0 &&
      order.join('\u0000') !== this.columnOrder.join('\u0000')
    ) {
      this.columnOrder = order;
    }
    const widths = [...this.columnWidths].filter(([id]) => valid.has(id));
    const visibility = [...this.columnVisibility].filter(([id]) =>
      valid.has(id)
    );
    const pinning = [...this.columnPinning].filter(([id]) => valid.has(id));
    if (widths.length !== this.columnWidths.size)
      this.columnWidths = new Map(widths);
    if (visibility.length !== this.columnVisibility.size)
      this.columnVisibility = new Map(visibility);
    if (pinning.length !== this.columnPinning.size)
      this.columnPinning = new Map(pinning);
  }

  /** Applies a requested zero-based page and emits `lr-page-change`. */
  handlePageChange(): void {
    this.applyPageChange(this.safePage);
  }

  private applyPageChange(value: number | Event): void {
    let requested: number;
    if (typeof value === 'number') requested = value;
    else
      requested = Number(
        valueControl(value?.currentTarget)?.value ?? this.safePage
      );
    const last = Math.max(0, this.pageCount - 1);
    const next = finiteInteger(requested, this.safePage, 0, last);
    this.page = next;
    this.emit(
      'lr-page-change',
      Object.freeze({ page: next, pageSize: this.safePageSize })
    );
  }

  /** Applies a search-input event or re-evaluates the current search term. */
  handleSearchTermChange(): void {
    this.applySearchTermChange(this.searchTerm);
  }

  private applySearchTermChange(value: string | Event): void {
    const next =
      typeof value === 'string'
        ? value
        : valueControl(value?.currentTarget)?.value ?? this.searchTerm;
    this.searchTerm = next;
    if (this.page !== 0) this.page = 0;
  }

  /** Pins or unpins a column without emitting the user-only pin event. Accepts `'left'`/`'right'`
   *  (RTL-relative, not physical -- see `DataGridPinSide`) or their `'start'`/`'end'` aliases. */
  pinColumn(columnId: string, side: DataGridPinSide): void {
    if (!this.orderedColumns.some(({ id }) => id === columnId)) return;
    const next = new Map(this.columnPinning);
    next.set(columnId, side);
    this.columnPinning = next;
  }

  /** Forces the current server request. */
  async reload(): Promise<void> {
    const owner = this.ownerDocument.defaultView;
    if (!this.isConnected || !owner || !this.usesServerData) return;
    this.cancelRequestTimer();
    await this.loadServerData(owner);
  }

  /** Restores column declaration order, widths, visibility, and pinning. */
  resetColumns(): void {
    this.columnOrder = [];
    this.columnWidths = new Map();
    this.columnVisibility = new Map();
    this.columnPinning = new Map();
  }

  /** Restores view state while intentionally preserving selection and the current page. */
  resetState(): void {
    this.resetColumns();
    this.sort = [];
    this.filters = [];
    this.searchTerm = '';
    this.expandedKeys = [];
  }

  /** Scrolls the requested processed-row index into the virtual viewport. */
  scrollToIndex(index: number, options: DataGridScrollOptions = {}): void {
    const rows = this.getVisibleRows();
    if (rows.length === 0) return;
    const requestedIndex = finiteInteger(index, 0, 0, rows.length - 1);
    const requestedRow = rows[requestedIndex]!;
    const sourceIndex = this.sourceIndexMap().get(requestedRow);
    const requestedKey = this.keyForRow(
      requestedRow,
      sourceIndex ?? requestedIndex
    );
    const target = this.displayItems.findIndex(
      (item) =>
        item.kind === 'row' &&
        (item.row === requestedRow || keysEqual(item.key, requestedKey))
    );
    if (target < 0) return;
    const rendered = this.renderRoot?.querySelector<HTMLElement>(
      `[part~="row"][data-visible-index="${target}"]`
    );
    if (rendered) {
      rendered.scrollIntoView({ block: options.align ?? 'nearest' });
      return;
    }
    const body = this.bodyElement;
    if (!body) return;
    const rowHeight = this.resolvedRowHeight;
    let top = target * rowHeight;
    if (options.align === 'center') top -= (body.clientHeight - rowHeight) / 2;
    else if (options.align === 'end') top -= body.clientHeight - rowHeight;
    body.scrollTo({ top: Math.max(0, top) });
  }

  /** Applies known fields from a partial serialized view state. */
  setState(state: DataGridState): void {
    const known = new Set(
      this.columns.map((column, index) => columnId(column, index))
    );
    if (state.order)
      this.columnOrder = state.order.filter((id) => known.has(id));
    if (state.widths)
      this.columnWidths = this.validColumnMap(state.widths, known, (width) =>
        finiteRange(width, 0, 0)
      );
    if (state.visibility)
      this.columnVisibility = this.validColumnMap(
        state.visibility,
        known,
        Boolean
      );
    if (state.pinning)
      this.columnPinning = this.validColumnMap(state.pinning, known, (side) =>
        side === 'left' ||
        side === 'right' ||
        side === 'start' ||
        side === 'end'
          ? side
          : false
      );
    if (state.sort)
      this.sort = state.sort
        .filter((item) => known.has(item.id))
        .map((item) => ({ id: item.id, desc: Boolean(item.desc) }));
    if (state.filters)
      this.filters = state.filters
        .filter((item) => known.has(item.id))
        .map((item) => ({ ...item }));
    if (state.search !== undefined) this.searchTerm = state.search;
    if (state.selectedKeys)
      this.selectedKeys = state.selectedKeys.filter(isKey);
    if (state.expandedKeys)
      this.expandedKeys = state.expandedKeys.filter(isKey);
    if (state.page !== undefined) this.page = finiteCount(state.page);
    if (state.pageSize !== undefined)
      this.pageSize = finiteCount(state.pageSize);
  }

  /** Distributes the available body width across visible columns. */
  sizeColumnsToFit(): void {
    const body = this.bodyElement;
    if (!body || this.visibleColumns.length === 0) return;
    const selectionWidth = this.selectionEnabled
      ? resolveCssLength(this.computedToken('--lr-icon-button-size'), {
          host: this,
        }) ?? 0
      : 0;
    const available = Math.max(0, body.clientWidth - selectionWidth);
    const flexible = this.visibleColumns.filter(
      ({ column }) => column.flex !== 0
    );
    if (flexible.length === 0) return;
    const totalFlex =
      flexible.reduce(
        (sum, { column }) => sum + finiteRange(column.flex ?? 1, 1, 0),
        0
      ) || flexible.length;
    const next = new Map(this.columnWidths);
    for (const { column, id } of flexible) {
      const share =
        available * (finiteRange(column.flex ?? 1, 1, 0) / totalFlex);
      const { minimum, maximum } = this.columnBounds(column);
      next.set(id, finiteRange(share, minimum, minimum, maximum));
    }
    this.columnWidths = next;
  }

  /** Shows or hides one column without emitting the user-only visibility event. */
  toggleColumn(columnId: string, visible: boolean): void {
    if (!this.orderedColumns.some(({ id }) => id === columnId)) return;
    const next = new Map(this.columnVisibility);
    next.set(columnId, visible);
    this.columnVisibility = next;
    this.focusedColumn = finiteInteger(
      this.focusedColumn,
      0,
      0,
      Math.max(0, this.visibleColumns.length - 1)
    );
  }

  private validColumnMap<Value, Input>(
    record: Record<string, Input>,
    known: Set<string>,
    convert: (value: Input) => Value
  ): Map<string, Value> {
    const result = new Map<string, Value>();
    for (const [id, value] of Object.entries(record))
      if (known.has(id)) result.set(id, convert(value));
    return result;
  }

  private delimitedRows(
    rows: readonly Row[],
    options: DataGridCsvOptions
  ): string {
    const active = this.visibleColumns.map(({ column, id }) => ({
      ...column,
      id,
      value: (row: Row): unknown => {
        const raw = columnValue(column, row);
        const formatted = column.formatter?.(raw, row);
        return typeof formatted === 'string' ? formatted : raw;
      },
      hidden: false,
    }));
    return rowsAsDelimited(rows, active, options);
  }

  private async copyAndReport(text: string): Promise<void> {
    const owner = this.isConnected ? this.ownerDocument.defaultView : null;
    const outcome = await this.writeClipboard(text, owner);
    if (!owner || !this.isConnected || this.ownerDocument.defaultView !== owner)
      return;
    if (outcome.ok) {
      if (!this.isMounting) this.announce(this.localize('copied'));
      this.emit('lr-copy', outcome);
      return;
    }
    if (!this.isMounting) this.announce(this.localize('copyFailed'));
    this.emit('lr-error');
    this.emit('lr-copy-error', outcome);
  }

  private async writeClipboard(
    text: string,
    owner: Window | null
  ): Promise<LyraClipboardWriteOutcome> {
    const ownerDocument = this.ownerDocument;
    const outcome = await writeClipboardText(owner, text);
    if (
      outcome.ok ||
      !owner ||
      ownerDocument.defaultView !== owner ||
      !ownerDocument.body
    ) {
      return outcome;
    }
    const textarea = ownerDocument.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    ownerDocument.body.append(textarea);
    try {
      textarea.select();
      if (ownerDocument.execCommand?.('copy')) {
        return Object.freeze({ ok: true, text });
      }
    } finally {
      textarea.remove();
    }
    return outcome;
  }

  private setColumnWidth(
    columnIdValue: string,
    width: number,
    emit: boolean,
    finished = true
  ): void {
    const entry = this.orderedColumns.find(({ id }) => id === columnIdValue);
    if (!entry) return;
    const { minimum, maximum } = this.columnBounds(entry.column);
    const safeWidth = finiteRange(width, minimum, minimum, maximum);
    const next = new Map(this.columnWidths);
    next.set(columnIdValue, safeWidth);
    this.columnWidths = next;
    if (emit)
      this.emit(
        'lr-column-resize',
        Object.freeze({
          columnId: columnIdValue,
          width: safeWidth,
          finished,
        })
      );
  }

  private cancelRequestTimer(): void {
    const timer = this.requestTimer;
    this.requestTimer = undefined;
    if (timer) timer.owner.clearTimeout(timer.handle);
  }

  private scheduleServerRequest(delayed: boolean): void {
    const owner = this.ownerDocument.defaultView;
    if (!this.isConnected || !owner || !this.usesServerData) return;
    this.cancelRequestTimer();
    const delay = delayed ? finiteDuration(this.filterDebounce, 250) : 0;
    let handle = 0;
    handle = owner.setTimeout(() => {
      if (
        this.requestTimer?.owner !== owner ||
        this.requestTimer.handle !== handle ||
        !this.isConnected ||
        this.ownerDocument.defaultView !== owner
      )
        return;
      this.requestTimer = undefined;
      void this.loadServerData(owner);
    }, delay);
    this.requestTimer = { owner, handle };
  }

  private async loadServerData(owner: Window): Promise<void> {
    if (
      !this.isConnected ||
      this.ownerDocument.defaultView !== owner ||
      !this.usesServerData
    )
      return;
    this.requestController?.abort();
    const AbortControllerCtor = (owner as Window & typeof globalThis)
      .AbortController;
    this.requestController =
      typeof AbortControllerCtor === 'function'
        ? new AbortControllerCtor()
        : undefined;
    const generation = ++this.requestGeneration;
    const request: DataGridRequest = Object.freeze({
      sort: frozenArray(this.sort.map((item) => Object.freeze({ ...item }))),
      filters: frozenArray(
        this.filters.map((item) =>
          Object.freeze({
            id: item.id,
            value: serializableFilterValue(item.value),
          })
        )
      ),
      search: this.searchTerm,
      page: this.safePage,
      pageSize: this.safePageSize,
      signal: this.requestController?.signal,
    });
    const requestDetail = (): DataGridRequest =>
      Object.freeze({
        ...request,
        sort: frozenArray(
          request.sort.map((item) => Object.freeze({ ...item }))
        ),
        filters: frozenArray(
          request.filters.map((item) =>
            Object.freeze({
              id: item.id,
              value: serializableFilterValue(item.value),
            })
          )
        ),
      });
    this.emit('request', requestDetail());
    if (!this.dataSource) return;
    this.ownsLoadingState = true;
    this.loading = true;
    try {
      const response = await this.dataSource(request);
      if (
        generation !== this.requestGeneration ||
        request.signal?.aborted ||
        !this.isConnected ||
        this.ownerDocument.defaultView !== owner
      )
        return;
      this.data = Array.isArray(response.rows) ? response.rows : [];
      this.total = finiteCount(response.total);
      this.loading = false;
      this.ownsLoadingState = false;
    } catch (error) {
      if (
        generation !== this.requestGeneration ||
        request.signal?.aborted ||
        !this.isConnected ||
        this.ownerDocument.defaultView !== owner
      )
        return;
      this.loading = false;
      this.ownsLoadingState = false;
      this.emit(
        'lr-data-error',
        Object.freeze({ error, request: requestDetail() })
      );
    }
  }

  private get selectionMode(): 'none' | 'single' | 'multiple' {
    if (this.selectable === '' || this.selectable === 'multiple')
      return 'multiple';
    return this.selectable;
  }

  private get selectionEnabled(): boolean {
    return this.selectionMode !== 'none';
  }

  private rowIsSelectable(row: Row): boolean {
    return this.selectionEnabled && (this.selectableRows?.(row) ?? true);
  }

  private rowMatches(row: Row): boolean {
    return (
      filterRows([row], this.columns, this.filters, this.effectiveLocale)
        .length > 0 &&
      searchRows(
        [row],
        this.columns,
        this.searchTerm,
        this.effectiveLocale,
        this.searchFn
      ).length > 0
    );
  }

  private processedChildrenFor(row: Row): Row[] {
    const children = this.childrenFor(row);
    if (children.length === 0 || this.usesServerData) return children;
    const included = children.filter((child) => {
      if (this.rowMatches(child)) return true;
      return this.filterFromLeafRows && this.hasMatchingDescendant(child);
    });
    return sortRows(included, this.columns, this.sort, this.effectiveLocale);
  }

  private hasMatchingDescendant(row: Row): boolean {
    const stack = this.childrenFor(row).map((child) => ({
      row: child,
      depth: 1,
    }));
    const visited = new Set<unknown>();
    let inspected = 0;
    while (stack.length > 0 && inspected < DATA_GRID_TREE_NODE_LIMIT) {
      const current = stack.pop()!;
      const trackIdentity =
        (typeof current.row === 'object' && current.row !== null) ||
        typeof current.row === 'function';
      if (trackIdentity && visited.has(current.row)) continue;
      if (trackIdentity) visited.add(current.row);
      inspected += 1;
      if (this.rowMatches(current.row)) return true;
      if (current.depth >= DATA_GRID_TREE_DEPTH_LIMIT) continue;
      for (const child of this.childrenFor(current.row)) {
        stack.push({ row: child, depth: current.depth + 1 });
      }
    }
    return false;
  }

  private get pageRows(): readonly Row[] {
    return this.getVisibleRows();
  }

  private get currentPageSelectableRows(): Array<{
    row: Row;
    key: DataGridKey;
  }> {
    const result: Array<{ row: Row; key: DataGridKey }> = [];
    const sourceIndex = new Map(
      this.allSourceRows.map((row, index) => [row, index])
    );
    const visited = new Set<unknown>();
    const stack = [...this.pageRows]
      .reverse()
      .map((row) => ({ row, depth: 0 }));
    let inspected = 0;
    while (stack.length > 0 && inspected < DATA_GRID_TREE_NODE_LIMIT) {
      const current = stack.pop()!;
      const trackIdentity =
        (typeof current.row === 'object' && current.row !== null) ||
        typeof current.row === 'function';
      if (trackIdentity && visited.has(current.row)) continue;
      if (trackIdentity) visited.add(current.row);
      inspected += 1;
      const index = sourceIndex.get(current.row);
      const key = this.keyForRow(current.row, index ?? result.length);
      if (this.rowIsSelectable(current.row))
        result.push({ row: current.row, key });
      if (current.depth >= DATA_GRID_TREE_DEPTH_LIMIT) continue;
      const children = this.childrenFor(current.row);
      for (
        let childIndex = children.length - 1;
        childIndex >= 0;
        childIndex -= 1
      ) {
        stack.push({ row: children[childIndex]!, depth: current.depth + 1 });
      }
    }
    return result;
  }

  private groupKey(parent: string, id: string, value: unknown): string {
    return `group:${parent}:${id}:${typeof value}:${safeText(value)}`;
  }

  private topLevelGroupBuckets(
    rows: readonly Row[]
  ): Array<{ value: unknown; rows: Row[] }> {
    const field = normalizedGroupBy(this.groupBy)[0];
    if (!field) return [];
    const entry = this.orderedColumns.find(
      ({ id, column }) => id === field || column.field === field
    );
    if (!entry) return [];
    const buckets = new Map<unknown, Row[]>();
    for (const row of rows) {
      const value = columnValue(entry.column, row);
      const bucket = buckets.get(value) ?? [];
      bucket.push(row);
      buckets.set(value, bucket);
    }
    return [...buckets].map(([value, bucketRows]) => ({
      value,
      rows: bucketRows,
    }));
  }

  private groupItems(rows: readonly Row[]): DataDisplayGroup<Row>[] {
    const fields = normalizedGroupBy(this.groupBy);
    if (fields.length === 0 || this.usesServerData) return [];
    const result: DataDisplayGroup<Row>[] = [];
    const visit = (
      groupRows: readonly Row[],
      depth: number,
      parent: string
    ): void => {
      const field = fields[depth];
      if (!field) return;
      const entry = this.orderedColumns.find(
        ({ id, column }) => id === field || column.field === field
      );
      if (!entry) return;
      const buckets = new Map<unknown, Row[]>();
      for (const row of groupRows) {
        const value = columnValue(entry.column, row);
        const bucket = buckets.get(value) ?? [];
        bucket.push(row);
        buckets.set(value, bucket);
      }
      for (const [value, bucket] of buckets) {
        const key = this.groupKey(parent, entry.id, value);
        result.push({
          kind: 'group',
          key,
          value,
          columnId: entry.id,
          rows: bucket,
          depth,
        });
        if (depth + 1 < fields.length) visit(bucket, depth + 1, key);
      }
    };
    visit(rows, 0, 'root');
    return result;
  }

  private get displayItems(): DisplayItem<Row>[] {
    const groups = normalizedGroupBy(this.groupBy);
    if (groups.length > 0 && !this.usesServerData)
      return this.groupedDisplayItems(
        this.pageRows,
        groups,
        0,
        'root',
        this.sourceIndexMap()
      );
    const result: DisplayItem<Row>[] = [];
    const sourceRows = this.allSourceRows;
    const indexes = this.sourceIndexMap(sourceRows);
    const visited = new Set<unknown>();
    const stack = [...this.pageRows]
      .reverse()
      .map((row) => ({ row, depth: 0 }));
    while (stack.length > 0 && result.length < DATA_GRID_TREE_NODE_LIMIT) {
      const current = stack.pop()!;
      const trackIdentity =
        (typeof current.row === 'object' && current.row !== null) ||
        typeof current.row === 'function';
      if (trackIdentity && visited.has(current.row)) continue;
      if (trackIdentity) visited.add(current.row);
      const sourceIndex = indexes.get(current.row);
      const safeIndex = sourceIndex ?? result.length;
      const key = this.keyForRow(current.row, safeIndex);
      result.push({
        kind: 'row',
        row: current.row,
        key,
        depth: current.depth,
        sourceIndex: safeIndex,
      });
      if (
        !arrayHasKey(this.expandedKeys, key) ||
        current.depth >= DATA_GRID_TREE_DEPTH_LIMIT
      )
        continue;
      const children = this.processedChildrenFor(current.row);
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push({ row: children[index]!, depth: current.depth + 1 });
      }
    }
    return result;
  }

  private groupedDisplayItems(
    rows: readonly Row[],
    fields: readonly string[],
    depth: number,
    parent: string,
    sourceIndexes: ReadonlyMap<Row, number>
  ): DisplayItem<Row>[] {
    const field = fields[depth];
    if (!field) return [];
    const entry = this.orderedColumns.find(
      ({ id, column }) => id === field || column.field === field
    );
    if (!entry)
      return rows.map((row, index) => ({
        kind: 'row',
        row,
        key: this.keyForRow(row, sourceIndexes.get(row) ?? index),
        depth,
        sourceIndex: sourceIndexes.get(row) ?? index,
      }));
    const buckets = new Map<unknown, Row[]>();
    for (const row of rows) {
      const value = columnValue(entry.column, row);
      const bucket = buckets.get(value) ?? [];
      bucket.push(row);
      buckets.set(value, bucket);
    }
    const result: DisplayItem<Row>[] = [];
    for (const [value, bucket] of buckets) {
      const key = this.groupKey(parent, entry.id, value);
      result.push({
        kind: 'group',
        key,
        value,
        columnId: entry.id,
        rows: bucket,
        depth,
      });
      if (!arrayHasKey(this.expandedKeys, key)) continue;
      if (depth + 1 < fields.length)
        result.push(
          ...this.groupedDisplayItems(
            bucket,
            fields,
            depth + 1,
            key,
            sourceIndexes
          )
        );
      else {
        for (const row of bucket) {
          const sourceIndex = sourceIndexes.get(row);
          result.push({
            kind: 'row',
            row,
            key: this.keyForRow(row, sourceIndex ?? result.length),
            depth: depth + 1,
            sourceIndex: sourceIndex ?? result.length,
          });
        }
      }
    }
    return result;
  }

  private get resolvedRowHeight(): number {
    const raw = this.computedToken(
      '--row-height',
      '--_lr-data-grid-row-height'
    );
    return finiteRange(resolveCssLength(raw, { host: this }) ?? 56, 56, 1);
  }

  private get virtualWindow(): {
    items: DisplayItem<Row>[];
    start: number;
    end: number;
  } {
    const items = this.displayItems;
    const expandedDetails = Boolean(
      this.rowDetail &&
        items.some(
          (item) =>
            item.kind === 'row' && arrayHasKey(this.expandedKeys, item.key)
        )
    );
    const disable =
      items.length < VIRTUALIZATION_THRESHOLD ||
      expandedDetails ||
      this.computedToken('--max-height', '--_lr-data-grid-max-height') ===
        'none';
    if (disable) return { items, start: 0, end: items.length };
    const height = this.resolvedRowHeight;
    const visibleCount = Math.max(
      1,
      Math.ceil((this.viewportHeight || height * 10) / height)
    );
    const start = Math.min(
      Math.max(0, items.length - visibleCount),
      Math.max(0, Math.floor(this.bodyScrollTop / height) - VIRTUAL_OVERSCAN)
    );
    const end = Math.min(
      items.length,
      start + visibleCount + VIRTUAL_OVERSCAN * 2
    );
    return { items: items.slice(start, end), start, end };
  }

  private get gridTemplate(): string {
    const columns = this.visibleColumns.map(({ column, id }) => {
      const bounds = this.columnBounds(column);
      const width = this.columnWidths.get(id) ?? column.width;
      if (width !== undefined && Number.isFinite(width) && width > 0)
        return `${finiteRange(
          width,
          bounds.minimum,
          bounds.minimum,
          bounds.maximum
        )}px`;
      const minimum =
        bounds.minimum > 0
          ? `${bounds.minimum}px`
          : Number.isFinite(column.maxWidth) && (column.maxWidth ?? 0) > 0
          ? '0px'
          : 'var(--lr-size-7rem)';
      const maximum =
        Number.isFinite(column.maxWidth) && (column.maxWidth ?? 0) > 0
          ? `${bounds.maximum}px`
          : `${finiteRange(column.flex ?? 1, 1, 0)}fr`;
      return `minmax(${minimum}, ${maximum})`;
    });
    if (this.selectionEnabled) columns.unshift('var(--lr-icon-button-size)');
    return columns.length > 0
      ? columns.join(' ')
      : 'minmax(var(--lr-size-7rem), 1fr)';
  }

  private columnStyle(
    column: DataGridColumn<Row>,
    id: string
  ): Record<string, string> {
    const side = normalizePinSide(this.getColumnPin(id));
    const pinOffset = side ? this.pinOffset(id, side) : 0;
    return {
      ...(side ? { '--pin-offset': `${pinOffset}px` } : {}),
      ...(Number.isFinite(column.width) &&
      (column.width ?? 0) > 0 &&
      !this.columnWidths.has(id)
        ? { '--column-authored-width': `${column.width}px` }
        : {}),
    };
  }

  private estimatedColumnWidth(
    column: DataGridColumn<Row>,
    id: string
  ): number {
    const { minimum, maximum } = this.columnBounds(column);
    const explicit = this.columnWidths.get(id) ?? column.width;
    if (explicit !== undefined)
      return finiteRange(explicit, Math.max(112, minimum), minimum, maximum);
    const raw = this.computedToken('--lr-size-7rem');
    return finiteRange(
      resolveCssLength(raw, { host: this }) ?? 112,
      Math.max(112, minimum),
      minimum,
      maximum
    );
  }

  private columnBounds(column: DataGridColumn<Row>): {
    readonly minimum: number;
    readonly maximum: number;
  } {
    const minimum = finiteRange(column.minWidth ?? 0, 0, 0);
    const authoredMaximum = finiteRange(
      column.maxWidth ?? Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      0
    );
    return Object.freeze({
      minimum,
      maximum: Math.max(minimum, authoredMaximum),
    });
  }

  private pinOffset(id: string, side: 'left' | 'right'): number {
    const entries = this.visibleColumns;
    const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0) return 0;
    const subset =
      side === 'left' ? entries.slice(0, index) : entries.slice(index + 1);
    return subset
      .filter((entry) => normalizePinSide(this.getColumnPin(entry.id)) === side)
      .reduce(
        (sum, entry) => sum + this.estimatedColumnWidth(entry.column, entry.id),
        0
      );
  }

  private columnLabel(column: DataGridColumn<Row>, id: string): string {
    return (
      column.label ??
      humanizeIdentifier(column.field ?? id, this.effectiveLocale)
    );
  }

  private columnIsSortable(column: DataGridColumn<Row>): boolean {
    return column.sortable !== false && Boolean(column.field || column.value);
  }

  private sortFor(id: string): {
    state: DataGridSortingState[number] | undefined;
    index: number;
  } {
    const index = this.sort.findIndex((item) => item.id === id);
    return { state: index >= 0 ? this.sort[index] : undefined, index };
  }

  private activateSort(id: string, additive: boolean): void {
    const entry = this.orderedColumns.find((item) => item.id === id);
    if (!entry || !this.columnIsSortable(entry.column)) return;
    const existing = this.sortFor(id).state;
    const descendingFirst = entry.column.sortDescFirst ?? this.sortDescFirst;
    let replacement: DataGridSortingState[number] | undefined;
    if (!existing) replacement = { id, desc: descendingFirst };
    else if (existing.desc === descendingFirst)
      replacement = { id, desc: !descendingFirst };
    else if (this.withoutSortRemoval)
      replacement = { id, desc: descendingFirst };

    let next = additive ? this.sort.filter((item) => item.id !== id) : [];
    if (replacement) next.push(replacement);
    const limit = finiteCount(this.maxMultiSort);
    if (limit > 0 && next.length > limit)
      next = next.slice(next.length - limit);
    this.sort = next;
    this.page = 0;
    this.emit(
      'lr-sort-change',
      Object.freeze({
        sort: frozenArray(this.sort.map((item) => Object.freeze({ ...item }))),
      })
    );
  }

  private onHeaderClick(event: MouseEvent, id: string): void {
    const target = event.target;
    const interactive = isElementValue(target)
      ? target.closest(INTERACTIVE_SELECTOR)
      : null;
    if (interactive && interactive !== event.currentTarget) return;
    this.activateSort(id, event.shiftKey);
  }

  private onFilterInput(event: Event, id: string): void {
    const control = valueControl(event.currentTarget);
    if (!control) return;
    const value = control.value;
    const next = this.filters.filter((filter) => filter.id !== id);
    if (value) next.push({ id, value });
    this.filters = next;
    this.page = 0;
    this.emit(
      'lr-filter-change',
      Object.freeze({
        filters: frozenArray(
          next.map((filter) => Object.freeze({ ...filter }))
        ),
      })
    );
  }

  private onBodyScroll(event: Event): void {
    const target = event.currentTarget as
      | (Element & { scrollTop?: unknown; clientHeight?: unknown })
      | null;
    if (
      !isElementValue(target) ||
      typeof target.scrollTop !== 'number' ||
      typeof target.clientHeight !== 'number'
    )
      return;
    this.bodyScrollTop = target.scrollTop;
    this.viewportHeight = target.clientHeight;
  }

  private onCellClick(
    event: MouseEvent,
    item: DataDisplayRow<Row>,
    column: DataGridColumn<Row>,
    index: number
  ): void {
    const target = event.target;
    const interactive = isElementValue(target)
      ? target.closest(INTERACTIVE_SELECTOR)
      : null;
    if (
      interactive &&
      interactive !== event.currentTarget &&
      isElementValue(event.currentTarget) &&
      event.currentTarget.contains(interactive)
    )
      return;
    this.emit(
      'lr-cell-click',
      Object.freeze({
        column,
        value: columnValue(column, item.row),
        row: item.row,
        index,
      })
    );
  }

  private emitCellContextMenu(
    originalEvent: MouseEvent | KeyboardEvent,
    item: DataDisplayRow<Row>,
    column: DataGridColumn<Row>,
    index: number
  ): void {
    const detail: DataGridCellContextMenuDetail<Row> = Object.freeze({
      column,
      value: columnValue(column, item.row),
      row: item.row,
      index,
      originalEvent,
    });
    const emitted = this.emit('lr-cell-contextmenu', detail, {
      cancelable: true,
    });
    if (emitted.defaultPrevented) originalEvent.preventDefault();
  }

  private descendantRows(row: Row): Row[] {
    const result: Row[] = [];
    const visited = new Set<unknown>();
    const stack = this.childrenFor(row)
      .reverse()
      .map((child) => ({ row: child, depth: 1 }));
    while (stack.length > 0 && result.length < DATA_GRID_TREE_NODE_LIMIT) {
      const current = stack.pop()!;
      const trackIdentity =
        (typeof current.row === 'object' && current.row !== null) ||
        typeof current.row === 'function';
      if (trackIdentity && visited.has(current.row)) continue;
      if (trackIdentity) visited.add(current.row);
      result.push(current.row);
      if (current.depth >= DATA_GRID_TREE_DEPTH_LIMIT) continue;
      const children = this.childrenFor(current.row);
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push({ row: children[index]!, depth: current.depth + 1 });
      }
    }
    return result;
  }

  private setRowSelected(
    item: DataDisplayRow<Row>,
    selected: boolean,
    event?: MouseEvent
  ): void {
    if (!this.rowIsSelectable(item.row)) return;
    const selectableItems = this.displayItems.filter(
      (candidate): candidate is DataDisplayRow<Row> =>
        candidate.kind === 'row' && this.rowIsSelectable(candidate.row)
    );
    const position = selectableItems.findIndex((candidate) =>
      keysEqual(candidate.key, item.key)
    );
    let affected = [item];
    if (
      event?.shiftKey &&
      this.selectionMode === 'multiple' &&
      this.lastSelectedIndex >= 0
    ) {
      const from = Math.min(this.lastSelectedIndex, position);
      const to = Math.max(this.lastSelectedIndex, position);
      affected = selectableItems.slice(from, to + 1);
    }
    const descendants =
      this.selectionMode === 'multiple'
        ? affected
            .flatMap((candidate) => this.descendantRows(candidate.row))
            .filter((row) => this.rowIsSelectable(row))
        : [];
    const sourceIndexes = this.sourceIndexMap();
    const keys = [
      ...affected.map((candidate) => candidate.key),
      ...descendants.map((row, index) => {
        const sourceIndex = sourceIndexes.get(row);
        return this.keyForRow(row, sourceIndex ?? index);
      }),
    ];
    let next = this.selectionMode === 'single' ? [] : [...this.selectedKeys];
    for (const key of keys) {
      next = next.filter((candidate) => !keysEqual(candidate, key));
      if (selected) next.push(key);
    }
    this.selectedKeys = next;
    this.lastSelectedIndex = position;
    this.emitSelection();
  }

  private selectCurrentPage(selected: boolean): void {
    const pageKeys = this.currentPageSelectableRows.map((item) => item.key);
    let next = this.selectedKeys.filter(
      (key) => !pageKeys.some((pageKey) => keysEqual(pageKey, key))
    );
    if (selected) next = [...next, ...pageKeys];
    this.selectedKeys = next;
    this.emitSelection();
  }

  private emitSelection(): void {
    const selectedKeys = frozenArray(this.selectedKeys);
    const selectedRows = frozenArray(this.selectedRows);
    this.emit('lr-row-select', Object.freeze({ selectedKeys, selectedRows }));
  }

  private rowSelectionState(item: DataDisplayRow<Row>): {
    checked: boolean;
    indeterminate: boolean;
  } {
    const own = arrayHasKey(this.selectedKeys, item.key);
    const descendants = this.descendantRows(item.row).filter((row) =>
      this.rowIsSelectable(row)
    );
    if (descendants.length === 0) return { checked: own, indeterminate: false };
    const sourceIndexes = this.sourceIndexMap();
    const selected = descendants.filter((row, index) => {
      const sourceIndex = sourceIndexes.get(row);
      return arrayHasKey(
        this.selectedKeys,
        this.keyForRow(row, sourceIndex ?? index)
      );
    }).length;
    const checked = own && selected === descendants.length;
    return {
      checked,
      indeterminate: !checked && (own || selected > 0),
    };
  }

  private toggleRowExpanded(
    item: DataDisplayRow<Row>,
    emitUserEvent: boolean
  ): void {
    const expanded = arrayHasKey(this.expandedKeys, item.key);
    if (expanded) this.collapseRow(item.key);
    else this.expandRow(item.key);
    if (emitUserEvent) {
      this.emit(
        expanded ? 'lr-row-collapse' : 'lr-row-expand',
        Object.freeze({
          key: item.key,
          row: item.row,
        })
      );
    }
  }

  private toggleGroupExpanded(item: DataDisplayGroup<Row>): void {
    const expanded = arrayHasKey(this.expandedKeys, item.key);
    if (expanded) this.collapseRow(item.key);
    else this.expandRow(item.key);
    const detail = Object.freeze({
      key: item.key,
      columnId: item.columnId,
      value: item.value,
      rows: frozenArray(item.rows),
    });
    this.emit(expanded ? 'lr-group-collapse' : 'lr-group-expand', detail);
  }

  private moveColumn(id: string, delta: number, emitUserEvent: boolean): void {
    const order = this.orderedColumns.map((entry) => entry.id);
    const from = order.indexOf(id);
    if (from < 0) return;
    const to = finiteInteger(from + delta, from, 0, order.length - 1);
    if (from === to) return;
    order.splice(from, 1);
    order.splice(to, 0, id);
    this.columnOrder = order;
    if (emitUserEvent)
      this.emit(
        'lr-column-move',
        Object.freeze({
          columnOrder: frozenArray(order),
          columnId: id,
          finished: true,
        })
      );
  }

  private columnCanMove(id: string): boolean {
    const entry = this.orderedColumns.find((item) => item.id === id);
    return Boolean(entry && (this.reorderable || entry.column.movable));
  }

  private columnCanResize(id: string): boolean {
    const entry = this.orderedColumns.find((item) => item.id === id);
    return Boolean(entry && (this.resizable || entry.column.resizable));
  }

  private onDragStart(event: DragEvent, id: string): void {
    const entry = this.orderedColumns.find((item) => item.id === id);
    if (!entry || !this.columnCanMove(id) || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    const token = `${++this.columnDragSequence}:${id}`;
    this.columnDragSession = Object.freeze({ sourceId: id, token });
    event.dataTransfer.setData(DATA_GRID_DRAG_TYPE, token);
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'move';
    this.dragGhost = this.columnLabel(entry.column, id);
  }

  private onDrop(event: DragEvent, targetId: string): void {
    event.preventDefault();
    const session = this.columnDragSession;
    const token = event.dataTransfer?.getData(DATA_GRID_DRAG_TYPE);
    const sourceId = session?.sourceId;
    this.columnDragSession = undefined;
    this.dragGhost = '';
    if (
      !session ||
      token !== session.token ||
      !sourceId ||
      sourceId === targetId ||
      !this.columnCanMove(sourceId) ||
      !this.columnCanMove(targetId)
    )
      return;
    const order = this.orderedColumns.map((entry) => entry.id);
    const source = order.indexOf(sourceId);
    const target = order.indexOf(targetId);
    if (source < 0 || target < 0) return;
    order.splice(source, 1);
    order.splice(target, 0, sourceId);
    this.columnOrder = order;
    this.emit(
      'lr-column-move',
      Object.freeze({
        columnOrder: frozenArray(order),
        columnId: sourceId,
        finished: true,
      })
    );
  }

  private onResizeStart(event: PointerEvent, id: string): void {
    const entry = this.orderedColumns.find((item) => item.id === id);
    if (!entry || !this.columnCanResize(id)) return;
    const header = this.renderedColumnElements(id, 'columnheader')[0];
    this.resizeSession = {
      columnId: id,
      startClientX: event.clientX,
      startWidth:
        header?.getBoundingClientRect().width ??
        this.estimatedColumnWidth(entry.column, id),
      initialStateWidth: this.columnWidths.get(id),
      pointerId: event.pointerId,
      moved: false,
      direction: this.effectiveDirection,
    };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic pointer events and a pointer canceled before this handler may have no active id.
    }
    event.preventDefault();
  }

  private onResizeMove(event: PointerEvent): void {
    const session = this.resizeSession;
    if (!session || event.pointerId !== session.pointerId) return;
    if (!this.columnCanResize(session.columnId)) {
      this.resizeSession = undefined;
      if (session.moved) this.restoreResizeSession(session, true);
      return;
    }
    const direction = session.direction === 'rtl' ? -1 : 1;
    this.setColumnWidth(
      session.columnId,
      session.startWidth + (event.clientX - session.startClientX) * direction,
      true,
      false
    );
    session.moved = true;
  }

  private takeResizeSession(event: PointerEvent): ResizeSession | undefined {
    const session = this.resizeSession;
    if (!session || event.pointerId !== session.pointerId) return undefined;
    this.resizeSession = undefined;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture?.(
        event.pointerId
      );
    } catch {
      // The user agent may already have released capture for pointercancel.
    }
    return session;
  }

  private restoreResizeSession(session: ResizeSession, emit: boolean): void {
    const next = new Map(this.columnWidths);
    if (session.initialStateWidth === undefined) next.delete(session.columnId);
    else next.set(session.columnId, session.initialStateWidth);
    this.columnWidths = next;
    if (emit) {
      this.emit(
        'lr-column-resize',
        Object.freeze({
          columnId: session.columnId,
          width: session.startWidth,
          finished: false,
        })
      );
    }
  }

  private onResizeEnd(event: PointerEvent): void {
    const session = this.takeResizeSession(event);
    if (!session) return;
    if (!this.columnCanResize(session.columnId)) {
      if (session.moved) this.restoreResizeSession(session, true);
      return;
    }
    const width = this.columnWidths.get(session.columnId) ?? session.startWidth;
    this.emit(
      'lr-column-resize',
      Object.freeze({
        columnId: session.columnId,
        width,
        finished: true,
      })
    );
  }

  private onResizeCancel(event: PointerEvent): void {
    const session = this.takeResizeSession(event);
    if (!session || !session.moved) return;
    this.restoreResizeSession(session, true);
  }

  private onResizeKey(event: KeyboardEvent, id: string): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const entry = this.orderedColumns.find((item) => item.id === id);
    if (!entry || !this.columnCanResize(id)) return;
    const logical =
      (event.key === 'ArrowRight' ? 1 : -1) *
      (this.effectiveDirection === 'rtl' ? -1 : 1);
    const current =
      this.columnWidths.get(id) ?? this.estimatedColumnWidth(entry.column, id);
    this.setColumnWidth(id, current + logical * 10, true, true);
    event.preventDefault();
  }

  private onPageSizeChange(event: Event): void {
    const control = valueControl(event.currentTarget);
    if (!control) return;
    this.pageSize = finiteCount(Number(control.value));
    this.page = 0;
    this.emit(
      'lr-page-change',
      Object.freeze({ page: 0, pageSize: this.safePageSize })
    );
  }

  private focusCell(row: number, column: number): void {
    const rowLimit = Math.max(-1, this.displayItems.length - 1);
    const columnLimit = Math.max(0, this.visibleColumns.length - 1);
    this.focusedRow = finiteInteger(row, this.focusedRow, -1, rowLimit);
    this.focusedColumn = finiteInteger(
      column,
      this.focusedColumn,
      0,
      columnLimit
    );
    let pendingScrollTop: number | undefined;
    if (this.focusedRow >= 0) {
      const selector = `[role="gridcell"][data-row-position="${this.focusedRow}"]`;
      if (!this.renderRoot.querySelector(selector)) {
        const top = this.focusedRow * this.resolvedRowHeight;
        pendingScrollTop = top;
        this.bodyScrollTop = top;
        if (this.bodyElement) this.bodyElement.scrollTop = top;
      }
    }
    void this.updateComplete.then(() => {
      // WebKit clamps a pre-render write to zero when the virtual spacer has not established its
      // final scroll range yet. Restore the requested offset once that render is committed, then
      // focus the newly materialized cell.
      if (pendingScrollTop !== undefined && this.bodyElement) {
        this.bodyElement.scrollTop = pendingScrollTop;
      }
      this.focus();
    });
  }

  private onGridKeyDown(
    event: KeyboardEvent,
    rowPosition: number,
    columnPosition: number,
    item?: DataDisplayRow<Row>,
    column?: DataGridColumn<Row>,
    columnIdValue?: string
  ): void {
    const target = event.target;
    if (
      isElementValue(target) &&
      target !== event.currentTarget &&
      target.closest(INTERACTIVE_SELECTOR)
    ) {
      return;
    }
    const rtlMultiplier = this.effectiveDirection === 'rtl' ? -1 : 1;
    if (
      event.ctrlKey &&
      event.key.toLowerCase() === 'a' &&
      this.selectionMode === 'multiple'
    ) {
      this.selectCurrentPage(true);
      event.preventDefault();
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'c') {
      this.copySelectedRows();
      event.preventDefault();
      return;
    }
    if (event.shiftKey && event.key === 'F10' && item && column) {
      this.emitCellContextMenu(event, item, column, rowPosition);
      return;
    }
    const headerEntry = columnIdValue
      ? this.orderedColumns.find((entry) => entry.id === columnIdValue)
      : undefined;
    if (
      rowPosition < 0 &&
      columnIdValue &&
      headerEntry &&
      (this.reorderable || headerEntry.column.movable) &&
      event.shiftKey &&
      !event.altKey &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    ) {
      const delta = (event.key === 'ArrowRight' ? 1 : -1) * rtlMultiplier;
      this.moveColumn(columnIdValue, delta, true);
      event.preventDefault();
      return;
    }
    if (
      rowPosition < 0 &&
      columnIdValue &&
      headerEntry &&
      (this.resizable || headerEntry.column.resizable) &&
      event.altKey
    ) {
      this.onResizeKey(event, columnIdValue);
      if (event.defaultPrevented) return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const delta = (event.key === 'ArrowRight' ? 1 : -1) * rtlMultiplier;
      this.focusCell(rowPosition, columnPosition + delta);
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      this.focusCell(rowPosition - 1, columnPosition);
      event.preventDefault();
    } else if (event.key === 'ArrowDown') {
      this.focusCell(rowPosition + 1, columnPosition);
      event.preventDefault();
    } else if (event.key === 'Home') {
      this.focusCell(event.ctrlKey ? -1 : rowPosition, 0);
      event.preventDefault();
    } else if (event.key === 'End') {
      this.focusCell(
        event.ctrlKey ? this.displayItems.length - 1 : rowPosition,
        this.visibleColumns.length - 1
      );
      event.preventDefault();
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const delta =
        event.key === 'PageDown'
          ? this.safePageSize || 10
          : -(this.safePageSize || 10);
      this.focusCell(rowPosition + delta, columnPosition);
      event.preventDefault();
    } else if (event.key === 'Enter') {
      if (rowPosition < 0 && columnIdValue)
        this.activateSort(columnIdValue, event.shiftKey);
      else if (item && column)
        this.emit(
          'lr-cell-click',
          Object.freeze({
            column,
            value: columnValue(column, item.row),
            row: item.row,
            index: rowPosition,
          })
        );
      event.preventDefault();
    } else if (event.key === ' ' && item) {
      const selected = !arrayHasKey(this.selectedKeys, item.key);
      this.setRowSelected(item, selected, event as unknown as MouseEvent);
      event.preventDefault();
    }
  }

  private setGroupSelected(
    group: DataDisplayGroup<Row>,
    selected: boolean
  ): void {
    const eligible = group.rows.filter((row) => this.rowIsSelectable(row));
    const sourceIndexes = this.sourceIndexMap();
    const groupKeys = eligible.map((row, index) => {
      const sourceIndex = sourceIndexes.get(row);
      return this.keyForRow(row, sourceIndex ?? index);
    });
    let next = this.selectedKeys.filter(
      (key) => !groupKeys.some((groupKey) => keysEqual(groupKey, key))
    );
    if (selected) next = [...next, ...groupKeys];
    this.selectedKeys = next;
    this.emitSelection();
  }

  private userPinColumn(id: string, side: DataGridPinSide): void {
    this.pinColumn(id, side);
    this.emit('lr-column-pin', Object.freeze({ columnId: id, side }));
  }

  private userToggleColumn(id: string, visible: boolean): void {
    this.toggleColumn(id, visible);
    this.emit(
      'lr-column-visibility-change',
      Object.freeze({ columnId: id, visible })
    );
  }

  private relayEditorFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  private relayEditorBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  private renderToolbar(): TemplateResult | typeof nothing {
    if (!this.withSearch && !this.withColumnsMenu) return nothing;
    return html`
      <div part="toolbar">
        ${this.withSearch
          ? html`
              <input
                part="search"
                type="search"
                .value=${this.searchTerm}
                aria-label=${this.localize("search")}
                placeholder=${this.localize("search")}
                @input=${this.applySearchTermChange}
                @focus=${this.relayEditorFocus}
                @blur=${this.relayEditorBlur}
              />
            `
          : nothing}
        ${this.withColumnsMenu
          ? html`
              <div part="columns-menu">
                <button
                  type="button"
                  aria-expanded=${this.columnsMenuOpen ? "true" : "false"}
                  @click=${() => {
                    this.columnsMenuOpen = !this.columnsMenuOpen;
                  }}
                >
                  ${this.localize("showAllColumns")}
                </button>
                ${this.columnsMenuOpen
                  ? html`
                      <div
                        role="group"
                        aria-label=${this.localize("showAllColumns")}
                      >
                        ${this.orderedColumns.map(({ column, id }) => {
                          const visible =
                            this.columnVisibility.get(id) ??
                            column.hidden !== true;
                          return html`
                            <label>
                              <input
                                type="checkbox"
                                .checked=${visible}
                                ?disabled=${column.hideable === false}
                                @change=${(event: Event) => {
                                  const control = checkableControl(
                                    event.currentTarget
                                  );
                                  if (control)
                                    this.userToggleColumn(id, control.checked);
                                }}
                              />
                              ${this.columnLabel(column, id)}
                            </label>
                          `;
                        })}
                      </div>
                    `
                  : nothing}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderSelectAllHeader(): TemplateResult | typeof nothing {
    if (!this.selectionEnabled) return nothing;
    const items = this.currentPageSelectableRows;
    const selected = items.filter((item) =>
      arrayHasKey(this.selectedKeys, item.key)
    ).length;
    return html`
      <div role="columnheader" aria-colindex="1">
        ${this.selectionMode === "multiple"
          ? html`
              <input
                part="select-all-checkbox"
                type="checkbox"
                aria-label=${this.localize("select")}
                .checked=${items.length > 0 && selected === items.length}
                .indeterminate=${selected > 0 && selected < items.length}
                ?disabled=${items.length === 0}
                @change=${(event: Event) => {
                  const control = checkableControl(event.currentTarget);
                  if (control) this.selectCurrentPage(control.checked);
                }}
              />
            `
          : nothing}
      </div>
    `;
  }

  private renderColumnMenu(
    column: DataGridColumn<Row>,
    id: string
  ): TemplateResult | typeof nothing {
    if (!this.withColumnMenu) return nothing;
    const open = this.activeColumnMenu === id;
    const pinAllowed = this.pinnable || column.pinnable;
    const visible = this.columnVisibility.get(id) ?? column.hidden !== true;
    const label = this.columnLabel(column, id);
    const menuId = `column-menu-${Math.max(
      0,
      this.orderedColumns.findIndex((entry) => entry.id === id)
    )}`;
    const menuLabel = this.localize('dataGridColumnMenu', undefined, { label });
    return html`
      <div part="column-menu">
        <button
          part="column-menu-button"
          type="button"
          aria-label=${menuLabel}
          aria-controls=${menuId}
          aria-expanded=${open ? "true" : "false"}
          @click=${() => {
            this.activeColumnMenu = open ? null : id;
          }}
        >
          <span aria-hidden="true">⋮</span>
        </button>
        ${open
          ? html`
              <div
                id=${menuId}
                role="group"
                aria-label=${menuLabel}
                @keydown=${(event: KeyboardEvent) => {
                  if (event.key !== "Escape") return;
                  this.activeColumnMenu = null;
                  event.preventDefault();
                  const trigger = (
                    event.currentTarget as HTMLElement
                  ).parentElement?.querySelector<HTMLElement>(
                    '[part="column-menu-button"]'
                  );
                  void this.updateComplete.then(() => trigger?.focus());
                }}
              >
                ${pinAllowed
                  ? html`
                      <button
                        type="button"
                        data-column-action="pin-start"
                        @click=${() => this.userPinColumn(id, "left")}
                      >
                        ${this.localize("dataGridPinStart", undefined, {
                          label,
                        })}
                      </button>
                      <button
                        type="button"
                        data-column-action="pin-end"
                        @click=${() => this.userPinColumn(id, "right")}
                      >
                        ${this.localize("dataGridPinEnd", undefined, { label })}
                      </button>
                      <button
                        type="button"
                        data-column-action="unpin"
                        @click=${() => this.userPinColumn(id, false)}
                      >
                        ${this.localize("dataGridUnpin", undefined, { label })}
                      </button>
                    `
                  : nothing}
                ${column.hideable === false
                  ? nothing
                  : html`
                      <label data-column-visibility>
                        <input
                          type="checkbox"
                          .checked=${visible}
                          @change=${(event: Event) => {
                            const control = checkableControl(
                              event.currentTarget
                            );
                            if (control)
                              this.userToggleColumn(id, control.checked);
                          }}
                        />
                        ${this.columnLabel(column, id)}
                      </label>
                    `}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderHeader(): TemplateResult {
    const selectionOffset = this.selectionEnabled ? 1 : 0;
    return html`
      <div
        part="header"
        role="row"
        style=${styleMap({ "--data-grid-columns": this.gridTemplate })}
      >
        ${this.renderSelectAllHeader()}
        ${this.visibleColumns.length === 0 && !this.selectionEnabled
          ? html`
              <div role="columnheader" aria-colindex="1">
                ${this.localize("noColumns")}
              </div>
            `
          : nothing}
        ${this.visibleColumns.map(({ column, id }, position) => {
          const sorting = this.sortFor(id);
          const sortable = this.columnIsSortable(column);
          const direction = sorting.state?.desc ? "descending" : "ascending";
          const canResize = this.resizable || column.resizable;
          const canMove = this.reorderable || column.movable;
          const resizeBounds = this.columnBounds(column);
          const resizeValue = this.estimatedColumnWidth(column, id);
          return html`
            <div
              part="header-cell"
              role="columnheader"
              aria-colindex=${position + 1 + selectionOffset}
              aria-sort=${sorting.state ? direction : nothing}
              tabindex=${this.focusedRow < 0 && this.focusedColumn === position
                ? "0"
                : "-1"}
              data-focus-cell
              data-column-id=${id}
              data-column-position=${position}
              data-align=${column.align ?? "start"}
              data-sortable=${sortable ? "" : nothing}
              data-pin=${normalizePinSide(this.getColumnPin(id)) || nothing}
              style=${styleMap(this.columnStyle(column, id))}
              .draggable=${canMove}
              @focus=${() => {
                this.focusedRow = -1;
                this.focusedColumn = position;
              }}
              @click=${(event: MouseEvent) => this.onHeaderClick(event, id)}
              @keydown=${(event: KeyboardEvent) =>
                this.onGridKeyDown(event, -1, position, undefined, column, id)}
              @dragstart=${(event: DragEvent) => this.onDragStart(event, id)}
              @dragend=${() => {
                this.columnDragSession = undefined;
                this.dragGhost = "";
              }}
              @dragover=${(event: DragEvent) => {
                const session = this.columnDragSession;
                if (
                  session &&
                  this.columnCanMove(session.sourceId) &&
                  this.columnCanMove(id)
                )
                  event.preventDefault();
              }}
              @drop=${(event: DragEvent) => this.onDrop(event, id)}
            >
              <span>${this.columnLabel(column, id)}</span>
              ${sorting.state
                ? html`
                    <span part="sort-indicator" data-direction=${direction}
                      >${chevronIcon()}</span
                    >
                    ${this.sort.length > 1
                      ? html`<span part="sort-number"
                          >${getNumberFormat(this.effectiveLocale).format(
                            sorting.index + 1
                          )}</span
                        >`
                      : nothing}
                  `
                : nothing}
              ${column.filterable
                ? html`
                    <button
                      part="filter-button"
                      type="button"
                      aria-label=${this.localize("tableFilterLabel")}
                      aria-expanded=${this.activeFilterColumn === id
                        ? "true"
                        : "false"}
                      @click=${() => {
                        this.activeFilterColumn =
                          this.activeFilterColumn === id ? null : id;
                      }}
                    >
                      <span aria-hidden="true">⌕</span>
                    </button>
                  `
                : nothing}
              ${this.renderColumnMenu(column, id)}
              ${this.getColumnPin(id)
                ? html`<span part="pin-indicator" aria-hidden="true"></span>`
                : nothing}
              ${canResize
                ? html`
                    <span
                      part="resize-handle"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label=${this.localize("resizeColumn", undefined, {
                        label: this.columnLabel(column, id),
                      })}
                      aria-valuemin=${resizeBounds.minimum}
                      aria-valuemax=${resizeBounds.maximum}
                      aria-valuenow=${resizeValue}
                      tabindex="0"
                      @pointerdown=${(event: PointerEvent) =>
                        this.onResizeStart(event, id)}
                      @pointermove=${this.onResizeMove}
                      @pointerup=${this.onResizeEnd}
                      @pointercancel=${this.onResizeCancel}
                      @lostpointercapture=${this.onResizeCancel}
                      @dblclick=${() => this.autoSizeColumn(id)}
                      @keydown=${(event: KeyboardEvent) =>
                        this.onResizeKey(event, id)}
                    ></span>
                  `
                : nothing}
              ${this.activeFilterColumn === id
                ? html`
                    <div part="filter-panel">
                      <input
                        type="search"
                        aria-label=${this.localize("tableFilterLabel")}
                        .value=${safeText(
                          this.filters.find((filter) => filter.id === id)?.value
                        )}
                        @input=${(event: Event) =>
                          this.onFilterInput(event, id)}
                        @focus=${this.relayEditorFocus}
                        @blur=${this.relayEditorBlur}
                      />
                    </div>
                  `
                : nothing}
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderCellValue(column: DataGridColumn<Row>, row: Row): unknown {
    const value = columnValue(column, row);
    return column.formatter ? column.formatter(value, row) : safeText(value);
  }

  private renderExpandButton(
    item: DataDisplayRow<Row>
  ): TemplateResult | typeof nothing {
    const expandable =
      this.childrenFor(item.row).length > 0 || this.rowDetail !== null;
    if (!expandable) return nothing;
    const expanded = arrayHasKey(this.expandedKeys, item.key);
    return html`
      <button
        part="expand-button"
        type="button"
        style=${styleMap({ "--depth": String(item.depth) })}
        aria-label=${this.localize(expanded ? "collapse" : "expand")}
        aria-expanded=${expanded ? "true" : "false"}
        tabindex="-1"
        @click=${() => this.toggleRowExpanded(item, true)}
      >
        <span data-expanded=${expanded ? "true" : "false"}
          >${chevronIcon()}</span
        >
      </button>
    `;
  }

  private renderDataRow(
    item: DataDisplayRow<Row>,
    rowPosition: number,
    ariaRowIndex: number
  ): TemplateResult {
    const selection = this.rowSelectionState(item);
    const expandable =
      this.childrenFor(item.row).length > 0 || this.rowDetail !== null;
    const expanded = arrayHasKey(this.expandedKeys, item.key);
    const rowClass = this.rowClass?.(item.row) ?? '';
    const selectionOffset = this.selectionEnabled ? 1 : 0;
    return html`
      <div
        part="row"
        class=${rowClass}
        role="row"
        aria-rowindex=${ariaRowIndex}
        aria-level=${this.childRows ? item.depth + 1 : nothing}
        aria-selected=${this.selectionEnabled
          ? selection.checked
            ? "true"
            : "false"
          : nothing}
        aria-expanded=${this.childRows && expandable
          ? expanded
            ? "true"
            : "false"
          : nothing}
        data-visible-index=${rowPosition}
        style=${styleMap({ "--data-grid-columns": this.gridTemplate })}
      >
        ${this.selectionEnabled
          ? html`
              <div role="gridcell" aria-colindex="1" part="cell">
                <input
                  type=${this.selectionMode === "single" ? "radio" : "checkbox"}
                  aria-label=${this.localize("select")}
                  .checked=${selection.checked}
                  .indeterminate=${selection.indeterminate}
                  ?disabled=${!this.rowIsSelectable(item.row)}
                  @click=${(event: MouseEvent) => {
                    const control = checkableControl(event.currentTarget);
                    if (control)
                      this.setRowSelected(item, control.checked, event);
                  }}
                />
              </div>
            `
          : nothing}
        ${this.visibleColumns.map(
          ({ column, id }, columnPosition) => html`
            <div
              part="cell"
              role="gridcell"
              aria-colindex=${columnPosition + 1 + selectionOffset}
              tabindex=${this.focusedRow === rowPosition &&
              this.focusedColumn === columnPosition
                ? "0"
                : "-1"}
              data-focus-cell
              data-row-position=${rowPosition}
              data-column-position=${columnPosition}
              data-column-id=${id}
              data-align=${column.align ?? "start"}
              data-pin=${normalizePinSide(this.getColumnPin(id)) || nothing}
              style=${styleMap(this.columnStyle(column, id))}
              @focus=${() => {
                this.focusedRow = rowPosition;
                this.focusedColumn = columnPosition;
              }}
              @click=${(event: MouseEvent) =>
                this.onCellClick(event, item, column, rowPosition)}
              @contextmenu=${(event: MouseEvent) =>
                this.emitCellContextMenu(event, item, column, rowPosition)}
              @keydown=${(event: KeyboardEvent) =>
                this.onGridKeyDown(
                  event,
                  rowPosition,
                  columnPosition,
                  item,
                  column,
                  id
                )}
            >
              ${columnPosition === 0 ? this.renderExpandButton(item) : nothing}
              ${this.renderCellValue(column, item.row)}
              ${this.getColumnPin(id)
                ? html`<span part="pin-indicator" aria-hidden="true"></span>`
                : nothing}
            </div>
          `
        )}
      </div>
      ${expanded && this.rowDetail
        ? html`
            <div role="row" aria-rowindex=${ariaRowIndex + 1}>
              <div
                part="row-detail"
                role="gridcell"
                aria-colspan=${Math.max(
                  1,
                  this.visibleColumns.length + selectionOffset
                )}
              >
                ${this.rowDetail(item.row)}
              </div>
            </div>
          `
        : nothing}
    `;
  }

  private renderGroupRow(
    item: DataDisplayGroup<Row>,
    rowPosition: number,
    ariaRowIndex: number
  ): TemplateResult {
    const expanded = arrayHasKey(this.expandedKeys, item.key);
    const eligible = item.rows.filter((row) => this.rowIsSelectable(row));
    const sourceIndexes = this.sourceIndexMap();
    const selected = eligible.filter((row, index) => {
      const sourceIndex = sourceIndexes.get(row);
      return arrayHasKey(
        this.selectedKeys,
        this.keyForRow(row, sourceIndex ?? index)
      );
    }).length;
    return html`
      <div
        part="group-row"
        role="row"
        aria-rowindex=${ariaRowIndex}
        aria-level=${item.depth + 1}
        aria-expanded=${expanded ? "true" : "false"}
        style=${styleMap({ "--data-grid-columns": this.gridTemplate })}
      >
        <div
          part="group-value"
          role="gridcell"
          aria-colspan=${Math.max(
            1,
            this.visibleColumns.length + (this.selectionEnabled ? 1 : 0)
          )}
          tabindex=${this.focusedRow === rowPosition ? "0" : "-1"}
          data-focus-cell
          data-row-position=${rowPosition}
          data-column-position="0"
          @focus=${() => {
            this.focusedRow = rowPosition;
            this.focusedColumn = 0;
          }}
          @keydown=${(event: KeyboardEvent) =>
            this.onGridKeyDown(event, rowPosition, 0)}
        >
          ${this.selectionMode === "multiple"
            ? html`
                <input
                  type="checkbox"
                  aria-label=${this.localize("select")}
                  .checked=${eligible.length > 0 &&
                  selected === eligible.length}
                  .indeterminate=${selected > 0 && selected < eligible.length}
                  ?disabled=${eligible.length === 0}
                  @change=${(event: Event) => {
                    const control = checkableControl(event.currentTarget);
                    if (control) this.setGroupSelected(item, control.checked);
                  }}
                />
              `
            : nothing}
          <button
            part="expand-button"
            type="button"
            style=${styleMap({ "--depth": String(item.depth) })}
            aria-label=${this.localize(expanded ? "collapse" : "expand")}
            aria-expanded=${expanded ? "true" : "false"}
            @click=${() => this.toggleGroupExpanded(item)}
          >
            <span data-expanded=${expanded ? "true" : "false"}
              >${chevronIcon()}</span
            >
          </button>
          <span>${safeText(item.value)}</span>
          <span part="group-count"
            >${getNumberFormat(this.effectiveLocale).format(
              item.rows.length
            )}</span
          >
          ${this.visibleColumns.map(({ column }) => {
            if (!column.aggregation) return nothing;
            const aggregate = aggregateValues(
              column.aggregation,
              item.rows,
              item.rows.map((row) => columnValue(column, row))
            );
            return html`<span
              >${column.aggregatedFormatter
                ? column.aggregatedFormatter(aggregate, item.rows)
                : safeText(aggregate)}</span
            >`;
          })}
        </div>
      </div>
    `;
  }

  private renderBodyContent(): TemplateResult {
    if (this.columns.length === 0 || this.visibleColumns.length === 0) {
      return html`
        <div role="row" aria-rowindex="2">
          <div part="empty" role="gridcell" aria-colindex="1">
            <slot name="empty">${this.localize("noColumns")}</slot>
          </div>
        </div>
      `;
    }
    if (this.data.length === 0) {
      return html`
        <div role="row" aria-rowindex="2">
          <div
            part="empty"
            role="gridcell"
            aria-colspan=${Math.max(1, this.visibleColumns.length)}
          >
            <slot name="empty">${this.localize("noData")}</slot>
          </div>
        </div>
      `;
    }
    if (this.displayItems.length === 0) {
      return html`
        <div role="row" aria-rowindex="2">
          <div
            part="no-results"
            role="gridcell"
            aria-colspan=${Math.max(1, this.visibleColumns.length)}
          >
            <slot name="no-results">${this.localize("noMatches")}</slot>
          </div>
        </div>
      `;
    }
    const window = this.virtualWindow;
    const height = this.resolvedRowHeight;
    const allItems = this.displayItems;
    let ariaRowIndex =
      2 +
      window.start +
      allItems
        .slice(0, window.start)
        .filter(
          (item) =>
            item.kind === 'row' &&
            Boolean(this.rowDetail) &&
            arrayHasKey(this.expandedKeys, item.key)
        ).length;
    return html`
      ${window.start > 0
        ? html`<div
            aria-hidden="true"
            style=${styleMap({ height: `${window.start * height}px` })}
          ></div>`
        : nothing}
      ${repeat(
        window.items,
        (item) =>
          item.kind === "group"
            ? item.key
            : `row:${typeof item.key}:${item.key}`,
        (item, localIndex) => {
          const rowPosition = window.start + localIndex;
          const currentAriaRowIndex = ariaRowIndex;
          ariaRowIndex +=
            1 +
            (item.kind === "row" &&
            Boolean(this.rowDetail) &&
            arrayHasKey(this.expandedKeys, item.key)
              ? 1
              : 0);
          return item.kind === "group"
            ? this.renderGroupRow(item, rowPosition, currentAriaRowIndex)
            : this.renderDataRow(item, rowPosition, currentAriaRowIndex);
        }
      )}
      ${window.end < allItems.length
        ? html`
            <div
              aria-hidden="true"
              style=${styleMap({
                height: `${(allItems.length - window.end) * height}px`,
              })}
            ></div>
          `
        : nothing}
    `;
  }

  private renderFooter(): TemplateResult | typeof nothing {
    const hasFooter = this.visibleColumns.some(
      ({ column }) => column.footer !== undefined
    );
    if (!hasFooter) return nothing;
    const rows = this.getProcessedRows();
    return html`
      <div part="footer">
        <div
          part="footer-row"
          role="row"
          style=${styleMap({ "--data-grid-columns": this.gridTemplate })}
        >
          ${this.selectionEnabled
            ? html`<div part="footer-cell" role="gridcell"></div>`
            : nothing}
          ${this.visibleColumns.map(
            ({ column }) => html`
              <div part="footer-cell" role="gridcell">
                ${typeof column.footer === "function"
                  ? column.footer(rows)
                  : column.footer ?? nothing}
              </div>
            `
          )}
        </div>
      </div>
    `;
  }

  private visiblePageNumbers(): number[] {
    const count = this.pageCount;
    if (count <= 0) return [];
    const current = finiteInteger(this.safePage, 0, 0, count - 1);
    const start = Math.max(0, Math.min(current - 2, count - 5));
    const end = Math.min(count, start + 5);
    return Array.from(
      { length: end - start },
      (_value, index) => start + index
    );
  }

  private renderPager(): TemplateResult | typeof nothing {
    if (!this.paginate) return nothing;
    const count = this.pageCount;
    const current = finiteInteger(this.safePage, 0, 0, Math.max(0, count - 1));
    const format = getNumberFormat(this.effectiveLocale, {
      maximumFractionDigits: 0,
    });
    const numbers = this.visiblePageNumbers();
    const configuredPageSizes = [
      ...new Set(
        this.pageSizeOptions
          .map((value) => finiteCount(value))
          .filter((value) => value > 0)
      ),
    ];
    const pageSizes = configuredPageSizes.includes(this.safePageSize)
      ? configuredPageSizes
      : [this.safePageSize, ...configuredPageSizes];
    return html`
      <nav part="pager" aria-label=${this.localize("paginationLabel")}>
        <span class="page-size-wrapper">
          <select
            part="page-size"
            aria-label=${this.localize("dataGridRowsPerPage")}
            .value=${String(this.safePageSize)}
            @change=${this.onPageSizeChange}
          >
            ${pageSizes.map(
              (value) =>
                html`<option value=${value}>${format.format(value)}</option>`
            )}
          </select>
          <span class="page-size-chevron" aria-hidden="true"
            >${chevronIcon()}</span
          >
        </span>
        <button
          part="pager-button first-button"
          type="button"
          aria-label=${this.localize("paginationFirstPage")}
          ?disabled=${current <= 0 || count === 0}
          @click=${() => this.applyPageChange(0)}
        >
          <span part="first-icon" aria-hidden="true"
            >${chevronIcon()}${chevronIcon()}</span
          >
        </button>
        <button
          part="pager-button previous-button"
          type="button"
          aria-label=${this.localize("previous")}
          ?disabled=${current <= 0 || count === 0}
          @click=${() => this.applyPageChange(current - 1)}
        >
          <span part="previous-icon" aria-hidden="true">${chevronIcon()}</span>
        </button>
        ${numbers[0] !== undefined && numbers[0] > 0
          ? html`<span part="ellipsis" aria-hidden="true">…</span>`
          : nothing}
        ${numbers.map((page) =>
          page === current
            ? html`
                <button
                  part="pager-button page page-current"
                  type="button"
                  aria-current="page"
                  aria-label=${this.localize(
                    "paginationJumpToPage",
                    undefined,
                    { page: format.format(page + 1) }
                  )}
                  @click=${() => this.applyPageChange(page)}
                >
                  ${format.format(page + 1)}
                </button>
              `
            : html`
                <button
                  part="pager-button page"
                  type="button"
                  aria-label=${this.localize(
                    "paginationJumpToPage",
                    undefined,
                    { page: format.format(page + 1) }
                  )}
                  @click=${() => this.applyPageChange(page)}
                >
                  ${format.format(page + 1)}
                </button>
              `
        )}
        ${numbers.at(-1) !== undefined && numbers.at(-1)! < count - 1
          ? html`<span part="ellipsis" aria-hidden="true">…</span>`
          : nothing}
        <button
          part="pager-button next-button"
          type="button"
          aria-label=${this.localize("next")}
          ?disabled=${current >= count - 1 || count === 0}
          @click=${() => this.applyPageChange(current + 1)}
        >
          <span part="next-icon" aria-hidden="true">${chevronIcon()}</span>
        </button>
        <button
          part="pager-button last-button"
          type="button"
          aria-label=${this.localize("paginationLastPage")}
          ?disabled=${current >= count - 1 || count === 0}
          @click=${() => this.applyPageChange(Math.max(0, count - 1))}
        >
          <span part="last-icon" aria-hidden="true"
            >${chevronIcon()}${chevronIcon()}</span
          >
        </button>
      </nav>
    `;
  }

  protected override render(): TemplateResult {
    const accessibleName =
      this.getAttribute('aria-label') || this.label || undefined;
    const detailCount = this.rowDetail
      ? this.displayItems.filter(
          (item) =>
            item.kind === 'row' && arrayHasKey(this.expandedKeys, item.key)
        ).length
      : 0;
    const rowCount = Math.max(1, this.displayItems.length + detailCount) + 1;
    const columnCount = Math.max(
      1,
      this.visibleColumns.length + (this.selectionEnabled ? 1 : 0)
    );
    const role =
      this.childRows || normalizedGroupBy(this.groupBy).length > 0
        ? 'treegrid'
        : 'grid';
    const treeProjection = this.sourceProjection();
    return html`
      <div part="data-grid">
        ${this.renderToolbar()}
        <div
          part="table"
          role=${role}
          aria-label=${accessibleName ?? nothing}
          aria-busy=${this.loading ? "true" : "false"}
          aria-rowcount=${rowCount}
          aria-colcount=${columnCount}
          data-tree-truncated=${treeProjection.truncated ? "true" : nothing}
        >
          ${this.renderHeader()}
          <div
            part="body"
            role="rowgroup"
            tabindex="0"
            @scroll=${this.onBodyScroll}
          >
            ${this.renderBodyContent()}
          </div>
          ${this.renderFooter()}
        </div>
        ${treeProjection.truncated
          ? html`<div part="tree-limit">
              ${this.localize("dataGridTreeLimitReached")}
            </div>`
          : nothing}
        ${this.loading
          ? html`
              <div part="loading-overlay">
                <slot name="loading">${this.localize("loading")}</slot>
              </div>
            `
          : nothing}
        ${this.renderPager()}
        <div part="live-region" class="sr-only" aria-hidden="true">
          ${this.liveText}
        </div>
        ${this.dragGhost
          ? html`<div part="drag-ghost">${this.dragGhost}</div>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-data-grid': LyraDataGrid;
  }
}
