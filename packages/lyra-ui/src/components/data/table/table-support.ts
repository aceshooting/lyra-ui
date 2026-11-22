import { NESTED_INTERACTIVE_SELECTOR } from '../../../internal/nested-interactive.js';
import type { LyraPaginationFormat } from '../pagination/pagination.class.js';
import { sanitizeCssDeclarationValue } from '../../../internal/safe-css.js';
// Type-only: registration (and the code) of the composed `<lr-empty>` comes from `lr-table.ts`.
import { literalSetConverter } from '../../../internal/converters.js';
import { normalizeSize, type LyraSize, type LyraSizeStep } from '../../../internal/variants.js';

/** How `loading` renders. `'spinner'` (the default) replaces the grid with an indeterminate
 *  spinner; `'skeleton'` keeps the real grid — `<colgroup>`, `<thead>`, filter field, pagination
 *  footer — and fills the body with placeholder rows so the table sketches its shape instead of
 *  collapsing to a spinner and back on a cold load. */
export type TableLoadingAppearance = 'spinner' | 'skeleton';

/** Placeholder body rows rendered by `loadingAppearance="skeleton"` when neither `skeletonRows`
 *  nor `pageSize` supplies a count -- enough to read as "rows are coming" without pretending to
 *  know how many. */
export const DEFAULT_SKELETON_ROWS = 3;

export const TABLE_OVERRIDE_MESSAGE_KEYS = {
  tableLoading: 'tableLoading',
  tableLoadingMore: 'tableLoadingMore',
  tableLoadFailed: 'tableLoadFailed',
  noColumns: 'noColumns',
  noData: 'noData',
  tableFilterLabel: 'tableFilterLabel',
  tableFilterPlaceholder: 'tableFilterPlaceholder',
  noMatches: 'noMatches',
  showFewerColumns: 'showFewerColumns',
  showAllColumns: 'showAllColumns',
  loadMore: 'loadMore',
} as const;

/** Ceiling on every placeholder row count. `pageSize` and the public `skeletonRows` input are data
 *  values that can legitimately be very large, while one placeholder element per cell means an
 *  unbounded count would emit thousands of nodes for a transient loading state. */
export const MAX_SKELETON_ROWS = 20;


/** Upper bound accepted from the public `pageSize` input. */
export const MAX_PAGE_SIZE = 500;

export const MAX_TABLE_COLLECTION_ENTRIES = 10_000;
export const MAX_TABLE_ROWS = 100_000;
export const TABLE_SCROLL_OVERFLOW_TOLERANCE_PX = 1;

export const DEFAULT_RESIZE_MIN_WIDTH_PX = 48; // used when --lr-table-resize-min-width carries no resolvable length

/** An omitted ARIA maximum defaults to 100 for `role="separator"`. Represent an author-unbounded
 * CSS maximum with the largest exact finite integer so wider pixel values stay truthful. */
export const MISSING_CELL_RENDERER_WARNING = 'lyra-table-missing-cell-renderer';
export const MISSING_ACCESSIBLE_NAME_WARNING = 'lyra-table-missing-accessible-name';
export const INERT_PRIORITY_COLUMN_CONFIG_WARNING = 'lyra-table-inert-priority-column-config';
/** Prefix of the per-name `cellPart` collision diagnostic key (`<prefix>:<part name>`). */
export const RESERVED_CELL_PART_WARNING = 'lyra-table-reserved-cell-part';
export const REJECTED_ROW_ATTRIBUTE_WARNING = 'lyra-table-rejected-row-attribute';

/** Column header cells. Scoped by `scope="col"` so a `rowHeader` column's body `<th scope="row">`
 *  never reads as a header-strip cell (sorting, resizing, header roving focus, measurement). */
export const HEADER_CELL_SELECTOR = 'th[scope="col"][data-col-key]';
/** Body cells, including a `rowHeader` column's `<th scope="row">`. */
export const BODY_CELL_SELECTOR = ':is(td, th[scope="row"])[data-col-key]';

/** Every CSS part name `<lr-table>` renders or forwards, so a `cellPart(row)` result can be checked
 *  against them: a consumer name equal to one of these is styled by every
 *  `lr-table::part(<name>)` rule the table's own part already receives, and vice versa. */
