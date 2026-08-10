import type { TemplateResult } from 'lit';
import type { LyraSize } from '../../../internal/variants.js';

/** A stable identity used by selection and expansion state. */
export type DataGridKey = string | number;

/** The two container treatments supported by `<lr-data-grid>`. */
export type DataGridAppearance = 'outlined' | 'plain';

/** Row-selection behavior. The empty spelling is the declarative alias for `multiple`. */
export type DataGridSelectable = '' | 'single' | 'multiple' | 'none';

/** The shared Lyra size ladder, excluding the intentionally unsupported `2xs` tier. */
export type DataGridSize = Exclude<LyraSize, '2xs'>;

/** Pinning side. `false` means unpinned. */
export type DataGridPinSide = 'left' | 'right' | false;

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
  id?: string;
  field?: string;
  label?: string;
  align?: 'left' | 'center' | 'right' | 'start' | 'end';
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  flex?: number;
  formatter?: (value: unknown, row: Row) => string | TemplateResult | Node | unknown;
  value?: (row: Row) => unknown;
  sortable?: boolean;
  sortFn?: DataGridSortAlgorithm;
  comparator?: (left: unknown, right: unknown, leftRow: Row, rightRow: Row) => number;
  sortDescFirst?: boolean;
  sortUndefined?: 'first' | 'last' | 1 | -1;
  searchable?: boolean;
  filterable?: boolean;
  filterType?: DataGridFilterType;
  filterFn?: (value: unknown, filter: unknown, row: Row) => boolean;
  hidden?: boolean;
  hideable?: boolean;
  resizable?: boolean;
  movable?: boolean;
  pinnable?: boolean;
  pinned?: Exclude<DataGridPinSide, null>;
  footer?: string | ((rows: readonly Row[]) => unknown);
  aggregation?: DataGridAggregation<Row>;
  aggregatedFormatter?: (value: unknown, rows: readonly Row[]) => string | TemplateResult | Node | unknown;
}

export interface DataGridSort {
  id: string;
  desc: boolean;
}

/** Public sorting-state spelling used by the mirrored data-grid contract. */
export type SortingState = DataGridSort[];

/** Additive descriptive alias retained for callers that prefer a component-qualified name. */
export type DataGridSortingState = SortingState;

export interface DataGridFilter {
  id: string;
  value: unknown;
}

export interface DataGridRequest {
  sort: DataGridSortingState;
  filters: DataGridFilter[];
  search: string;
  page: number;
  pageSize: number;
  signal: AbortSignal | undefined;
}

export interface DataGridResponse<Row = Record<string, unknown>> {
  rows: Row[];
  total: number;
}

export interface DataGridFacets {
  uniqueValues: Map<unknown, number>;
  minMax?: [number, number];
}

export interface DataGridColumnState {
  order?: string[];
  widths?: Record<string, number>;
  visibility?: Record<string, boolean>;
  pinning?: Record<string, DataGridPinSide>;
}

/** Serializable view state returned by `getState()`. */
export interface DataGridState extends DataGridColumnState {
  sort?: DataGridSortingState;
  filters?: DataGridFilter[];
  search?: string;
  selectedKeys?: DataGridKey[];
  expandedKeys?: DataGridKey[];
  page?: number;
  pageSize?: number;
}

export interface DataGridCsvOptions {
  delimiter?: string;
  includeHeaders?: boolean;
  columnIds?: string[];
  escapeFormulas?: boolean;
  /** @deprecated Use `columnIds`. */
  columns?: string[];
}

export interface DataGridCopyOptions {
  columnIds?: string[];
  includeHeaders?: boolean;
  format?: 'tsv' | 'csv';
  escapeFormulas?: boolean;
  /** Overrides the delimiter that `format` would otherwise select. */
  delimiter?: string;
  /** @deprecated Use `columnIds`. */
  columns?: string[];
}

export interface DataGridExportOptions extends DataGridCsvOptions {
  fileName?: string;
  /** @deprecated Use `fileName`. */
  filename?: string;
}

export interface DataGridScrollOptions {
  align?: 'start' | 'center' | 'end';
}

export interface DataGridCellDetail<Row = Record<string, unknown>> {
  column: DataGridColumn<Row>;
  value: unknown;
  row: Row;
  index: number;
}

export interface DataGridCellContextMenuDetail<Row = Record<string, unknown>>
  extends DataGridCellDetail<Row> {
  originalEvent: MouseEvent | KeyboardEvent;
}

export interface DataGridColumnMoveDetail {
  columnOrder: string[];
  columnId: string;
  finished: boolean;
}

export interface DataGridColumnResizeDetail {
  columnId: string;
  width: number;
  finished: boolean;
}

export interface DataGridColumnPinDetail {
  columnId: string;
  side: DataGridPinSide;
}

export interface DataGridColumnVisibilityDetail {
  columnId: string;
  visible: boolean;
}

export interface DataGridDataErrorDetail {
  error: unknown;
  request: DataGridRequest;
}

export interface DataGridPageDetail {
  page: number;
  pageSize: number;
}

export interface DataGridRowDetail<Row = Record<string, unknown>> {
  key: DataGridKey;
  row: Row;
}

export interface DataGridSelectionDetail<Row = Record<string, unknown>> {
  selectedKeys: DataGridKey[];
  selectedRows: Row[];
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
  'lr-data-error': CustomEvent<DataGridDataErrorDetail>;
  'lr-data-request': CustomEvent<DataGridRequest>;
  'lr-filter-change': CustomEvent<{ filters: DataGridFilter[] }>;
  'lr-page-change': CustomEvent<DataGridPageDetail>;
  'lr-row-collapse': CustomEvent<DataGridRowDetail<Row>>;
  'lr-row-expand': CustomEvent<DataGridRowDetail<Row>>;
  'lr-row-select': CustomEvent<DataGridSelectionDetail<Row>>;
  'lr-sort-change': CustomEvent<{ sort: DataGridSortingState }>;
}
