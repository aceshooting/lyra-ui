import type { TemplateResult } from 'lit';
import type { LyraSize } from '../../../internal/variants.js';
import type {
  LyraClipboardWriteFailure,
  LyraClipboardWriteSuccess,
} from '../../../internal/clipboard.js';

/** A stable identity used by selection and expansion state. */
export type DataGridKey = string | number;

/** The two container treatments supported by `<lr-data-grid>`. */
export type DataGridAppearance = 'outlined' | 'plain';

/** Row-selection behavior. The empty spelling is the declarative alias for `multiple`. */
export type DataGridSelectable = '' | 'single' | 'multiple' | 'none';

/** The shared Lyra size ladder, excluding the intentionally unsupported `2xs` tier. */
export type DataGridSize = Exclude<LyraSize, '2xs'>;

/** Pinning side. `false` means unpinned.
 *
 *  `'left'` and `'right'` are **RTL-relative, not physical**: the pinning CSS is written in
 *  logical properties (`inset-inline-start`/`inset-inline-end`), so a column pinned `'left'`
 *  renders at the inline-start edge -- the physical *right* edge under `dir="rtl"` -- exactly
 *  like a column pinned `'start'` would. `'start'`/`'end'` are the newer, unambiguously-named
 *  spellings for the same two directions (mirroring `<lr-table>`'s `columns[].sticky:
 *  boolean | TableEdgeAlign`, normalized the same way by `stickyDirection()` in
 *  `table.class.ts`); `'left'` means `'start'` and `'right'` means `'end'` in the current writing
 *  direction. Both spellings are permanent and interchangeable -- neither is deprecated. */
export type DataGridPinSide = 'left' | 'right' | 'start' | 'end' | false;

export type DataGridSortAlgorithm =
  | 'alphanumeric'
  | 'alphanumericCaseSensitive'
  | 'text'
  | 'textCaseSensitive'
  | 'datetime'
  | 'basic';

export type DataGridFilterType =
  | 'text'
  | 'equals'
  | 'number-range'
  | 'date-range'
  | 'set'
  | 'includes-any'
  | 'includes-all';

export type DataGridAggregation<Row = unknown> =
  | 'sum'
  | 'min'
  | 'max'
  | 'mean'
  | 'median'
  | 'count'
  | 'unique'
  | 'uniqueCount'
  | 'extent'
  | ((rows: readonly Row[], values: readonly unknown[]) => unknown);

/** One column in a data grid. `field` accepts dot-separated property paths. */
export interface DataGridColumn<Row = Record<string, unknown>> {
  readonly id?: string;
  readonly field?: string;
  readonly label?: string;
  readonly align?: 'left' | 'center' | 'right' | 'start' | 'end';
  readonly width?: number;
  readonly minWidth?: number;
  readonly maxWidth?: number;
  readonly flex?: number;
  readonly formatter?: (value: unknown, row: Row) => string | TemplateResult | Node | unknown;
  readonly value?: (row: Row) => unknown;
  readonly sortable?: boolean;
  readonly sortFn?: DataGridSortAlgorithm;
  readonly comparator?: (left: unknown, right: unknown, leftRow: Row, rightRow: Row) => number;
  readonly sortDescFirst?: boolean;
  readonly sortUndefined?: 'first' | 'last' | 1 | -1;
  readonly searchable?: boolean;
  readonly filterable?: boolean;
  readonly filterType?: DataGridFilterType;
  readonly filterFn?: (value: unknown, filter: unknown, row: Row) => boolean;
  readonly hidden?: boolean;
  readonly hideable?: boolean;
  readonly resizable?: boolean;
  readonly movable?: boolean;
  readonly pinnable?: boolean;
  readonly pinned?: DataGridPinSide;
  readonly footer?: string | ((rows: readonly Row[]) => unknown);
  readonly aggregation?: DataGridAggregation<Row>;
  readonly aggregatedFormatter?: (value: unknown, rows: readonly Row[]) => string | TemplateResult | Node | unknown;
}

export interface DataGridSort {
  readonly id: string;
  readonly desc: boolean;
}

/** Public sorting-state spelling used by the mirrored data-grid contract. */
export type SortingState = readonly DataGridSort[];

/** Additive descriptive alias retained for callers that prefer a component-qualified name. */
export type DataGridSortingState = SortingState;

export interface DataGridFilter {
  readonly id: string;
  readonly value: unknown;
}

/** JSON-safe value vocabulary used by persisted data-grid state. */
export type DataGridJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly DataGridJsonValue[]
  | Readonly<{ [key: string]: DataGridJsonValue }>;

/** A filter after conversion to the explicit persistence vocabulary. */
export interface DataGridStateFilter {
  readonly id: string;
  readonly value: DataGridJsonValue;
}

export interface DataGridRequest {
  readonly sort: DataGridSortingState;
  readonly filters: readonly DataGridFilter[];
  readonly search: string;
  readonly page: number;
  readonly pageSize: number;
  readonly signal: AbortSignal | undefined;
}