export const TABLE_PART_NAMES: readonly string[] = Object.freeze([
  'base', 'caption', 'cell', 'cell-content', 'cell-editor', 'cell-label', 'cell-link', 'empty',
  'empty-actions', 'empty-base', 'empty-description', 'empty-heading', 'empty-icon', 'error',
  'error-actions', 'error-base', 'error-cell', 'error-description', 'error-heading', 'error-icon',
  'error-row', 'expanded-cell', 'expanded-row', 'expand-toggle-cell', 'filter', 'filter-clear',
  'filter-label', 'foot', 'footer-cell', 'footer-row', 'group-cell', 'group-row', 'head',
  'header-cell', 'loading', 'more-button', 'pagination', 'pagination-button', 'pagination-controls',
  'pagination-page', 'pagination-page-count', 'pagination-page-current', 'pagination-page-field',
  'pagination-page-input', 'pagination-pages', 'pagination-summary', 'resize-handle',
  'retry-button', 'reveal-columns-button', 'row', 'row-expand-icon', 'row-expand-toggle',
  'row-limit', 'row-total-cell', 'skeleton', 'sort-icon', 'sort-icon-active', 'sort-icon-inactive',
  'table',
]);
const TABLE_PART_NAME_SET: ReadonlySet<string> = new Set(TABLE_PART_NAMES);

/** The names in a normalized `cellPart` result (see `cellContentPartNames`) that collide with one
 *  of the table's own parts. */
export function reservedCellPartNames(names: string): string[] {
  return names ? names.split(' ').filter((name) => TABLE_PART_NAME_SET.has(name)) : [];
}

/** One `rowAttributes(row, index)` value: a string or finite number is written as text, `true`
 *  writes an empty (present) attribute, and `false`/`null`/`undefined` leave it absent. */
export type TableRowAttributeValue = string | number | boolean | null | undefined;
/** What `rowAttributes(row, index)` returns: attribute name to value, for one body row. */
export type TableRowAttributes = Readonly<Record<string, TableRowAttributeValue>>;

/** The ARIA attributes `rowAttributes` may set on a body row; everything else ARIA on the row
 *  (`aria-selected`, the row role's state) is owned by the table. */
export const TABLE_ROW_ARIA_ATTRIBUTES: readonly string[] = Object.freeze([
  'aria-label',
  'aria-description',
  'aria-current',
  'aria-rowindex',
]);
const TABLE_ROW_ARIA_SET: ReadonlySet<string> = new Set(TABLE_ROW_ARIA_ATTRIBUTES);
/** `data-*` markers the table writes on its own rows; a consumer value would be overwritten or
 *  would corrupt the delegated row lookup. */
const RESERVED_ROW_DATA_ATTRIBUTES: ReadonlySet<string> = new Set([
  'data-row-key',
  'data-stripe',
  'data-skeleton-row',
  'data-expanded-row-key',
]);
const DATA_ATTRIBUTE_NAME = /^data-[a-z0-9_.-]+$/;

/** Whether `name` is an attribute `rowAttributes` may set: a lowercase `data-*` name outside the
 *  table's own row markers and the library's `data-lr-*` namespace, or one of
 *  `TABLE_ROW_ARIA_ATTRIBUTES`. Event handlers (`on*`), `style`, `class`, `id`, `role`, `tabindex`
 *  and every other attribute are refused. */
export function isAllowedRowAttribute(name: string): boolean {
  if (TABLE_ROW_ARIA_SET.has(name)) return true;
  return DATA_ATTRIBUTE_NAME.test(name) && !name.startsWith('data-lr-') && !RESERVED_ROW_DATA_ATTRIBUTES.has(name);
}

/** Normalizes one `rowAttributes` result to the attributes to write. A non-object result, a
 *  throwing getter or a refused name or value is skipped; `rejected` reports whether anything was. */
export function normalizeRowAttributes(value: unknown): { attributes: Map<string, string>; rejected: boolean } {
  const attributes = new Map<string, string>();
  let rejected = false;
  if (value === null || value === undefined) return { attributes, rejected };
  if (typeof value !== 'object') return { attributes, rejected: true };
  let entries: [string, unknown][];
  try {
    entries = Object.entries(value);
  } catch {
    return { attributes, rejected: true };
  }
  for (const [name, raw] of entries) {
    if (!isAllowedRowAttribute(name)) {
      rejected = true;
      continue;
    }
    if (raw === false || raw === null || raw === undefined) continue;
    if (raw === true) attributes.set(name, '');
    else if (typeof raw === 'string') attributes.set(name, raw);
    else if (typeof raw === 'number' && Number.isFinite(raw)) attributes.set(name, String(raw));
    else rejected = true;
  }
  return { attributes, rejected };
}

export function frozenArray<Value>(values: Iterable<Value>, limit = MAX_TABLE_COLLECTION_ENTRIES): readonly Value[] {
  const snapshot: Value[] = [];
  try {
    for (const value of values) {
      snapshot.push(value);
      if (snapshot.length >= limit) break;
    }
  } catch {
    // Retain the safe prefix when an untyped iterable throws.
  }
  return Object.freeze(snapshot);
}

export function keySet(values: Iterable<string | number>, limit = MAX_TABLE_COLLECTION_ENTRIES): Set<string | number> {
  const snapshot = new Set<string | number>();
  try {
    for (const value of values) {
      if (typeof value === 'string') {
        if (value.trim().length === 0) continue;
      } else if (typeof value !== 'number') {
        continue;
      }
      snapshot.add(value);
      if (snapshot.size >= limit) break;
    }
  } catch {
    // Retain the safe prefix when an untyped iterable throws.
  }
  return snapshot;
}

function readonlyKeySet(snapshot: ReadonlySet<string | number>): ReadonlySet<string | number> {
  let facade: ReadonlySet<string | number>;
  facade = {
    get size() {
      return snapshot.size;
    },
    has: (value) => snapshot.has(value),
    entries: () => snapshot.entries(),
    keys: () => snapshot.keys(),
    values: () => snapshot.values(),
    [Symbol.iterator]: () => snapshot[Symbol.iterator](),
    forEach(callback, thisArg) {
      snapshot.forEach((value) => callback.call(thisArg, value, value, facade));
    },
  };
  return Object.freeze(facade);
}

/** One read facade per stored key set. The stored sets are replaced, never mutated, so a facade
 *  stays a correct snapshot for as long as its set is current; reading the same facade back keeps
 *  Lit from treating every rebind of an unchanged selection as a change. */
const keySetFacades = new WeakMap<ReadonlySet<string | number>, ReadonlySet<string | number>>();

export function storedKeySetFacade(values: ReadonlySet<string | number>): ReadonlySet<string | number> {
  let facade = keySetFacades.get(values);
  if (!facade) {
    facade = readonlyKeySet(values);
    keySetFacades.set(values, facade);
  }
  return facade;
}

export interface OwnedAnimationFrame {
  owner: Window;
  handle: number;
}

export interface TableResizeState {
  key: string;
  pointerId: number;
  startX: number;
  startWidth: number;
  minWidth: number;
  maxWidth: number;
  handle: HTMLElement;
  /** Width stored before this drag, restored if the live preview is canceled or vetoed. */
  previousWidth: number | undefined;
}

export interface TableRovingFocusSnapshot {
  kind: 'header' | 'row';
  key: string;
  index: number;
  targetKey: string | null;
  element: HTMLElement;
}

export interface TableRowEntry<T> {
  row: T;
  index: number;
  key: string | number;
  token: string;
  search?: { locale: string; text: string };
}

/** The steps of the shared size ladder that render the built-in empty state compact. */
const COMPACT_EMPTY_SIZES: ReadonlySet<LyraSizeStep> = new Set<LyraSizeStep>(['2xs', 'xs', 's']);
export const isCompactEmptySize = (size: LyraSize): boolean => COMPACT_EMPTY_SIZES.has(normalizeSize(size));

/** Which inline-start/inline-end edge a column aligns or sticks to. */
export type TableEdgeAlign = 'start' | 'end';

/** Explicit interaction that opens a column's editor. */
export type TableColumnEditTrigger = 'double-click' | 'always';

/** One choice offered by an `editType: 'select'` column's editor (`columns[].editOptions`) --
 *  the same `value`/`label` shape this library already uses for a flat list of choices (see
 *  `LyraSegmentedItem`). */
export interface TableColumnEditOption {
  value: string;
  label: string;
}

/** `<lr-table>`'s `selectionMode` property: `'none'` disables row selection,
 *  `'single'` allows one selected row at a time, `'multiple'` allows any
 *  number through row activation. */
export type TableSelectionMode = 'none' | 'single' | 'multiple';

/** `<lr-table>`'s `expansionMode` property, mirroring `TableSelectionMode` member for member:
 *  `'none'` leaves `expandedRowKeys` fully consumer-controlled (the default), `'single'` self-manages at most one expanded row at a time, and
 *  `'multiple'` self-manages any number. */
export type TableExpansionMode = 'none' | 'single' | 'multiple';

/** `<lr-table>`'s `sortMode` property: `'client'` orders `rows` in the browser from
 *  `sortKey`/`sortDir`, `'server'` renders `rows` in the order given. Mirrors the
 *  `paginationMode` split of the same two names. */
export type TableSortMode = 'client' | 'server';

/** Whether only the active header or every sortable header displays an indicator. */
export type TableSortIndicators = 'active' | 'all';

/** `<lr-table>`'s `scrollMode`: which element scrolls when the table overflows.
 *
 * `'self'` (default) makes `[part="base"]` the scroll container, which is what pairs with
 * `--lr-table-max-height` and what makes the sticky header pin inside the table's own viewport.
 *
 * `'page'` hands scrolling back to the page. Necessary because a scroll container clips *both*
 * axes -- CSS gives no way to scroll one axis and not the other -- so an uncapped table that is
 * still `overflow: auto` creates a sticky containing block that never scrolls, and its header
 * scrolls off with the document instead of pinning. With `'page'` the header's nearest scrollport
 * is the page, so it pins there; the cost is that a table wider than its host overflows the page
 * rather than scrolling inside itself.
 *
 * `'auto'` uses page flow while the rendered content fits the table's allocation, then switches
 * `[part="base"]` to the same contained scrolling as `'self'` only while it actually overflows
 * horizontally. */