export interface DataGridResponse<Row = Record<string, unknown>> {
  readonly rows: readonly Row[];
  readonly total: number;
}

export interface DataGridFacets {
  readonly uniqueValues: ReadonlyMap<unknown, number>;
  readonly minMax?: readonly [number, number];
}

export interface DataGridColumnState {
  readonly order?: readonly string[];
  readonly widths?: Readonly<Record<string, number>>;
  readonly visibility?: Readonly<Record<string, boolean>>;
  readonly pinning?: Readonly<Record<string, DataGridPinSide>>;
}

/** Serializable view state returned by `getState()`. */
export interface DataGridState extends DataGridColumnState {
  readonly sort?: DataGridSortingState;
  readonly filters?: readonly DataGridStateFilter[];
  readonly search?: string;
  readonly selectedKeys?: readonly DataGridKey[];
  readonly expandedKeys?: readonly DataGridKey[];
  readonly page?: number;
  readonly pageSize?: number;
}

export interface DataGridCsvOptions {
  readonly delimiter?: string;
  readonly includeHeaders?: boolean;
  readonly columnIds?: readonly string[];
  readonly escapeFormulas?: boolean;
}

export interface DataGridCopyOptions {
  readonly columnIds?: readonly string[];
  readonly includeHeaders?: boolean;
  readonly format?: 'tsv' | 'csv';
  readonly escapeFormulas?: boolean;
  /** Overrides the delimiter that `format` would otherwise select. */
  readonly delimiter?: string;
}

export interface DataGridExportOptions extends DataGridCsvOptions {
  readonly fileName?: string;
}

export interface DataGridScrollOptions {
  readonly align?: 'start' | 'center' | 'end';
}

export interface DataGridCellDetail<Row = Record<string, unknown>> {
  readonly column: DataGridColumn<Row>;
  readonly value: unknown;
  readonly row: Row;
  readonly index: number;
}

export interface DataGridCellContextMenuDetail<Row = Record<string, unknown>>
  extends DataGridCellDetail<Row> {
  readonly originalEvent: MouseEvent | KeyboardEvent;
}

export interface DataGridColumnMoveDetail {
  readonly columnOrder: readonly string[];
  readonly columnId: string;
  readonly finished: boolean;
}

export interface DataGridColumnResizeDetail {
  readonly columnId: string;
  readonly width: number;
  readonly finished: boolean;
}

export interface DataGridColumnPinDetail {
  readonly columnId: string;
  readonly side: DataGridPinSide;
}

export interface DataGridColumnVisibilityDetail {
  readonly columnId: string;
  readonly visible: boolean;
}

export interface DataGridDataErrorDetail {
  readonly error: unknown;
  readonly request: DataGridRequest;
}

export interface DataGridPageDetail {
  readonly page: number;
  readonly pageSize: number;
}

export interface DataGridRowDetail<Row = Record<string, unknown>> {
  readonly key: DataGridKey;
  readonly row: Row;
}

/** A user-expanded or collapsed client-side group. */
export interface DataGridGroupDetail<Row = Record<string, unknown>> {
  readonly key: string;
  readonly columnId: string;
  readonly value: unknown;
  readonly rows: readonly Row[];
}

export interface DataGridSelectionDetail<Row = Record<string, unknown>> {
  readonly selectedKeys: readonly DataGridKey[];
  readonly selectedRows: readonly Row[];
}

export interface LyraDataGridEventMap<Row = Record<string, unknown>> {
  focus: FocusEvent;
  blur: FocusEvent;
  request: CustomEvent<DataGridRequest>;
  'lr-cell-click': CustomEvent<DataGridCellDetail<Row>>;
  'lr-cell-contextmenu': CustomEvent<DataGridCellContextMenuDetail<Row>>;
  'lr-column-move': CustomEvent<DataGridColumnMoveDetail>;
  'lr-column-pin': CustomEvent<DataGridColumnPinDetail>;
  'lr-column-resize': CustomEvent<DataGridColumnResizeDetail>;
  'lr-column-visibility-change': CustomEvent<DataGridColumnVisibilityDetail>;
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
  'lr-data-error': CustomEvent<DataGridDataErrorDetail>;
  'lr-filter-change': CustomEvent<Readonly<{ filters: readonly DataGridFilter[] }>>;
  'lr-group-collapse': CustomEvent<DataGridGroupDetail<Row>>;
  'lr-group-expand': CustomEvent<DataGridGroupDetail<Row>>;
  'lr-page-change': CustomEvent<DataGridPageDetail>;
  'lr-row-collapse': CustomEvent<DataGridRowDetail<Row>>;
  'lr-row-expand': CustomEvent<DataGridRowDetail<Row>>;
  'lr-row-select': CustomEvent<DataGridSelectionDetail<Row>>;
  'lr-sort-change': CustomEvent<Readonly<{ sort: DataGridSortingState }>>;
  'lr-error': CustomEvent<null>;
}