export type TableScrollMode = 'self' | 'page' | 'auto';

export const TABLE_LAYOUT = literalSetConverter<'auto' | 'fixed'>(['auto', 'fixed'], 'auto');
/** `never` keeps the grid, `always` stacks every row as a card, `auto` stacks below the
 *  `--lr-table-stack-breakpoint` allocation. */
export type TableStackMode = 'never' | 'auto' | 'always';
export const TABLE_STACK = literalSetConverter<TableStackMode>(['never', 'auto', 'always'], 'never');
/** What the column header strip shows while rows are stacked: `visible` keeps every header (the
 *  default), `sortable` keeps only the sortable headers as a compact sort strip, `hidden` keeps none.
 *  A header left out of the strip stays in the accessibility tree and is shown while it has focus. */
export type TableStackHeader = 'visible' | 'sortable' | 'hidden';
export const TABLE_STACK_HEADER = literalSetConverter<TableStackHeader>(['visible', 'sortable', 'hidden'], 'visible');
export const TABLE_PAGINATION_FORMAT = literalSetConverter<LyraPaginationFormat>(['standard', 'compact'], 'compact');

/** `columns[].wrap` values, named after the CSS `flex-wrap` keywords `--lr-table-filter-wrap` uses. */
export type TableColumnWrap = 'wrap' | 'nowrap';
/** Fails closed for untyped values outside the `columns[].wrap` vocabulary. */
export function columnWrap(wrap: unknown): TableColumnWrap | undefined {
  return wrap === 'wrap' || wrap === 'nowrap' ? wrap : undefined;
}

/** Canonical table sort direction. */
export type TableSortDirection = 'asc' | 'desc';

/** Cancelable sort proposal detail. */
export interface TableSortRequestDetail {
  readonly phase: 'request';
  readonly sortKey: string;
  readonly sortDir: TableSortDirection;
}

/** Accepted sort transaction detail. */
export interface TableSortCommitDetail {
  readonly phase: 'commit';
  readonly sortKey: string;
  readonly sortDir: TableSortDirection;
}

/** One discriminated detail vocabulary shared across the sort request and commit phases. */
export type TableSortDetail = TableSortRequestDetail | TableSortCommitDetail;

interface TableColumnCommon<T> {
  key: string;
  label: string;
  /** Accessible name override for this column's `<th role="columnheader">`, applied as its
   *  `aria-label` whenever set -- e.g. an icon-only header rendered through `headerCell` that has
   *  no plain-text `label` to fall back on. Omit for the default: the header's accessible name
   *  comes from its rendered content (`headerCell`'s output, or `label`). When `label` is blank
   *  (or whitespace-only) and this is also omitted, the header falls back to `key` for its
   *  accessible name only -- the visible header itself stays blank, matching a deliberate
   *  icon-only column that renders no visible text. */
  ariaLabel?: string;
  /** Renders custom content into this column's <th>, in place of the plain `label` text -- e.g. a
   *  drag-to-resize handle or an interactive header affordance. Omit for the default plain-text
   *  `label` rendering (unchanged output). Receives the column definition itself -- there is no
   *  per-row data at header scope. */
  headerCell?: (column: TableColumn<T>) => unknown;
  /** CSS length (e.g. '120px', '20%') for this column's width. Omit for intrinsic/auto sizing. When any column defines `width`, the table switches to
   *  `table-layout: fixed` so declared widths are authoritative rather than advisory. */
  width?: string;
  /** CSS length for this column's minimum width (e.g. '80px'). Has no effect unless at least one
   *  column in the table also defines `width` (see `width`'s own doc). */
  minWidth?: string;
  /** CSS length for this column's maximum width (e.g. '320px'). Pixel values also bound pointer
   *  and keyboard resizing; other CSS lengths still constrain the rendered column. */
  maxWidth?: string;
  /** Enables pointer and keyboard resizing from this column's header. The table keeps the live
   *  width internally and emits non-cancelable `lr-column-resize` notifications. The final
   *  drag-end or keyboard proposal can be vetoed with `lr-column-resize-request`. */
  resizable?: boolean;
  sortable?: boolean;
  /** Renders this column's body cells as row headers -- `<th scope="row" role="rowheader">` in
   *  place of `<td role="gridcell">` -- so assistive technology announces that cell's content as
   *  the name of its row while moving across the row's other cells. Usually the one identifying
   *  column (a name or id). The cell keeps `part="cell"` and every other column behaviour; it also
   *  carries `data-row-header`, and `--lr-table-row-header-font-weight` (default `inherit`, so it
   *  looks like any other cell) sets its weight. Omit for an ordinary data column. */
  rowHeader?: boolean;
  /** Line wrapping for this column's body and footer cells (the header keeps its own single
   *  line). `'nowrap'` keeps each value on one line, widening the column instead -- e.g. an id,
   *  date or amount; `'wrap'` lets long values wrap and also breaks an unbroken token (a URL, a
   *  hash) so it stays inside a narrow or fixed-width column. Omit for the default: values wrap at
   *  spaces as before. While rows are stacked a `'nowrap'` column wraps, since a card cannot
   *  scroll sideways. The cell carries `[data-wrap]`; unknown values are ignored. */
  wrap?: TableColumnWrap;
  /** This column's own initial sort direction the first time header activation makes it the active
   *  `sortKey` -- consulted before the element-level `defaultSortDir`, which remains the fallback
   *  when this is omitted. Lets a mixed text/numeric table give one column (e.g. a "last updated"
   *  column that should read newest-first) the opposite initial direction from every other column,
   *  without flipping the element-level default for all of them. Like `defaultSortDir`, this only
   *  decides the direction chosen the first time this column becomes active, or the first time
   *  *after* a different column was active — re-activating a column that is already `sortKey` still
   *  only toggles between `'asc'` and `'desc'`. */
  defaultSortDir?: TableSortDirection;
  /** Backs client-mode sorting (`sortMode: 'client'`, the default) for this column. Returns the
   *  comparable value for `row` — a finite number sorts numerically, a string sorts through a
   *  locale-aware `Intl.Collator` (`numeric: true`, so `item2` precedes `item10`), and
   *  `null`/`undefined` (or a non-finite number) sorts *last* regardless of direction, so flipping
   *  `sortDir` never floats a block of blanks to the top.
   *
   *  Omit it to sort by this column's rendered `cell()` output instead, stringified — which only
   *  produces a meaningful order when `cell()` returns a string or number. Define `sortValue`
   *  whenever `cell()` returns a template or element, or the column would sort by a constant.
   *  Ignored entirely when `sortMode` is `'server'` (the caller is assumed to have already ordered
   *  `rows`) or when the column is not `sortable`. */
  sortValue?: (row: T) => string | number | null | undefined;
  align?: TableEdgeAlign;
  /** Responsive priority — `undefined` (the default) means "always visible".
   *  `'low'` columns hide first (narrowest container), `'medium'` next, as
   *  `[part='base']`'s container-query width shrinks; both can be forced back
   *  on via `[part='reveal-columns-button']`. */
  priority?: 'medium' | 'low';
  /** Pins this column's header/cell to one edge with `position: sticky` so it stays visible while
   *  the table scrolls horizontally. Both directions use CSS logical properties, so RTL flips
   *  automatically. Each sticky cell is its own stacking context, so the table raises a cell above
   *  its siblings while it holds an open `lr-dropdown`, `lr-popover`, `lr-select` or `lr-combobox`
   *  (popover layer) or has focus inside (one step above content), keeping a per-row actions menu
   *  visible and hit-testable over the following rows. Set `top-layer` on the overlay only when it
   *  must also clear a stacking context outside the table. */
  sticky?: TableEdgeAlign;
  /** Renders a sticky-bottom footer cell for this column, computed from every currently-rendered
   *  row (post-sort, pre-pagination) -- e.g. a column total. Omit for a column with no footer
   *  value; a `<tfoot>` renders at all only when at least one column defines this. */
  footer?(rows: readonly T[]): unknown;
  /** Applied directly to the generated `<td>` via `styleMap` -- e.g. a computed heat-tint
   *  background that a `cell()`-returned inner element can't paint into the cell's own padding.
   *  Omit for no per-cell style override (the default; unchanged output).
   *
   *  Precedence with `heatValue`: an inline `style=` attribute always wins the CSS cascade over an
   *  external stylesheet rule regardless of specificity, so a `background`/`backgroundColor`
   *  returned here silently and completely overrides this same column's `heatValue` tint (which is
   *  painted by a shadow-stylesheet rule, not inline) -- combine the two only when that override is
   *  the intended effect.
   *
   *  For text layout -- `white-space`, line clamping, `text-overflow` -- prefer `cellPart` plus a
   *  `::part()` rule: that wrapper holds only the value, while this style lands on the whole cell,
   *  which in stacked mode also holds the `cell-label` caption. */
  cellStyle?(row: T): Record<string, string> | undefined;
  /** Applied as the generated `<td>`'s native `title`, symmetrical with `cellStyle` -- e.g. the
   *  untruncated text behind an ellipsized cell, or a formatted timestamp behind a relative one.
   *  Returning `undefined` (or an empty string) omits the attribute entirely rather than rendering
   *  `title=""`, which would suppress an ancestor's own tooltip. The attribute is also suppressed
   *  while that cell is in inline-edit mode, so the tooltip can't shadow the editor.
   *
   *  Accessibility: some screen readers announce a `<td title>` as the cell's accessible name,
   *  replacing the cell's own content rather than supplementing it (the same caveat `lr-stat`'s
   *  `exactValue` carries). Use it for a longer form of what the cell already shows, never for
   *  information that exists nowhere else. */
  cellTitle?(row: T): string | undefined;
  /** Extra CSS part names for a wrapper around this cell's rendered content. `cell()` templates
   *  render inside this table's shadow root, so a class set on their markup is never reached by the
   *  stylesheet of the component or page that owns the table; only inherited properties and custom
   *  properties cross. When `cellPart` is defined, the resting cell content is wrapped in a
   *  `display: block` element carrying `part="cell-content"` plus every whitespace-separated name
   *  returned here, so an outer scope can style it per row: `lr-table::part(cell-muted)`. Return
   *  `undefined` or an empty string for a plain `cell-content` wrapper; non-string results are
   *  ignored. Prefix your names (e.g. `cell-`) so they cannot collide with the table's own parts:
   *  every name the table renders or forwards (`cell`, `cell-content`, `cell-label`, `cell-link`,
   *  `cell-editor`, `row`, `header-cell`, ...; the full list is `@csspart` on `<lr-table>`) is
   *  reserved, and a development build warns once per name when this returns one. The name is
   *  still applied, so the warning is the only change.
   *  Not applied to an open inline editor. A `part` attribute written directly inside a `cell()`
   *  template is equally a part of this table. */
  cellPart?(row: T): string | undefined;
  /** Makes this column's resting cell content a real link: return a URL and the content renders
   *  inside `<a part="cell-link">`, so the row keeps middle-click, open-in-new-tab, the browser's
   *  link context menu and a link announcement. Unsafe schemes, a non-string, an empty result or a
   *  throwing callback render the plain content. Activating the link navigates natively and does
   *  not emit `lr-row-activate`; clicking elsewhere in the row still does. For client-side routing,
   *  listen for `click` on the table, read the event's composed path for the `cell-link` anchor,
   *  and `preventDefault()` only a plain primary click (no modifier keys, `button === 0`). */
  href?(row: T): string | undefined;
  /** Native `target` for the `href` link. Any target adds `noopener noreferrer` to its `rel`. */
  target?: string;
  /** Link relationship tokens for the `href` link; `opener` is dropped and a `target` always adds
   *  `noopener noreferrer`. */
  rel?: string;
  /** Numeric accessor backing the heat-tint background. A column that omits this is excluded from
   *  tinting (e.g. a label column) — its presence on any column is the opt-in signal for heat-tint
   *  mode as a whole, mirroring how `expandedContent` alone signals expand-mode (no separate
   *  boolean). Returns `null`/`undefined` for a cell with no value: excluded from both the domain
   *  computation and the tint (reads as "no data", not "zero"). A `cellStyle` on the same column
   *  that returns `background`/`backgroundColor` silently wins over this tint -- see `cellStyle`'s
   *  own doc for why. */
  heatValue?(row: T): number | null | undefined;
  /** Reads the value shown in the inline editor. When omitted, `row[key]` is
   *  used for record-like rows. For `editType: 'select'`, this is the selected option's
   *  `value` -- match one entry of `editOptions`, or none of them renders selected. */
  editValue?: (row: T) => string | number;
  /** Accessible name (`aria-label`) for this row's inline editor, read once per row exactly like
   *  `editValue`/`cellTitle`. When omitted, the editor takes the localized `tableEditCellInRow`
   *  name (`Edit {column}, row {row}`), where `{row}` is the `rowKey` value or else the row's
   *  1-based rendered position; a table rendering a single row keeps `tableEditCell`
   *  (`Edit {column}`). Return the row's own full name for a more descriptive label -- this is
   *  consumer-owned text like `cellTitle`/`editValue`, not passed through the table's own
   *  localization. */
  editLabel?: (row: T) => string;
  /** Native editor type used when `editTrigger` is set. `'select'` renders a native `<select>`
   *  populated from `editOptions`, one `<option>` per entry in order; a `'select'` column with no
   *  `editOptions` renders an empty, valueless `<select>` rather than throwing. */
  editType?: 'text' | 'number' | 'select';
  /** Choices offered by an `editType: 'select'` column's editor. Ignored for every other
   *  `editType`. */
  editOptions?: TableColumnEditOption[];
}

/** One column definition. `cell` is required for every `editTrigger` except `'always'` -- the
 *  table's render path calls it to paint that column's plain-text resting state, which an
 *  `'always'` column never has (its editor is unconditional from first paint, see `editTrigger`'s
 *  own doc). Supplying `cell` on an `'always'` column stays valid; it is simply never required. */
export type TableColumn<T> =
  | (TableColumnCommon<T> & {
      /** Enables inline editing for this cell, opened by a double-click or, once the cell holds
       *  keyboard focus (Tab/arrow into the row, then Right/Left onto the cell -- see the
       *  class-level keyboard doc), by `F2` or `Enter`. One editor is open at a time; the table
       *  emits the proposed value through `lr-cell-edit` and never mutates `row` -- apply the
       *  change in the consumer and pass the updated `rows` back in. Omit for a column with no
       *  inline editor at all. */
      editTrigger?: 'double-click';
      /** Renders this cell's content. Required whenever the column can be in its plain-text
       *  resting state -- i.e. always, for a `'double-click'` or unset `editTrigger`. The returned
       *  template renders inside this table's shadow root, so the owning component's or page's
       *  class rules never reach it; style it through `cellPart` or a `part` attribute in the
       *  template, selected with `lr-table::part(...)`. */
      cell: (row: T) => unknown;
    })
  | (TableColumnCommon<T> & {
      /** `'always'` renders a persistent editor in every body cell of this column from first
       *  paint -- a settings/rate-style column the user is expected to type straight into. The
       *  table emits the proposed value through `lr-cell-edit` and never mutates `row`.
       *
       *  These editors are plain tab stops outside the roving header/row/cell tabindex model, and
       *  bind their `value` as a content attribute, so native dirty-value-flag semantics apply:
       *  once the user has typed into one, an out-of-band `rows` update to that same cell no
       *  longer replaces what they are still editing. An untouched editor picks up a new `rows`
       *  value normally. */
      editTrigger: 'always';
      /** Omittable for this `editTrigger: 'always'` arm: the persistent editor renders
       *  unconditionally, so the table's render path never falls back to this renderer. Still
       *  consulted as the `sortValue`-less sort fallback when `sortable` is set -- define
       *  `sortValue` on such a column instead of relying on this being present. */
      cell?: (row: T) => unknown;
    });

/** Normalizes a `cellPart(row)` result to space-separated, de-duplicated part names, dropping the
 *  always-present `cell-content` and any non-string result. */
export function cellContentPartNames(value: unknown): string {
  if (typeof value !== 'string') return '';
  const names = new Set(value.split(/\s+/).filter(Boolean));
  names.delete('cell-content');
  return [...names].join(' ');
}

/** Fails closed for untyped values outside the explicit sticky-axis vocabulary. */
export function stickyDirection(sticky: TableEdgeAlign | undefined): TableEdgeAlign | undefined {
  if (sticky === 'start' || sticky === 'end') return sticky;
  return undefined;
}

/** A cell style repeats the same few declarations on every row of every render; remember each
 *  verdict (bounded) instead of re-validating it. */
const cellDeclarationVerdicts = new Map<string, string>();
const CELL_DECLARATION_CACHE_LIMIT = 1_000;

export function sanitizeCellStyle(cellStyle: Record<string, unknown> | undefined): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [rawProperty, value] of Object.entries(cellStyle ?? {})) {
    if (typeof value !== 'string') continue;
    const property = normalizeStyleProperty(rawProperty.trim());
    const key = `${property}\u0000${value}`;
    let verdict = cellDeclarationVerdicts.get(key);
    if (verdict === undefined) {
      verdict = sanitizeCssDeclarationValue(property, value) ?? '';
      if (cellDeclarationVerdicts.size >= CELL_DECLARATION_CACHE_LIMIT) cellDeclarationVerdicts.clear();
      cellDeclarationVerdicts.set(key, verdict);
    }
    if (verdict) safe[property] = verdict;
  }
  return safe;
}

function normalizeStyleProperty(property: string): string {
  if (property.startsWith('--')) return property;
  return property.replace(/[A-Z]/g, '-$&').toLowerCase();
}

/** Fails closed for untyped values outside the explicit editor-trigger vocabulary. */
export function normalizedEditTrigger(editTrigger: TableColumnEditTrigger | undefined): TableColumnEditTrigger | undefined {
  if (editTrigger === 'always' || editTrigger === 'double-click') return editTrigger;
  return undefined;
}

/** Encodes a row/column identity key for use as a Map key or a DOM
 *  `data-row-key` attribute value, preserving the distinction between a
 *  numeric key and a string key that happen to stringify the same way
 *  (`1` vs `"1"`) -- a bare `String(key)` would silently collide the two. */
export function encodeKey(key: string | number): string {
  return `${typeof key}:${key}`;
}

/** Only scalar frozen records can reuse serialization: live records, accessors, custom toJSON
 * and nested containers retain their per-query reads. */
export function isImmutableSearchRow(value: unknown): boolean {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return true;
  try {
    if (!Object.isFrozen(value) || 'toJSON' in value ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) return false;
    return Object.values(Object.getOwnPropertyDescriptors(value)).every(descriptor =>
      'value' in descriptor && (descriptor.value === null ||
        (typeof descriptor.value !== 'object' && typeof descriptor.value !== 'function')));
  } catch { return false; }
}

/** The default (no `filter` prop) row-matching haystack. A bare `JSON.stringify(row)` throws on a
 *  circular reference (a parent pointer, a graph node -- ordinary shapes for this library's target
 *  data) or a BigInt field, which would otherwise escape from `willUpdate()`/`render()` and stop the
 *  table from rendering entirely. The replacer downgrades BigInt to its decimal string and a repeat
 *  visit to an already-seen container to `'[Circular]'`; a row that still can't be serialized (a
 *  hostile `toJSON()`, for instance) simply falls back to never matching rather than throwing. */
export function createFilterStringifier(): (row: unknown) => string {
  let first: object | undefined;
  let seen: Set<object> | undefined;
  const replace = (_key: string, value: unknown): unknown => {
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'object' && value !== null) {
      // Flat records need only their root identity; nested containers share one tracker per pass.
      if (first === undefined) first = value;
      else {
        if (value === first) return '[Circular]';
        seen ??= new Set<object>();
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
    }
    return value;
  };
  return (row) => {
    try {
      return JSON.stringify(row, replace) ?? '';
    } catch {
      return '';
    } finally {
      // Each row owns its reference history, including when a getter or toJSON throws.
      first = undefined;
      seen?.clear();
    }
  };
}

/** Returns an Element across owner-document realms without relying on the current global's
 * `Element` constructor. */
function asElement(value: EventTarget): Element | null {
  if (typeof value !== 'object' || !('nodeType' in value) || value.nodeType !== 1 || !('matches' in value)) {
    return null;
  }
  return value as Element;
}

/** The first genuinely interactive entry in a delegated event's composed path. Open-shadow
 * custom controls expose their native/role/tabindex owner through this path, while a passive
 * custom element remains part of the row's activation surface. An opaque closed-shadow control
 * can declare `data-table-interactive` on its visible host as an explicit escape hatch.
 *
 * An editable body `<td>`'s own roving-focus stop is deliberately `tabindex="-1"` rather than a
 * toggling `"0"`/`"-1"` pair (see the render template) -- among other things, that keeps it out of
 * `NESTED_INTERACTIVE_SELECTOR`'s `[tabindex]:not([tabindex="-1"])` clause for free, so it never needs an
 * exclusion entry here the way `[data-row-key]`/`th[data-col-key]` do. */
export function eventInteractiveTarget(event: Event, boundary: HTMLElement): Element | null {
  for (const value of event.composedPath()) {
    if (value === boundary) break;
    const element = asElement(value);
    if (element === null) continue;
    if (element.matches('[data-table-interactive]')) return element;
    if (element.matches(NESTED_INTERACTIVE_SELECTOR) && !element.matches('[data-row-key], th[data-col-key]')) {
      return element;
    }
  }
  return null;
}

/** Every event `<lr-table>` emits. `K` is the row-key type the element was parameterized with
 *  (`LyraTable<Row, number>` -> `rowKey: number` in every detail below), defaulting to the
 *  `string | number` union an unparameterized table has always carried. */
export interface LyraTableEventMap<T = unknown, K extends string | number = string | number> {
  blur: FocusEvent;
  focus: FocusEvent;
  'lr-priority-columns-visibility-change': CustomEvent<Readonly<{ visible: boolean }>>;
  'lr-sort-request': CustomEvent<TableSortRequestDetail>;
  'lr-sort': CustomEvent<TableSortCommitDetail>;
  /** A row was activated by pointer or Enter/Space. */
  'lr-row-activate': CustomEvent<Readonly<{ row: T }>>;
  'lr-row-expand-request': CustomEvent<Readonly<{ row: T; rowKey: K; expanded: boolean }>>;
  'lr-row-expand-toggle': CustomEvent<Readonly<{ row: T; rowKey: K; expanded: boolean }>>;
  'lr-load-more': CustomEvent<null>;
  'lr-retry-request': CustomEvent<null>;
  'lr-selection-change': CustomEvent<Readonly<{ selectedRowKeys: readonly K[] }>>;
  'lr-filter-change': CustomEvent<Readonly<{ filterText: string }>>;
  /** One-based `page`; `offset` is `(page - 1) * pageSize`. */
  'lr-before-page-change': CustomEvent<Readonly<{ page: number; pageSize: number; offset: number }>>;
  /** `pageSize` and `offset` are always set (as on `lr-before-page-change`); they are typed optional
   *  only so the published `{ page }` detail type stays assignable until the next major. */
  'lr-page-change': CustomEvent<Readonly<{ page: number; pageSize?: number; offset?: number }>>;
  'lr-cell-edit': CustomEvent<Readonly<{ row: T; columnKey: string; value: string | number }>>;
  'lr-column-resize-request': CustomEvent<Readonly<{ columnKey: string; width: number }>>;
  'lr-column-resize': CustomEvent<Readonly<{ columnKey: string; width: number }>>;
}
