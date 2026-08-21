import { html, nothing, type TemplateResult, type PropertyValues, type ComplexAttributeConverter } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isRtl } from '../../../internal/rtl.js';
import { srOnly, nextId } from '../../../internal/a11y.js';
import { finiteCount, finiteInteger, finiteRatio } from '../../../internal/numbers.js';
import { resolveCssLength } from '../../../internal/css-length.js';
import { getCollator } from '../../../internal/intl-cache.js';
import { readPersistedState, writePersistedState } from '../../../internal/persisted-state.js';
import { styles } from './table.styles.js';
import { chevronIcon } from '../../../internal/icons.js';
import { minMax } from '../heatmap/heatmap-scale.js';
import '../../overlays/empty/empty.class.js';
import {
  literalSetConverter,
  trueDefaultSpellcheckConverter as spellcheckConverter,
} from '../../../internal/converters.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_expand, LYRA_DEFAULT_loadMore, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noColumns, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_resizeColumn, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_showAllColumns, LYRA_DEFAULT_showFewerColumns, LYRA_DEFAULT_tableEditCell, LYRA_DEFAULT_tableFilterLabel, LYRA_DEFAULT_tableFilterPlaceholder, LYRA_DEFAULT_tableLoading } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** How `loading` renders. `'spinner'` (the default) replaces the grid with an indeterminate
 *  spinner; `'skeleton'` keeps the real grid — `<colgroup>`, `<thead>`, filter field, pagination
 *  footer — and fills the body with placeholder rows so the table sketches its shape instead of
 *  collapsing to a spinner and back on a cold load. */
export type TableLoadingAppearance = 'spinner' | 'skeleton';

/** Placeholder body rows rendered by `loadingAppearance="skeleton"` when neither `skeletonRows`
 *  nor `pageSize` supplies a count -- enough to read as "rows are coming" without pretending to
 *  know how many. */
const DEFAULT_SKELETON_ROWS = 3;

/** Ceiling on every placeholder row count. `pageSize` and the public `skeletonRows` input are data
 *  values that can legitimately be very large, while one placeholder element per cell means an
 *  unbounded count would emit thousands of nodes for a transient loading state. */
const MAX_SKELETON_ROWS = 20;

/** Bounded client projection used by a bare table. Pagination keeps every row reachable while
 * avoiding an unbounded row-by-column DOM allocation. */
const DEFAULT_PAGE_SIZE = 100;

/** Upper bound accepted from the public `pageSize` input. */
const MAX_PAGE_SIZE = 500;

/** Matches the fixed allocation thresholds in table.styles.ts. */
const LOW_PRIORITY_MAX_INLINE_SIZE = 899.98;
const MEDIUM_PRIORITY_MAX_INLINE_SIZE = 639.98;
const MAX_TABLE_COLLECTION_ENTRIES = 10_000;
const TABLE_SCROLL_OVERFLOW_TOLERANCE_PX = 1;

const DEFAULT_RESIZE_MIN_WIDTH_PX = 48; // used when --lr-table-resize-min-width carries no resolvable length

/** An omitted ARIA maximum defaults to 100 for `role="separator"`. Represent an author-unbounded
 * CSS maximum with the largest exact finite integer so wider pixel values stay truthful. */
const UNBOUNDED_RESIZE_ARIA_MAX = Number.MAX_SAFE_INTEGER;

function frozenArray<Value>(values: Iterable<Value>): readonly Value[] {
  const snapshot: Value[] = [];
  try {
    for (const value of values) {
      snapshot.push(value);
      if (snapshot.length >= MAX_TABLE_COLLECTION_ENTRIES) break;
    }
  } catch {
    // Retain the safe prefix when an untyped iterable throws.
  }
  return Object.freeze(snapshot);
}

function keySet(values: Iterable<string | number>): Set<string | number> {
  const snapshot = new Set<string | number>();
  try {
    for (const value of values) {
      if (typeof value === 'string') {
        if (value.trim().length === 0) continue;
      } else if (typeof value !== 'number') {
        continue;
      }
      snapshot.add(value);
      if (snapshot.size >= MAX_TABLE_COLLECTION_ENTRIES) break;
    }
  } catch {
    // Retain the safe prefix when an untyped iterable throws.
  }
  return snapshot;
}

function readonlyKeySet(values: Iterable<string | number>): ReadonlySet<string | number> {
  const snapshot = keySet(values);
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

const UNSAFE_CSS_STRUCTURE = /[;{}]/;
const URL_FUNCTION = /url\s*\(/i;
const SAFE_STYLE_PROPERTY = /^-?[_a-zA-Z][\w-]*$|^--[a-zA-Z0-9_-]+$/;

interface OwnedAnimationFrame {
  owner: Window;
  handle: number;
}

interface TableResizeState {
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

interface TableRovingFocusSnapshot {
  kind: 'header' | 'row';
  key: string;
  index: number;
  targetKey: string | null;
  element: HTMLElement;
}

interface TableRowEntry<T> {
  row: T;
  index: number;
  key: string | number;
}

/**
 * Tri-state boolean converter for `empty-compact`. An absent attribute stays `undefined` -- "keep
 * each empty branch's own built-in default" -- rather than collapsing to `false`, which Lit's
 * presence-based `type: Boolean` converter cannot express. Same shape as `spellcheckConverter`
 * above, one state wider; `empty-compact="false"` is parsed as `false`, not `true`.
 */
const optionalBooleanConverter: ComplexAttributeConverter<boolean | undefined> = {
  fromAttribute(value): boolean | undefined {
    if (value === null) return undefined;
    return value !== 'false';
  },
  toAttribute(value): string | null {
    if (value === undefined) return null;
    return value ? '' : 'false';
  },
};

/**
 * Development-only diagnostics need to disappear from production bundles and unbundled browser
 * use. Prefer an explicit NODE_ENV when a bundler exposes one, then Vite's import-meta contract;
 * an unknown environment fails quiet instead of logging to end users.
 */
function isDevelopmentRuntime(): boolean {
  const nodeEnv = (
    globalThis as typeof globalThis & {
      process?: { env?: { NODE_ENV?: unknown } };
    }
  ).process?.env?.NODE_ENV;
  if (nodeEnv === 'production') return false;
  if (nodeEnv === 'development') return true;

  const viteEnv = (
    import.meta as ImportMeta & {
      readonly env?: { readonly DEV?: unknown; readonly MODE?: unknown };
    }
  ).env;
  if (typeof viteEnv?.DEV === 'boolean') return viteEnv.DEV;
  return viteEnv?.MODE === 'development';
}

/** Which inline-start/inline-end edge a column aligns or sticks to. */
export type TableEdgeAlign = 'start' | 'end';

/** Explicit interaction that opens a column's editor. */
export type TableColumnEditTrigger = 'double-click' | 'always';

/** `<lr-table>`'s `selectionMode` property: `'none'` disables row selection,
 *  `'single'` allows one selected row at a time, `'multiple'` allows any
 *  number through row activation. */
export type TableSelectionMode = 'none' | 'single' | 'multiple';

/** `<lr-table>`'s `sortMode` property: `'client'` orders `rows` in the browser from
 *  `sortKey`/`sortDir`, `'server'` renders `rows` in the order given. Mirrors the
 *  `paginationMode` split of the same two names. */
export type TableSortMode = 'client' | 'server';

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

const TABLE_LAYOUT = literalSetConverter<'auto' | 'fixed'>(['auto', 'fixed'], 'auto');

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

export interface TableColumn<T> {
  key: string;
  label: string;
  /** Renders custom content into this column's <th>, in place of the plain `label` text -- e.g. a
   *  drag-to-resize handle or an interactive header affordance. Omit for the default plain-text
   *  `label` rendering (unchanged output). Receives the column definition itself -- there is no
   *  per-row data at header scope. */
  headerCell?: (column: TableColumn<T>) => unknown;
  /** CSS length (e.g. '120px', '20%') for this column's width. Omit for today's intrinsic/auto
   *  sizing (unchanged). When any column defines `width`, the table switches to
   *  `table-layout: fixed` so declared widths are authoritative rather than advisory. */
  width?: string;
  /** CSS length for this column's minimum width (e.g. '80px'). Has no effect unless at least one
   *  column in the table also defines `width` (see `width`'s own doc). */
  minWidth?: string;
  /** CSS length for this column's maximum width (e.g. '320px'). Pixel values also bound pointer
   *  and keyboard resizing; other CSS lengths still constrain the rendered column. */
  maxWidth?: string;
  /** Enables pointer and keyboard resizing from this column's header. The table keeps the live
   *  width internally and emits `lr-column-resize` on every resize step; only the final,
   *  drag-end/keypress-committed emission is cancelable (see the event's own doc). */
  resizable?: boolean;
  sortable?: boolean;
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
   *  automatically. */
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
   *  the intended effect. */
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
  /** Numeric accessor backing the heat-tint background. A column that omits this is excluded from
   *  tinting (e.g. a label column) — its presence on any column is the opt-in signal for heat-tint
   *  mode as a whole, mirroring how `expandedContent` alone signals expand-mode (no separate
   *  boolean). Returns `null`/`undefined` for a cell with no value: excluded from both the domain
   *  computation and the tint (reads as "no data", not "zero"). A `cellStyle` on the same column
   *  that returns `background`/`backgroundColor` silently wins over this tint -- see `cellStyle`'s
   *  own doc for why. */
  heatValue?(row: T): number | null | undefined;
  /** Enables inline editing for this cell. `'double-click'` opens an editor on
   *  double-click, one cell at a time. `'always'` instead renders a persistent
   *  editor in every body cell of this column from first paint -- a
   *  settings/rate-style column the user is expected to type straight into.
   *  Either way the table emits the proposed value through `lr-cell-edit` and
   *  never mutates `row`; apply the change in the consumer and pass the updated
   *  `rows` back in.
   *
   *  Persistent (`'always'`) editors are plain tab stops outside the roving
   *  header/row tabindex model, and bind their `value` as a content attribute,
   *  so native dirty-value-flag semantics apply: once the user has typed into
   *  one, an out-of-band `rows` update to that same cell no longer replaces
   *  what they are still editing. An untouched editor picks up a new `rows`
   *  value normally. */
  editTrigger?: TableColumnEditTrigger;
  /** Reads the value shown in the inline editor. When omitted, `row[key]` is
   *  used for record-like rows. */
  editValue?: (row: T) => string | number;
  /** Native editor type used when `editTrigger` is set. */
  editType?: 'text' | 'number';
  cell: (row: T) => unknown;
}

/** Interactive elements a nested `cell()` template may render (e.g. an
 *  actions-column button). Clicks/keydowns landing on one of these — or
 *  bubbling up through one — must not be re-interpreted as row/column
 *  activation by the table's own delegated listeners. */
const INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, summary, audio[controls], video[controls], [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"]), [role="button"], [role="checkbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="menuitem"], [role="option"], [role="radio"], [role="separator"], [role="slider"], [role="spinbutton"], [role="switch"], [role="tab"], [role="textbox"]';

/** Fails closed for untyped values outside the explicit sticky-axis vocabulary. */
function stickyDirection(sticky: TableEdgeAlign | undefined): TableEdgeAlign | undefined {
  if (sticky === 'start' || sticky === 'end') return sticky;
  return undefined;
}

function sanitizeCellStyle(cellStyle: Record<string, unknown> | undefined): Record<string, string> {
  if (cellStyle === undefined) return {};
  const safe: Record<string, string> = {};
  for (const [rawProperty, rawValue] of Object.entries(cellStyle)) {
    const property = sanitizeCellStyleProperty(rawProperty);
    const value = sanitizeCellStyleValue(rawValue);
    if (property === undefined || value === undefined) continue;
    const normalizedProperty = normalizeStyleProperty(property);
    if (normalizedProperty.startsWith('--') || cssSupports(normalizedProperty, value)) {
      safe[normalizedProperty] = value;
    }
  }
  return safe;
}

function sanitizeCellStyleProperty(property: string): string | undefined {
  const normalized = property.trim();
  if (!normalized || !SAFE_STYLE_PROPERTY.test(normalized)) return undefined;
  return normalized;
}

function normalizeStyleProperty(property: string): string {
  if (property.startsWith('--')) return property;
  return property.replace(/[A-Z]/g, '-$&').toLowerCase();
}

function sanitizeCellStyleValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized || UNSAFE_CSS_STRUCTURE.test(normalized) || URL_FUNCTION.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function cssSupports(property: string, value: string): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return true;
  return CSS.supports(property, value);
}

/** Fails closed for untyped values outside the explicit editor-trigger vocabulary. */
function normalizedEditTrigger(editTrigger: TableColumnEditTrigger | undefined): TableColumnEditTrigger | undefined {
  if (editTrigger === 'always' || editTrigger === 'double-click') return editTrigger;
  return undefined;
}

/** Encodes a row/column identity key for use as a Map key or a DOM
 *  `data-row-key` attribute value, preserving the distinction between a
 *  numeric key and a string key that happen to stringify the same way
 *  (`1` vs `"1"`) -- a bare `String(key)` would silently collide the two. */
function encodeKey(key: string | number): string {
  return `${typeof key}:${key}`;
}

/** The default (no `filter` prop) row-matching haystack. A bare `JSON.stringify(row)` throws on a
 *  circular reference (a parent pointer, a graph node -- ordinary shapes for this library's target
 *  data) or a BigInt field, which would otherwise escape from `willUpdate()`/`render()` and stop the
 *  table from rendering entirely. The replacer downgrades BigInt to its decimal string and a repeat
 *  visit to an already-seen container to `'[Circular]'`; a row that still can't be serialized (a
 *  hostile `toJSON()`, for instance) simply falls back to never matching rather than throwing. */
function safeStringifyForFilter(row: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return (
      JSON.stringify(row, (_key, value) => {
        if (typeof value === 'bigint') return value.toString();
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      }) ?? ''
    );
  } catch {
    return '';
  }
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
 * can declare `data-table-interactive` on its visible host as an explicit escape hatch. */
function eventInteractiveTarget(event: Event, boundary: HTMLElement): Element | null {
  for (const value of event.composedPath()) {
    if (value === boundary) break;
    const element = asElement(value);
    if (element === null) continue;
    if (element.matches('[data-table-interactive]')) return element;
    if (element.matches(INTERACTIVE_SELECTOR) && !element.matches('[data-row-key], th[data-col-key]')) {
      return element;
    }
  }
  return null;
}

export interface LyraTableEventMap<T = unknown> {
  blur: CustomEvent<null>;
  focus: CustomEvent<null>;
  'lr-priority-columns-visibility-change': CustomEvent<Readonly<{ visible: boolean }>>;
  'lr-sort-request': CustomEvent<TableSortRequestDetail>;
  'lr-sort': CustomEvent<TableSortCommitDetail>;
  'lr-row-click': CustomEvent<Readonly<{ row: T }>>;
  'lr-row-expand-toggle': CustomEvent<Readonly<{ row: T; rowKey: string | number }>>;
  'lr-load-more': CustomEvent<null>;
  'lr-selection-change': CustomEvent<Readonly<{ rowKeys: readonly (string | number)[] }>>;
  'lr-filter-change': CustomEvent<Readonly<{ text: string }>>;
  'lr-page-change': CustomEvent<Readonly<{ page: number }>>;
  'lr-cell-edit': CustomEvent<Readonly<{ row: T; columnKey: string; value: string | number }>>;
  'lr-column-resize': CustomEvent<Readonly<{ columnKey: string; width: number }>>;
}
/**
 * `<lr-table>` — a sort/select-aware data table.
 *
 * A sortable-header activation first proposes a cancelable `lr-sort-request`. If accepted, client
 * mode writes `sortKey`/`sortDir` and reorders the rendered rows before emitting `lr-sort`; server
 * mode leaves those properties controlled and emits the same committed transaction so the caller
 * can fetch and supply the corresponding row order. Single/multiple selection is self-managed in
 * one `selectedRowKeys` store; expansion remains controlled through `expandedRowKeys`.
 *
 * Header/row activation is delegated: one `click` and one `keydown`
 * listener on `<table>` resolve the target via `closest('[data-col-key]'
 * | '[data-row-key]')` and a key→object lookup map, instead of allocating
 * fresh per-column/per-row closures on every render. Both listeners inspect
 * the delegated event's composed path for actual native, role, or tabindex
 * semantics (see `INTERACTIVE_SELECTOR`) so a button/link/input inside a cell
 * owns its own activation instead of triggering `lr-row-click`. A passive
 * custom element remains part of the row activation surface; an opaque
 * closed-shadow control marks its host with `data-table-interactive`.
 *
 * Keyboard focus follows a roving-tabindex pattern (one `tabindex="0"` stop
 * among the header cells, one among the body rows — see `focusedColKey()` /
 * `focusedRowKey()`), matching this repo's other `role="grid"`/composite
 * widgets. Left/Right/Home/End move within the header row; Up/Down/Home/End
 * move within the body; Down from the header enters the body's roving stop,
 * and Up from the body's first row returns to the header's roving stop.
 * Enter/Space still only sort/activate (see `activateColumn()` /
 * `activateRow()`). When controlled rows or columns replace the focused
 * member, focus follows the same stable key when it survives and otherwise
 * clamps to the nearest surviving index; an update never reclaims focus once
 * the user has moved it outside the table.
 * Blank and later-duplicate column keys are omitted first-wins at assignment. Rows retain their
 * caller-owned records, then one canonical `rowKey` projection omits blank and later-duplicate
 * identities before filtering, counts, pagination, focus, actions, and events.
 *
 * Set `aria-label` on the host to give the `role="grid"` element an
 * accessible name; it's forwarded into the shadow DOM's `<table>`.
 *
 * `columns[].priority` ('medium' | 'low') hides that column under
 * `[part='base']`'s `@container` breakpoints; `[part='reveal-columns-button']`
 * forces them all back into view. The public `hasHiddenPriorityColumns`
 * property reports only whether a priority column is actually hidden right
 * now, measured via `ResizeObserver` on `[part='base']` plus a post-render DOM
 * check. The toggle separately measures whether priority columns would hide
 * at the current allocation, so it stays available while force-visible mode
 * is active without making `hasHiddenPriorityColumns` contradict the rendered
 * state. `priorityColumnsVisible` defaults to `false` and toggles itself on
 * `[part='reveal-columns-button']` activation with no external wiring
 * required, but is also settable up front (property or the reflected
 * `priority-columns-visible` attribute) to restore a previously-persisted
 * preference, and readable back — directly or via the `lr-priority-columns-visibility-change`
 * event — to persist the current one. `columns[].sticky` pins a column's
 * header/cells to the inline-start (`'start'`) or inline-end (`'end'`)
 * edge while the table scrolls horizontally.
 *
 * `expandedContent` (a table-level `(row: T) => unknown`, not a per-column
 * hook, since the resulting panel spans every column via `colspan`) makes
 * every row render a leading chevron-toggle cell before its data columns.
 * `canExpand` optionally gates which rows actually get an interactive
 * toggle — a row that fails it still gets a blank leading cell for column
 * alignment. Which rows are currently open is fully consumer-owned via
 * `expandedRowKeys` (a `Set<string | number>` of row keys, per `rowKey`/
 * `keyOf()`) — the table only reads it and emits `lr-row-expand-toggle`
 * on activation. (`selectedRowKeys` is self-managed for selection, and
 * `sortKey`/`sortDir` are *not* a parallel case either: under
 * the default `sortMode: 'client'` the table writes them on header
 * activation.)
 *
 * Selection is opt-in through the `selectionMode` property. Use `single` or
 * `multiple` to self-manage row selection; the default `none` remains
 * presentational. `selectedRowKeys` contains the raw keys in every mode; single mode enforces one.
 *
 * `filterable` adds a compact search field above the grid. `filterText` is
 * controlled and emits `lr-filter-change`; `filter` can provide a typed
 * predicate, otherwise the row is matched against its JSON representation.
 * The internal filter and cell-editor native value events are contained at
 * their translation boundaries; hosts receive `lr-filter-change` and
 * `lr-cell-edit` instead.
 * `pageSize` bounds pagination through the existing `<lr-pagination>` primitive (100 rows by
 * default, normalized to 1..500). Client mode owns the accepted page and slices `rows`; server mode
 * leaves `page` controlled, bounds the supplied page to `pageSize`, and uses `totalItems` for the
 * navigation summary. `loading` keeps the table shell busy; `loadingAppearance`
 * chooses how — the default `'spinner'` replaces the grid with an indeterminate
 * spinner, while `'skeleton'` keeps the real `<colgroup>`/`<thead>` (and the
 * filter/pagination chrome) and fills the body with `skeletonRows` placeholder
 * rows, so column geometry survives the load instead of collapsing and
 * reflowing. Loading takes precedence over both empty branches. Because a skeleton needs a
 * column schema, a skeleton request received before `columns` arrives temporarily falls back to
 * the spinner rather than showing the no-columns empty state. Initial declarative loading stays
 * silent; every post-mount transition into either
 * loading appearance appends to the shared light-DOM polite sink — including repeated cycles —
 * while every placeholder opts out of `<lr-skeleton>`'s own announcement.
 * Columns with `editTrigger: 'double-click'` open a native text/number editor on
 * double-click and emit `lr-cell-edit`; row mutation remains consumer-owned.
 * `editTrigger: 'always'` instead renders that editor in every body cell of the
 * column from first paint — a settings/rate-style column meant to be typed
 * straight into. Persistent editors are plain tab stops (no `tabindex` of their
 * own, exactly like the row-expand toggle) outside the header/row roving model,
 * so arrow keys still navigate the grid from a row's own tab stop and act as
 * caret movement once focus is inside a field. Enter commits and keeps focus;
 * Escape has nothing to cancel back to, so it is left uncancelled for an
 * ancestor dialog/popover. Their value binds as a content attribute, so once
 * the user has typed into one an out-of-band `rows` update to that same cell no
 * longer replaces the draft; an untouched editor still picks up a new value.
 * Focus is restored across a re-sort that moves the editor's node, and dropped
 * (never re-aimed at an unrelated row) when its row leaves the rendered page.
 * `spellcheck`/`autocapitalize`/`autoCorrect` forward to the filter input and, for a `'text'`
 * (the default) `editType`, the inline cell editor -- no effect on a `'number'` cell editor.
 * `groupBy` inserts non-focusable group header rows before each group; use
 * `groupLabel` when the raw group key needs custom content. A client-mode
 * sort applies *within* each group, so grouping survives sorting on a column
 * unrelated to the group key.
 *
 * `columns[].heatValue` opts a column into heat-tint mode: its numeric return value is normalized
 * against a shared scale spanning every `heatValue`-defining column across every currently-rendered
 * row (auto-derived, or overridden via `heatTintScale`) and painted as a `color-mix()` background via
 * the retheme-able `--lr-table-heat-tint-lo`/`-hi` custom properties (matching `lr-heatmap`'s own
 * ramp-token convention). The heat-tint and resize properties can be set on the table or a theme
 * ancestor; a value set directly on the table wins through the normal cascade. `rowTotal`/`grandTotal`
 * add a trailing column mirroring `expandedContent`'s
 * leading one: `rowTotal(row)` renders per-row, `grandTotal(rows)` renders at its intersection with
 * the footer row (only when a column also defines `footer`) — both share `footer`'s own
 * "consumer computes/renders" contract rather than assuming addition.
 *
 * The built-in empty state is addressable rather than fixed: every `<lr-empty>` the table renders
 * carries `part="empty"` and re-exports its own inner parts as `empty-heading`/`empty-description`/
 * `empty-icon`/`empty-actions`/`empty-base`, the two *data*-empty branches (no rows at all, and
 * filtered/paginated down to zero) render it as the fallback content of a named `empty` slot so a
 * consumer can replace it wholesale, and `emptyCompact` overrides each branch's built-in `compact`
 * default. The no-columns branch is deliberately **not** slot-replaceable — it reports a
 * configuration problem (`noColumnsHeading`), not "this query returned nothing", and a single slot
 * covering all three would collapse that distinction.
 *
 * `layout` sets a floor on the `<table>`'s `table-layout`: `'fixed'` forces it even with no column
 * widths, while the default `'auto'` still resolves to `fixed` whenever a column declares a `width`
 * or a drag-resize is in flight (column resizing does not work under `table-layout: auto`).
 *
 * @customElement lr-table
 * @event lr-sort-request - Cancelable sort proposal. Frozen readonly
 *   `detail: { phase: 'request', sortKey, sortDir }`. Vetoing it leaves sort state and rows
 *   unchanged and suppresses `lr-sort`.
 * @event lr-sort - Accepted sort transaction. Frozen readonly
 *   `detail: { phase: 'commit', sortKey, sortDir }`. Client mode also updates `sortKey`/`sortDir`;
 *   server mode leaves them controlled while reporting the accepted proposal.
 * @event lr-row-click - A row was activated. `detail: { row }`.
 * @event lr-load-more - The "load more" control was activated.
 * @event lr-priority-columns-visibility-change - `priorityColumnsVisible` was toggled by
 *   `[part='reveal-columns-button']`. Frozen readonly `detail: { visible: boolean }`.
 * @event lr-row-expand-toggle - The row-expand chevron was activated.
 *   Frozen readonly `detail: { row, rowKey }`. Fired only when `expandedContent` is set and
 *   the row passes `canExpand`; does not itself mutate `expandedRowKeys` — the
 *   consumer updates it and passes the new value back in.
 * @event lr-selection-change - Opt-in row selection changed, from a row activation or from a
 *   `selectionMode` flip to `'single'` coercing an existing multi-row selection down to one key.
 *   Frozen readonly `detail: { rowKeys: readonly (string | number)[] }`. Not cancelable in either
 *   case: it announces a selection that has already changed rather than proposing one.
 * @event lr-filter-change - The filter field changed. Frozen readonly `detail: { text }`.
 * @event lr-page-change - A pagination control requested a page. Frozen readonly `detail: { page }`.
 * @event lr-cell-edit - An inline editor committed a value. `detail: { row, columnKey, value }`.
 * @event lr-column-resize - A resizable column changed width by pointer or keyboard. `detail:
 *   { columnKey, width }`, where `width` is in CSS pixels. A pointer drag fires this once per pixel of
 *   movement as non-cancelable live feedback, then once more, **cancelable**, for the final
 *   width committed at drag-end; a keyboard step (Home/End/Arrow) is already a single discrete
 *   action and fires that one cancelable commit directly. `preventDefault()` on a cancelable
 *   emission reverts the column to its pre-gesture width.
 * @event focus - Re-dispatched from the internal filter/cell-editor native inputs' own `focus` —
 *   bubbling and composed (unlike the native event, which is neither).
 * @event blur - Re-dispatched from the internal filter/cell-editor native inputs' own `blur`, for
 *   the same reason as `focus`.
 * @csspart base - The root wrapper around the `<table>` and its footer controls.
 * @csspart table - The `<table role="grid">` element.
 * @csspart caption - The `<caption>` element, rendered only when `caption` is set.
 * @csspart head - The `<thead>` element.
 * @csspart header-cell - Each `<th>` header cell.
 * @csspart resize-handle - The focusable separator used to resize a `resizable` column.
 * @csspart row - Each body `<tr>`.
 * @csspart cell - Each body `<td>`.
 * @csspart row-total-cell - Each body row's trailing `<td>` holding `rowTotal(row)`, rendered only
 *   when `rowTotal` is set. The corresponding footer-row cell (holding `grandTotal`) is a
 *   `footer-cell` instead, matching every other footer cell.
 * @csspart foot - The `<tfoot>`, only rendered when at least one column defines `footer`.
 * @csspart footer-row - The single footer row.
 * @csspart footer-cell - A single footer cell.
 * @csspart cell-editor - The native inline cell editor: shown after a double-click on an
 *   `editTrigger: 'double-click'` cell, and rendered persistently in every body cell of an
 *   `editTrigger: 'always'`
 *   column.
 * @csspart more-button - The "load more" control, shown when `hasMore` is true.
 * @csspart sort-icon - The chevron shown in the active sortable column's header cell.
 * @csspart reveal-columns-button - The button that toggles `priority`-hidden columns back into view.
 * @csspart expand-toggle-cell - Each row's (and the header's) leading
 *   chevron-toggle cell, rendered only when `expandedContent` is set.
 * @csspart row-expand-toggle - The `<button>` inside `expand-toggle-cell`,
 *   absent for a row that fails `canExpand`.
 * @csspart row-expand-icon - The chevron icon inside `row-expand-toggle`.
 * @csspart expanded-row - The full-width panel `<tr>` rendered beneath a
 *   row whose key is in `expandedRowKeys`.
 * @csspart expanded-cell - The single `colspan`-spanning `<td>` inside
 *   `expanded-row`, containing `expandedContent(row)`.
 * @csspart group-row - A non-focusable group header row.
 * @csspart group-cell - The full-width group header cell.
 * @csspart filter - The optional row-filter input.
 * @csspart filter-label - The `<label>` wrapping the filter input.
 * @csspart loading - The loading-state wrapper. Under `loadingAppearance="spinner"` (the default)
 *   it is the visible block holding the spinner; under `"skeleton"` it is the visually-hidden
 *   aria-hidden announcement mirror, since the placeholder rows are the visible affordance. It is
 *   never itself live; post-mount loading announcements use the shared light-DOM polite sink.
 * @csspart skeleton - Each `<lr-skeleton>` placeholder inside a `loadingAppearance="skeleton"`
 *   body cell. Its rows and cells reuse the ordinary `row`/`cell`/`row-total-cell` parts (that
 *   is what keeps them geometrically identical to real rows), so this is the part to target for
 *   the placeholder's own look — e.g. `::part(skeleton) { --lr-skeleton-h: 2em; }`.
 * @csspart pagination - The optional pagination component.
 * @csspart empty - The built-in `<lr-empty>` host, in all three empty states (no columns
 *   configured, no rows at all, and filtered/paginated down to zero rows). The two data-empty
 *   states render it as the `empty` slot's fallback, so it disappears once that slot is filled.
 *   Note that the no-columns and no-rows states return the empty element as the shadow root's own
 *   root, with no `[part='base']` wrapper around it — `::part(base)` does not apply in those two
 *   states, only in the filtered-to-zero one.
 * @csspart empty-base - Exported from the built-in `<lr-empty>`'s own `base` part.
 * @csspart empty-icon - Exported from the built-in `<lr-empty>`'s `icon` part.
 * @csspart empty-heading - Exported from the built-in `<lr-empty>`'s `heading` part.
 * @csspart empty-description - Exported from the built-in `<lr-empty>`'s `description` part.
 * @csspart empty-actions - Exported from the built-in `<lr-empty>`'s `actions` part.
 * @slot empty - Replaces the built-in empty state on the two *data*-empty branches (no rows at
 *   all, and filtered/paginated down to zero). Left unfilled, the built-in `[part='empty']`
 *   `<lr-empty>` renders as this slot's fallback content. The no-columns branch renders its own
 *   `noColumnsHeading` state and is not slot-replaceable.
 * @cssprop [--lr-table-resize-min-width=var(--lr-size-3rem)] - Default minimum width for a
 *   resizable column without an explicit pixel `minWidth`. Inherits from theme ancestors.
 * @cssprop [--lr-table-resize-handle-opacity=0.12] - Hover/focus opacity of the resize handle.
 *   Legacy shared-state hook; inherits from theme ancestors.
 * @cssprop [--lr-table-resize-handle-hover-bg=var(--lr-color-brand)] - Resize-handle hover/focus background.
 * @cssprop [--lr-table-resize-handle-hover-opacity=var(--lr-table-resize-handle-opacity,0.12)] - Resize-handle hover/focus opacity.
 * @cssprop [--lr-table-resize-handle-active-bg=var(--lr-table-resize-handle-hover-bg,var(--lr-color-brand))] - Resize-handle pressed background.
 * @cssprop [--lr-table-resize-handle-active-opacity=calc(var(--lr-table-resize-handle-hover-opacity,var(--lr-table-resize-handle-opacity,0.12))*2)] - Resize-handle pressed opacity.
 * @cssprop [--lr-table-cell-color=inherit] - Text colour of body cells; inherits the host's own
 *   colour by default.
 * @cssprop [--lr-table-cell-link-color=var(--lr-color-brand)] - Colour of an anchor returned from a
 *   column's `cell(row)`. Such an anchor renders inside this component's shadow root, so page CSS
 *   cannot reach it and `::part()` cannot select past the first compound selector to reach it
 *   either; without this hook it computes to the UA default link blue. Set `revert` for the UA
 *   default.
 * @cssprop [--lr-table-cell-link-hover-color=var(--lr-table-cell-link-color,var(--lr-color-brand))] -
 *   Colour of that anchor on hover and `:focus-visible`, which also thicken its underline.
 * @cssprop [--lr-table-max-height=none] - Cap on the scroll container's block size, past which the
 *   table body scrolls.
 * @cssprop [--lr-table-heat-tint-lo=var(--lr-color-brand-quiet)] - Low endpoint of the heat-tint
 *   ramp used by `heatValue` columns. Inherits from theme ancestors.
 * @cssprop [--lr-table-heat-tint-hi=var(--lr-color-brand)] - High endpoint of the heat-tint ramp
 *   used by `heatValue` columns. Inherits from theme ancestors.
 * @cssprop [--lr-table-heat-t] - This cell's position on the heat-tint ramp, as a percentage
 *   string. Set inline by the component on each `[data-heat]` cell; not consumer-settable.
 * @cssprop [--lr-table-row-selected-bg=var(--lr-color-brand-quiet)] - Background of a row whose
 *   `aria-selected` is `true`. Shadow Parts forbids an attribute selector after `::part()`, so
 *   `::part(row)[aria-selected]` is invalid CSS and the selected row could otherwise only be
 *   restyled by hijacking the library-wide `--lr-color-brand-quiet` token.
 * @cssprop [--lr-table-row-stripe-bg=transparent] - Background of alternating body rows. The
 *   token is read only on rows carrying the internal stripe marker, so it can be set on the table
 *   or an ancestor without affecting group, expanded, hover, or selected rows.
 * @cssprop [--lr-table-header-sorted-bg=var(--lr-color-surface)] - Background of the currently-sorted column's
 *   header cell (`[aria-sort]` other than `none`). Same rationale as `--lr-table-row-selected-bg`:
 *   `::part(header-cell)[aria-sort]` is invalid CSS, so this token is the supported way to recolor
 *   the sorted header without hijacking a library-wide token.
 * @cssprop [--lr-table-header-sorted-color=inherit] - Text color of the currently-sorted column's
 *   header cell.
 * @cssprop [--lr-table-sticky-offset=0] - Distance a `sticky` column pins from the inline edge.
 *   Measured and set inline per column by the component so multiple sticky columns stack instead
 *   of overlapping; falls back to `0` for the first one, or before the first measurement pass.
 * @status stable
 * @since 4.0.0
 */
export class LyraTable<T = unknown> extends LyraElement<LyraTableEventMap<T>> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    expand: LYRA_DEFAULT_expand,
    loadMore: LYRA_DEFAULT_loadMore,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    noColumns: LYRA_DEFAULT_noColumns,
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    resizeColumn: LYRA_DEFAULT_resizeColumn,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    showAllColumns: LYRA_DEFAULT_showAllColumns,
    showFewerColumns: LYRA_DEFAULT_showFewerColumns,
    tableEditCell: LYRA_DEFAULT_tableEditCell,
    tableFilterLabel: LYRA_DEFAULT_tableFilterLabel,
    tableFilterPlaceholder: LYRA_DEFAULT_tableFilterPlaceholder,
    tableLoading: LYRA_DEFAULT_tableLoading,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  private _columns: readonly TableColumn<T>[] = Object.freeze([]);
  /** Clone-owned readonly column-definition sequence, bounded to the first 10,000 source
   * positions. Blank keys and later duplicate keys are omitted (first valid occurrence wins)
   * before any header, cell, sort, focus, or event path. Column objects and callbacks retain their
   * identities; reassign the collection to update. */
  @property({ attribute: false })
  get columns(): readonly TableColumn<T>[] {
    return this._columns;
  }
  set columns(value: readonly TableColumn<T>[]) {
    const previous = this._columns;
    const columns: TableColumn<T>[] = [];
    const seen = new Set<string>();
    let length = 0;
    try {
      if (Array.isArray(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, 'length');
        const sourceLength = descriptor && 'value' in descriptor ? descriptor.value : 0;
        if (
          typeof sourceLength === 'number' &&
          Number.isSafeInteger(sourceLength) &&
          sourceLength >= 0
        ) {
          length = Math.min(sourceLength, MAX_TABLE_COLLECTION_ENTRIES);
        }
      }
    } catch {
      length = 0;
    }
    for (let index = 0; index < length; index += 1) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      } catch {
        continue;
      }
      if (!descriptor || !('value' in descriptor)) continue;
      const column = descriptor.value as TableColumn<T>;
      try {
        const key = column?.key;
        if (typeof key !== 'string' || key.trim().length === 0 || seen.has(key)) continue;
        seen.add(key);
        columns.push(column);
      } catch {
        // A malformed definition cannot reserve its key or suppress a later valid definition.
      }
    }
    this._columns = frozenArray(columns);
    this.requestUpdate('columns', previous);
  }

  private _rows: readonly T[] = Object.freeze([]);
  /** Clone-owned readonly row sequence, bounded to the first 10,000 rows. Row objects are retained
   * here; the rendered model applies `rowKey` as one unique nonempty first-wins identity
   * projection before filtering, counts, pagination, focus, actions, and events. Reassign the
   * collection to update. */
  @property({ attribute: false })
  get rows(): readonly T[] {
    return this._rows;
  }
  set rows(value: readonly T[]) {
    const previous = this._rows;
    this._rows = frozenArray(Array.isArray(value) ? value : []);
    this.requestUpdate('rows', previous);
  }
  /** Floor for the `<table>`'s `table-layout`. `'fixed'` forces the fixed algorithm even when no
   *  column declares a `width`, so every column shares the available width evenly and long cell
   *  content is clipped/wrapped instead of stretching its column. The default `'auto'` is only a
   *  floor: it still resolves to `fixed` whenever a column declares a `width`, a column has been
   *  drag-resized, or a resize gesture is in flight — resizing does not work under
   *  `table-layout: auto`.
   *
   *  Two consequences of the fixed algorithm are worth knowing before opting in: with no declared
   *  widths the *first* row (header row included) determines every column's width, so revealing a
   *  `priority`-hidden column via `[part='reveal-columns-button']` re-measures and changes all of
   *  them; and `columns[].minWidth`/`maxWidth` are silently ignored by `table-layout: fixed`
   *  (declare `width` instead when you need a specific column sized). */
  private _layout: 'auto' | 'fixed' = 'auto';

  @property({ reflect: true, converter: TABLE_LAYOUT })
  get layout(): 'auto' | 'fixed' {
    return this._layout;
  }
  set layout(next: 'auto' | 'fixed') {
    const normalized = TABLE_LAYOUT.normalizeReflected(this, 'layout', next);
    const old = this._layout;
    if (old === normalized) return;
    this._layout = normalized;
    this.requestUpdate('layout', old);
  }
  @property({ attribute: 'sort-key' }) sortKey = '';
  @property({ attribute: 'sort-dir' }) sortDir: TableSortDirection = 'asc';
  /** `'client'` (the default) orders `rows` itself, in the browser, from `sortKey`/`sortDir` and
   *  the active column's `sortValue`. `'server'` renders `rows` in exactly the order given,
   *  assuming the caller has already sorted them — mirroring `paginationMode`'s identical
   *  client/server split. Header activation first emits cancelable `lr-sort-request`; an accepted
   *  activation emits `lr-sort` either way, but only client mode mutates these properties.
   *
   *  With no `sortKey` set (the default) `'client'` is a no-op: the input order is preserved
   *  verbatim, so an existing consumer that only listens for `lr-sort` sees unchanged rendering
   *  until a header is actually activated. */
  @property({ reflect: true, attribute: 'sort-mode' }) sortMode: TableSortMode = 'client';
  /** The direction applied whenever header activation switches sorting to a *different* column —
   *  including the first column ever sorted. Re-activating the column that is already `sortKey`
   *  toggles between `'asc'` and `'desc'` instead, so this never overrides a direction the user
   *  just chose for the column they are still on. Defaults to `'asc'`; set `'desc'` for a
   *  most-recent-first or highest-first table. */
  @property({ attribute: 'default-sort-dir' }) defaultSortDir: TableSortDirection = 'asc';
  /** Accessible name for the `role="grid"` — a typed alternative to setting `aria-label` on the
   *  host. When set it becomes the grid's `aria-label`; a host `aria-label` is used as a fallback
   *  when this is unset. Consumer-supplied text, so it is NOT run through `this.localize()`. An
   *  explicitly empty string is a real override (renders `aria-label=""`) rather than falling
   *  back to the host `aria-label`. */
  @property({ attribute: 'accessible-label' }) accessibleLabel?: string;
  /** Optional visible caption rendered as the table's `<caption>`. Also names the grid (via
   *  `aria-labelledby`) when no `accessibleLabel`/host `aria-label` is set. Consumer-supplied
   *  text, not localized. */
  @property() caption = '';

  /** Stable id for the `<caption>`, so `aria-labelledby` can point at it. */
  private readonly captionId = nextId('lr-table-caption');
  /** Derives each row's stable identity for `repeat()`'s DOM-reconciliation
   *  key and the delegated click/keydown row lookup (`rowsByKey`,
   *  `data-row-key`). When omitted, `keyOf()` falls back to the row's index
   *  in `rows`, which is only a safe identity while `rows` never reorders —
   *  provide `rowKey` whenever `rows` can be sorted, filtered, or otherwise
   *  re-ordered across renders, or row identity (selection, focus, click
   *  targets) can silently attach to the wrong row. Empty string identities and later duplicates
   *  are omitted before every rendered/count/focus/action/event path; the first valid occurrence
   *  wins. */
  @property({ attribute: false }) rowKey?: (row: T) => string | number;
  @property({ reflect: true, attribute: 'selection-mode' }) selectionMode: TableSelectionMode = 'none';
  /** Which element scrolls when the table overflows; see `TableScrollMode`. `'auto'` keeps page
   *  flow while content fits and contains horizontal overflow only when needed. Defaults to
   *  `'self'`, which is the pre-10.0 behaviour. */
  @property({ reflect: true, attribute: 'scroll-mode' }) scrollMode: TableScrollMode = 'self';
  private _selectedKeys = new Set<string | number>();
  /** Selected raw row keys in every selection mode, bounded to 10,000 keys. Single mode replaces
   * this set with exactly one key per row activation; multiple mode toggles membership. Reads
   * return immutable detached `ReadonlySet` facades; malformed and whitespace-only string keys are
   * omitted while valid off-page keys are retained for server pagination. Reassign a new set to
   * update. */
  @property({ attribute: false })
  get selectedRowKeys(): ReadonlySet<string | number> {
    return readonlyKeySet(this._selectedKeys);
  }
  set selectedRowKeys(value: ReadonlySet<string | number>) {
    const previous = this._selectedKeys;
    this._selectedKeys = keySet(value ?? []);
    this.requestUpdate('selectedRowKeys', previous);
  }
  @property({ type: Boolean, reflect: true }) filterable = false;
  @property({ attribute: 'filter-text' }) filterText = '';
  @property({ attribute: false }) filter?: (row: T, text: string) => boolean;
  /** Optional filter-copy overrides. Omission localizes the matching message key; supplied
   * strings, including the built-in English text or an empty string, render verbatim. */
  @property({ attribute: 'filter-label' }) filterLabel?: string;
  @property({ attribute: 'filter-placeholder' }) filterPlaceholder?: string;
  /** Forwarded to the filter input's, and (when the active column's `editType` is `'text'`, the
   *  default) the inline cell-editor input's, native `spellcheck`. Defaults to `true`, matching
   *  the native element's own default. `spellcheck="false"` is parsed as `false` (see
   *  `spellcheckConverter` above). No effect on a `'number'` cell editor. */
  @property({ converter: spellcheckConverter }) override spellcheck = true;
  /** Forwarded to the same inputs' native `autocapitalize`. Empty string omits the attribute
   *  (browser default). */
  @property() override autocapitalize = '';
  /** Forwarded to the same inputs' native `autocorrect` (Safari/WebKit-specific). Empty string
   *  omits the attribute (browser default). Named `autoCorrect` (capital `C`), not `autocorrect`,
   *  to dodge a TS `lib.dom.d.ts` collision -- same fix as `<lr-textarea>`/`<lr-model-select>`. */
  @property({ attribute: 'autocorrect' }) autoCorrect = '';
  @property({ type: Boolean, reflect: true }) loading = false;
  /** Optional loading-copy override. Omission localizes `tableLoading`; a supplied string renders verbatim. */
  @property({ attribute: 'loading-label' }) loadingLabel?: string;
  /** How `loading` renders. `'spinner'` (the default, unchanged output) replaces the whole grid
   *  with an indeterminate spinner. `'skeleton'` instead renders the real table — the same
   *  `<colgroup>` (declared *and* drag-resized widths included), the same `<thead>`, the filter
   *  field and the pagination footer — and fills `<tbody>` with placeholder rows, so a cold load
   *  sketches the grid's shape rather than collapsing to a spinner and reflowing when the rows
   *  land. Kept separate from `loading` rather than widening it to a string union, so
   *  `?loading=${…}` bindings and `el.loading === true` checks keep working.
   *  When `columns` is empty, a skeleton request temporarily renders the spinner: loading still
   *  takes precedence over the no-columns empty state, but there is no schema to sketch yet.
   *
   *  Column *widths* only stay pixel-identical across the load if the browser isn't sizing them
   *  from cell content: declare `columns[].width`, or set `layout="fixed"`. Under the default
   *  `table-layout: auto`, placeholder cells have no intrinsic width, so the columns re-measure
   *  when real content arrives — exactly as they do between any two different data sets. */
  @property({ reflect: true, attribute: 'loading-appearance' }) loadingAppearance: TableLoadingAppearance = 'spinner';
  /** Number of placeholder rows rendered by `loadingAppearance="skeleton"`. `0` (the default)
   *  renders 3 placeholders for the ordinary bounded default, or derives a non-default explicit
   *  `pageSize` (capped at 20). Positive explicit values are also capped at 20. Ignored entirely
   *  under the default spinner appearance. */
  @property({ type: Number, attribute: 'skeleton-rows' }) skeletonRows = 0;
  /** Inserts a non-focusable group header row wherever this key changes between consecutive
   *  rendered rows. Supply `rows` with each group already contiguous — the table does not
   *  re-order them to make them so, and the group order it renders is their first-appearance
   *  order in `rows`. A client-mode sort (`sortMode: 'client'`) is applied *within* each group
   *  rather than across the whole set, so sorting a grouped table on a column unrelated to the
   *  group key reorders rows inside their groups and leaves the grouping itself intact. Sorting on
   *  a column whose value is constant inside every group — the group column itself, most obviously
   *  — reorders the *groups* by that value instead, since there is nothing to reorder within
   *  them. */
  @property({ attribute: false }) groupBy?: (row: T) => string | number;
  @property({ attribute: false }) groupLabel?: (key: string | number, rows: readonly T[]) => unknown;
  /** Maximum rows mounted per page. Defaults to 100 and normalizes into 1..500 so a bare table
   * never creates an unbounded row-by-column DOM projection. */
  @property({ type: Number, attribute: 'page-size' }) pageSize = DEFAULT_PAGE_SIZE;
  /** Current page. Client pagination updates it on accepted navigation; server pagination leaves it
   * controlled and only emits `lr-page-change`. */
  @property({ type: Number, reflect: true }) page = 1;
  /** Total item count for server pagination; `-1` derives it from filtered rows. */
  @property({ type: Number, attribute: 'total-items' }) totalItems = -1;
  @property({ reflect: true, attribute: 'pagination-mode' }) paginationMode: 'client' | 'server' = 'client';
  /** Renders a full-width panel beneath a row when that row's key is in
   *  `expandedRowKeys`. Table-level (not per-column) since the panel spans
   *  every column via `colspan`. Setting this makes every row render a
   *  leading chevron-toggle cell before all data columns; omit for no
   *  leading cell at all (unchanged output). The returned content renders inside this
   *  component's shadow root, behind the `expanded-cell` part -- page-level CSS selectors cannot
   *  reach it, and `::part(expanded-cell)` only reaches that wrapping `<td>`, not the descendants
   *  this callback returns (`::part()` is a pseudo-element; only pseudo-classes may follow it, so
   *  `::part(expanded-cell) .child` never matches, the same limitation `cell(row)`'s returned
   *  anchors run into). Style such content by returning already-styled elements -- inline
   *  `style`, or elements that reference this table's own `--lr-*` design tokens, which inherit
   *  across the shadow boundary like any custom property -- rather than depending on a
   *  page-level selector to find it. */
  @property({ attribute: false }) expandedContent?: (row: T) => unknown;
  /** Gates whether a given row gets an interactive chevron/toggle at all,
   *  when `expandedContent` is set. Omit to make every row expandable. A
   *  row that fails this check still gets a leading cell (for column
   *  alignment) but it renders empty — no button, no `aria-expanded`, no
   *  click handler. */
  @property({ attribute: false }) canExpand?: (row: T) => boolean;
  /** Consumer-owned open/closed state, bounded to 10,000 keys and keyed the same way as `rowKey`/
   *  `selectedRowKeys`. The table never mutates this itself — it only reads it
   *  to decide which rows currently render `expandedContent`; toggle it in
   *  response to `lr-row-expand-toggle`. Unlike this controlled expansion axis,
   *  selection and client sorting are self-managed. Reads return immutable detached `ReadonlySet`
   *  facades; malformed and whitespace-only string keys are omitted and valid off-page keys remain
   *  controlled. Reassign a new set to update. */
  private _expandedKeys = new Set<string | number>();
  @property({ attribute: false })
  get expandedRowKeys(): ReadonlySet<string | number> {
    return readonlyKeySet(this._expandedKeys);
  }
  set expandedRowKeys(value: ReadonlySet<string | number>) {
    const previous = this._expandedKeys;
    this._expandedKeys = keySet(value ?? []);
    this.requestUpdate('expandedRowKeys', previous);
  }
  /** Overrides the auto-derived heat-tint domain (min/max of every `heatValue` result across every
   *  currently-rendered row — post-sort, pre-pagination, the same rows `footer(rows)` already sees).
   *  Unset computes the domain automatically from the data, spanning every `heatValue`-defining
   *  column together (a single shared scale across the whole grid, not one scale per column). */
  @property({ attribute: false }) heatTintScale?: { min?: number; max?: number };
  /** Renders a trailing `<td>` on every body row holding this row's total. Same
   *  "consumer computes/renders, table only positions" contract as the existing per-column
   *  `footer(rows)` — does not assume addition, so a non-sum aggregate works identically. Omit for
   *  no trailing column at all (unchanged output). */
  @property({ attribute: false }) rowTotal?: (row: T) => unknown;
  /** Renders the bottom-right cell (row-total column × footer row). Only rendered when both
   *  `rowTotal` is set **and** at least one column defines `footer` — otherwise there is no footer
   *  row for it to occupy, and this renders nothing. */
  @property({ attribute: false }) grandTotal?: (rows: readonly T[]) => unknown;
  @property({ type: Boolean, attribute: 'has-more', reflect: true }) hasMore = false;
  /** Optional copy overrides. Omission localizes the matching message key; supplied strings,
   * including the built-in English text or an empty string, render verbatim. */
  @property({ attribute: 'more-label' }) moreLabel?: string;
  @property({ attribute: 'empty-heading' }) emptyHeading?: string;
  @property({ attribute: 'empty-description' }) emptyDescription = '';
  /** Overrides the built-in `[part='empty']` state's `compact` rendering. Leave `undefined` (the
   *  default) to keep each branch's own built-in behavior: the whole-table states (no columns, no
   *  rows) render spacious, while the in-table filtered/paginated-to-zero state — which sits below
   *  the filter field inside `[part='base']` — renders compact. `empty-compact="false"` forces the
   *  spacious rendering everywhere. Has no effect once the `empty` slot is filled. */
  @property({ attribute: 'empty-compact', converter: optionalBooleanConverter }) emptyCompact?: boolean;
  @property({ attribute: 'no-columns-heading' }) noColumnsHeading?: string;
  @property({ attribute: 'no-columns-description' }) noColumnsDescription = '';
  @property({ attribute: 'reveal-columns-label' }) revealColumnsLabel?: string;
  @property({ attribute: 'hide-columns-label' }) hideColumnsLabel?: string;

  /** Whether the current rendered allocation actually hides at least one `priority` column. This
   * read-only state becomes false once `priorityColumnsVisible` reveals them; the toggle remains
   * available at narrow allocations through an internal capability measurement. */
  @property({ type: Boolean, attribute: 'has-hidden-priority-columns', reflect: true })
  hasHiddenPriorityColumns = false;

  @state() private priorityColumnsToggleAvailable = false;

  /** Forces `priority`-hidden columns back into view, overriding the
   *  `@container` hide rules in table.styles.ts. Toggles itself on
   *  `[part='reveal-columns-button']` activation by default — no external
   *  wiring is required for the button to work. Also settable from outside
   *  (property or the reflected `priority-columns-visible` attribute) to restore a
   *  previously-persisted preference. The single
   *  `lr-priority-columns-visibility-change` event reports button-driven changes. */
  @property({ type: Boolean, attribute: 'priority-columns-visible', reflect: true })
  priorityColumnsVisible = false;

  /** Persists `priorityColumnsVisible` to `localStorage` across reloads when set. Namespaced as
   *  `lr-table:${storageKey}` -- mirrors `lr-app-rail`'s identical `storage-key` pattern. */
  @property({ attribute: 'storage-key' }) storageKey?: string;

  private get storageFullKey(): string | undefined {
    return this.storageKey ? `lr-table:${this.storageKey}` : undefined;
  }

  /** Skips the very first `updated()` pass so mounting never writes to storage -- `willUpdate()`
   *  restored `priorityColumnsVisible` on that first pass, and Lit has already flipped `hasUpdated` to true
   *  by the time `updated()` runs, so a dedicated flag is needed. Mirrors `lr-app-rail`'s
   *  `persistReady`. */
  private persistReady = false;
  private announcementSink?: AnnouncementSink;
  private loadingAnnouncementsReady = false;

  /** Roving-tabindex position among header cells; `null` until a header is
   *  clicked/navigated to, at which point `focusedColKey()` falls back to
   *  the first column. */
  @state() private activeColKey: string | null = null;
  /** Roving-tabindex position among body rows; `null` until a row is
   *  clicked/navigated to, at which point `focusedRowKey()` falls back to
   *  the first surviving `selectedRowKeys` member (if it matches a row) or the first row. */
  @state() private activeRowKey: string | null = null;
  @state() private editingCell: { rowKey: string; columnKey: string } | null = null;
  /** The persistent (`editTrigger: 'always'`) editor cell that most recently took focus, recorded by
   *  the delegated `focusin` handler. `repeat()` is keyed by row key, so a re-sort *moves* the
   *  `<input>` node (its typed value rides along) rather than recreating it -- but a DOM move drops
   *  focus, so `updated()` puts it back. Deliberately non-reactive: it tracks focus, and writing it
   *  must never schedule a render. */
  private focusedEditorCell: { rowKey: string; columnKey: string } | null = null;
  /** Whether `focusedEditorCell` still actually held focus when the in-flight update started.
   *  Captured in `willUpdate()`, i.e. before `render()` has had the chance to move the node out
   *  from under it. Without this, a record left behind by a user who has since clicked away
   *  entirely (no `focusin` reaches this component to clear it) would let any later, unrelated
   *  update yank focus back into the table. */
  private editorHadFocusBeforeUpdate = false;
  /** Focused roving member captured before a controlled collection update removes or moves its
   * DOM node. `targetKey` is resolved from the new collection before render; `updated()` only has
   * to put focus on the already-correct `tabindex="0"` owner. */
  private rovingFocusSnapshot: TableRovingFocusSnapshot | null = null;
  @state() private resizedColumnWidths = new Map<string, number>();

  private resizeState?: TableResizeState;
  /** Window that owns the active resize gesture's global pointer listeners. */
  private resizeEventWindow?: Window;

  private rowsByKey = new Map<string, TableRowEntry<T>>();
  private columnsByKey = new Map<string, TableColumn<T>>();

  /** Watches `[part='base']`'s own inline-size — the `@container` query
   *  container table.styles.ts's priority-hide rules react to — so a
   *  `priority` column flipping hidden/visible from an *external* width
   *  change (a window resize, an ancestor flex-layout reflow, ...) is caught
   *  even though no Lit-tracked property changed. Mirrors
   *  lite-chart.ts's connectedCallback()/disconnectedCallback() ResizeObserver
   *  lifecycle. */
  private resizeObserver?: ResizeObserver;
  /** Owner-bound rAF for the coalesced `resizeObserver` callback below — an animated ancestor resize (a
   *  CSS transition/drag on a containing panel) can fire the observer once per animation frame,
   *  and each tick's full synchronous read+write pass (offsetParent over every priority header,
   *  a fresh `[data-col-key]` query per sticky column, an aria-valuenow write per resize handle)
   *  would otherwise run unbatched on every single one of them. Mirrors lite-chart.ts's/
   *  heatmap.class.ts's own `drawRafId` coalescing pattern. */
  private layoutFrame: OwnedAnimationFrame | null = null;
  /** The `[part='base']` element `resizeObserver` is currently observing —
   *  `render()`'s columns/rows-empty branches swap in the built-in
   *  (or `empty`-slotted) empty state instead,
   *  a different template shape that gives `[part='base']` a fresh DOM
   *  identity on the next non-empty render, so `updated()` re-observes
   *  whenever this no longer matches the live element. */
  private observedBase?: Element;
  /** The rendered `<table>` is observed separately because intrinsic content can grow its width
   *  without changing `[part='base']`'s own border box. */
  private observedTable?: Element;
  private readonly observedHeaders = new Set<Element>();

  private parsePixelLength(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed.endsWith('px')) return undefined;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  /** The themed floor a column may be dragged/keyed down to, in used pixels. `rem`/`em` resolve
   *  against the live root/own font size through the shared `resolveCssLength()` -- a hardcoded
   *  `* 16` would pick the wrong floor on a page whose root font-size isn't the browser default.
   *  A token in a unit with no used pixel length here (`ch`, `pt`, `calc()`, a bare `%` with no
   *  base) falls back to DEFAULT_RESIZE_MIN_WIDTH_PX rather than being read as raw pixels. */
  private minimumResizeWidth(column: TableColumn<T>): number {
    const explicit = this.parsePixelLength(column.minWidth);
    if (explicit !== undefined) return Math.max(0, explicit);
    const ownerWindow = this.ownerDocument.defaultView;
    const hostStyle = ownerWindow?.getComputedStyle(this);
    const themed =
      hostStyle?.getPropertyValue('--lr-table-resize-min-width').trim() ||
      hostStyle?.getPropertyValue('--_lr-table-resize-min-width-default').trim() ||
      '';
    const resolved = resolveCssLength(themed, { host: this });
    return resolved === undefined ? DEFAULT_RESIZE_MIN_WIDTH_PX : Math.max(0, resolved);
  }

  private maximumResizeWidth(column: TableColumn<T>, minWidth: number): number {
    const explicit = this.parsePixelLength(column.maxWidth);
    return explicit === undefined ? Number.POSITIVE_INFINITY : Math.max(minWidth, explicit);
  }

  private currentResizeWidth(column: TableColumn<T>, handle?: HTMLElement): number {
    const resized = this.resizedColumnWidths.get(column.key);
    if (resized !== undefined) return resized;
    const explicit = this.parsePixelLength(column.width);
    if (explicit !== undefined) return explicit;
    const rendered = handle?.closest('th[data-col-key]')?.getBoundingClientRect().width;
    return rendered && rendered > 0 ? rendered : this.minimumResizeWidth(column);
  }

  private resizeColumnTo(column: TableColumn<T>, requestedWidth: number): void {
    const minWidth = this.minimumResizeWidth(column);
    const maxWidth = this.maximumResizeWidth(column, minWidth);
    const width = Math.min(maxWidth, Math.max(minWidth, requestedWidth));
    const previousWidth = this.resizedColumnWidths.get(column.key);
    if (previousWidth === width) return;
    this.resizedColumnWidths = new Map(this.resizedColumnWidths).set(column.key, width);
    // Unlike a pointer drag's per-pixel `onResizePointerMove` stream, every keyboard step here is
    // already a single, final, deliberately-committed width change -- exactly the kind of
    // "committed width" this event is scoped to be vetoable for.
    const event = this.emit('lr-column-resize', Object.freeze({ columnKey: column.key, width }), { cancelable: true });
    if (!event.defaultPrevented) return;
    const reverted = new Map(this.resizedColumnWidths);
    if (previousWidth === undefined) reverted.delete(column.key);
    else reverted.set(column.key, previousWidth);
    this.resizedColumnWidths = reverted;
  }

  private renderedColumnWidth(column: TableColumn<T>): string | undefined {
    const resized = this.resizedColumnWidths.get(column.key);
    // A resized width is our own clamped number; `column.width` is a free-form consumer string and
    // lands in a declaration list via styleMap, so it has to be validated as a CSS length first.
    return resized === undefined ? sanitizeCssLength(column.width, 'height') : `${resized}px`;
  }

  private onResizePointerDown = (event: PointerEvent): void => {
    const handle = event.currentTarget as HTMLElement;
    const key = handle.dataset['colKey'];
    const column = key ? this.columnsByKey.get(key) : undefined;
    const header = handle.closest('th[data-col-key]') as HTMLElement | null;
    const resizeEventWindow = this.ownerDocument.defaultView;
    if (!key || !column || !header || !resizeEventWindow) return;
    const replacedStartWidth = this.resizeState?.key === key ? this.resizeState.startWidth : undefined;
    this.cancelResizeGesture();
    const minWidth = this.minimumResizeWidth(column);
    this.resizeState = {
      key,
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: replacedStartWidth ?? header.getBoundingClientRect().width,
      minWidth,
      maxWidth: this.maximumResizeWidth(column, minWidth),
      handle,
      previousWidth: this.resizedColumnWidths.get(key),
    };
    // Firefox drops :active once pointer capture begins. Keep the rendered drag state explicit so
    // the pressed hook remains visible for the entire gesture in every supported engine.
    handle.toggleAttribute('data-resizing', true);
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture?.(event.pointerId);
    this.resizeEventWindow = resizeEventWindow;
    resizeEventWindow.addEventListener('pointermove', this.onResizePointerMove);
    resizeEventWindow.addEventListener('pointerup', this.onResizePointerEnd);
    resizeEventWindow.addEventListener('pointercancel', this.onResizePointerEnd);
    resizeEventWindow.addEventListener('lostpointercapture', this.onResizePointerEnd);
  };

  private onResizePointerMove = (event: PointerEvent): void => {
    const state = this.resizeState;
    if (!state || event.pointerId !== state.pointerId) return;
    const delta = isRtl(this) ? state.startX - event.clientX : event.clientX - state.startX;
    const width = Math.min(state.maxWidth, Math.max(state.minWidth, state.startWidth + delta));
    if (this.resizedColumnWidths.get(state.key) === width) return;
    this.resizedColumnWidths = new Map(this.resizedColumnWidths).set(state.key, width);
    this.emit('lr-column-resize', Object.freeze({ columnKey: state.key, width }));
  };

  private onResizeKeyDown = (event: KeyboardEvent): void => {
    const handle = event.currentTarget as HTMLElement;
    const key = handle.dataset['colKey'];
    const column = key ? this.columnsByKey.get(key) : undefined;
    if (!column) return;

    const minWidth = this.minimumResizeWidth(column);
    const maxWidth = this.maximumResizeWidth(column, minWidth);
    const currentWidth = this.currentResizeWidth(column, handle);
    const step = event.shiftKey ? 50 : 10;
    let requestedWidth: number | undefined;
    if (event.key === 'Home') requestedWidth = minWidth;
    else if (event.key === 'End' && Number.isFinite(maxWidth)) requestedWidth = maxWidth;
    else if (event.key === 'ArrowLeft') requestedWidth = currentWidth + (isRtl(this) ? step : -step);
    else if (event.key === 'ArrowRight') requestedWidth = currentWidth + (isRtl(this) ? -step : step);
    if (requestedWidth === undefined) return;

    event.preventDefault();
    event.stopPropagation();
    this.resizeColumnTo(column, requestedWidth);
  };

  private renderResizeHandle(column: TableColumn<T>) {
    if (!column.resizable) return nothing;
    const minWidth = this.minimumResizeWidth(column);
    const maxWidth = this.maximumResizeWidth(column, minWidth);
    return html`<span
      part="resize-handle"
      data-col-key=${column.key}
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      aria-label=${this.localize('resizeColumn', undefined, { label: column.label })}
      aria-valuemin=${Math.round(minWidth)}
      aria-valuenow=${Math.round(this.currentResizeWidth(column))}
      aria-valuemax=${Number.isFinite(maxWidth) ? Math.round(maxWidth) : UNBOUNDED_RESIZE_ARIA_MAX}
      @pointerdown=${this.onResizePointerDown}
      @keydown=${this.onResizeKeyDown}
    ></span>`;
  }

  private syncResizeHandleValues(): void {
    for (const handle of this.renderRoot.querySelectorAll<HTMLElement>('[part="resize-handle"]')) {
      const key = handle.dataset['colKey'];
      if (!key) continue;
      const column = this.columnsByKey.get(key);
      if (!column || this.resizedColumnWidths.has(key) || this.parsePixelLength(column.width) !== undefined) {
        continue;
      }
      const rendered = handle.closest('th[data-col-key]')?.getBoundingClientRect().width;
      if (rendered && rendered > 0) handle.setAttribute('aria-valuenow', String(Math.round(rendered)));
    }
  }

  private onResizePointerEnd = (event: PointerEvent): void => {
    const state = this.resizeState;
    if (!state || event.pointerId !== state.pointerId) return;
    state.handle.removeAttribute('data-resizing');
    if (event.type === 'pointerup') {
      try {
        state.handle.releasePointerCapture?.(event.pointerId);
      } catch {
        // Native capture may already have been released.
      }
    }
    this.resizeState = undefined;
    this.detachResizePointerListeners();

    if (event.type !== 'pointerup') {
      const reverted = new Map(this.resizedColumnWidths);
      if (state.previousWidth === undefined) reverted.delete(state.key);
      else reverted.set(state.key, state.previousWidth);
      this.resizedColumnWidths = reverted;
      return;
    }

    // The drag's committed final width -- the one and only point in the gesture that's vetoable.
    // `onResizePointerMove` above fires the same event once per pixel purely as live drag
    // feedback. Those intermediate steps stay non-cancelable so the preview cannot be vetoed
    // frame by frame.
    const committedWidth = this.resizedColumnWidths.get(state.key);
    if (committedWidth === undefined || committedWidth === state.previousWidth) return;
    const commitEvent = this.emit(
      'lr-column-resize',
      Object.freeze({ columnKey: state.key, width: committedWidth }),
      { cancelable: true }
    );
    if (!commitEvent.defaultPrevented) return;
    const reverted = new Map(this.resizedColumnWidths);
    if (state.previousWidth === undefined) reverted.delete(state.key);
    else reverted.set(state.key, state.previousWidth);
    this.resizedColumnWidths = reverted;
  };

  private detachResizePointerListeners(): void {
    const resizeEventWindow = this.resizeEventWindow;
    if (!resizeEventWindow) return;
    resizeEventWindow.removeEventListener('pointermove', this.onResizePointerMove);
    resizeEventWindow.removeEventListener('pointerup', this.onResizePointerEnd);
    resizeEventWindow.removeEventListener('pointercancel', this.onResizePointerEnd);
    resizeEventWindow.removeEventListener('lostpointercapture', this.onResizePointerEnd);
    this.resizeEventWindow = undefined;
  }

  private rollbackResizePreview(state: TableResizeState): void {
    const reverted = new Map(this.resizedColumnWidths);
    if (state.previousWidth === undefined) reverted.delete(state.key);
    else reverted.set(state.key, state.previousWidth);
    this.resizedColumnWidths = reverted;
  }

  private cancelResizeGesture(): void {
    const state = this.resizeState;
    this.resizeState = undefined;
    this.detachResizePointerListeners();
    if (!state) return;
    state.handle.removeAttribute('data-resizing');
    try {
      state.handle.releasePointerCapture?.(state.pointerId);
    } catch {
      // Native capture may already have been released by removal/cancellation.
    }
    this.rollbackResizePreview(state);
  }

  /** Coalesces however many `resizeObserver` callback ticks land in one animation frame (an
   *  animated/dragged ancestor resize can fire the observer once per frame) into a single
   *  read+write pass, instead of re-running `recomputeHiddenPriorityColumns()` / `applyStickyOffsets()` /
   *  `syncResizeHandleValues()` -- each its own DOM query plus per-element measurement -- on every
   *  tick. A second tick that lands while a frame is already pending is a no-op; the id resets once
   *  the scheduled frame runs, so the very next tick after that schedules a fresh one. */
  private scheduleLayoutSync = (): void => {
    if (this.layoutFrame) return;
    const owner = this.ownerDocument.defaultView;
    if (!owner) return;
    const frame: OwnedAnimationFrame = { owner, handle: 0 };
    frame.handle = owner.requestAnimationFrame(() => {
      if (this.layoutFrame !== frame) return;
      this.layoutFrame = null;
      if (!this.isConnected || this.ownerDocument.defaultView !== owner) return;
      this.syncAutoScrollMode();
      this.recomputeHiddenPriorityColumns();
      this.applyStickyOffsets();
      this.syncResizeHandleValues();
    });
    this.layoutFrame = frame;
  };

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    // A grid with no accessible name is a real a11y defect but silently renders. Warn once per
    // element (dev signal; the guard keeps it out of hot render paths and prevents log spam).
    if (isDevelopmentRuntime() && !this.accessibleLabel && !this.hasAttribute('aria-label') && !this.caption) {
      console.warn(
        '<lr-table> has no accessible name: set `accessibleLabel`, a host `aria-label`, or ' +
          '`caption` so assistive technology can identify the grid.'
      );
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSink();
    const owner = this.ownerDocument.defaultView;
    const ResizeObserverCtor = owner?.ResizeObserver;
    let observer: ResizeObserver | undefined;
    if (ResizeObserverCtor) {
      observer = new ResizeObserverCtor(() => {
        if (!this.isConnected || this.ownerDocument.defaultView !== owner || this.resizeObserver !== observer) {
          return;
        }
        this.scheduleLayoutSync();
      });
    }
    this.resizeObserver = observer;
    // A reconnect re-creates the observer above but the shadow root content
    // survives across disconnect/reconnect (Lit doesn't tear down the shadow
    // root) — re-observe [part='base'] here if it already exists from before
    // the disconnect, and the sticky-column header cells along with it
    // (disconnectedCallback() cleared observedHeaders, and observeHeaders()
    // otherwise only runs from updated(), which a pure DOM move never
    // triggers — a header resize between reconnect and the next update would
    // go unnoticed). On the very first mount connectedCallback() fires
    // *before* Lit's first render, so [part='base'] doesn't exist yet and
    // this is a no-op; updated() below (which always runs after render, first
    // paint included) covers that case instead.
    const base = this.renderRoot?.querySelector('[part="base"]');
    if (base) {
      this.observeBase(base);
      this.observeTable(this.renderRoot.querySelector('[part="table"]') ?? undefined);
      this.observeHeaders();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseAnnouncementSink();
    this.cancelResizeGesture();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    const frame = this.layoutFrame;
    if (frame) frame.owner.cancelAnimationFrame(frame.handle);
    this.layoutFrame = null;
    this.observedBase = undefined;
    this.observedTable = undefined;
    this.observedHeaders.clear();
  }

  private releaseAnnouncementSink(): void {
    this.announcementSink?.release();
    this.announcementSink = undefined;
  }

  private syncAnnouncementSink(): void {
    if (!this.isConnected) {
      this.releaseAnnouncementSink();
      return;
    }
    if (this.announcementSink?.element.ownerDocument === this.ownerDocument) return;
    this.releaseAnnouncementSink();
    this.announcementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  private localizedOverride(key: string, override: string | undefined): string {
    return override == null ? this.localize(key) : override;
  }

  private loadingText(): string {
    return this.localizedOverride('tableLoading', this.loadingLabel);
  }

  private observeBase(base: Element): void {
    if (this.observedBase === base) return;
    if (this.observedBase) this.resizeObserver?.unobserve(this.observedBase);
    this.resizeObserver?.observe(base);
    this.observedBase = base;
  }

  private observeTable(table: Element | undefined): void {
    if (this.observedTable === table) return;
    if (this.observedTable) this.resizeObserver?.unobserve(this.observedTable);
    if (table) this.resizeObserver?.observe(table);
    this.observedTable = table;
  }

  /** Applies the opt-in responsive scroll policy from rendered geometry. A one-pixel tolerance
   *  absorbs CSSOM's integer rounding of fractional layouts, matching the library's other
   *  overflow-aware controls. Existing `'self'` and `'page'` modes never retain this internal
   *  measurement marker, so their established CSS remains authoritative. */
  private syncAutoScrollMode(): void {
    const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
    if (!base) return;
    const overflows =
      this.scrollMode === 'auto' &&
      base.scrollWidth - base.clientWidth > TABLE_SCROLL_OVERFLOW_TOLERANCE_PX;
    base.toggleAttribute('data-scroll-overflow', overflows);
  }

  private observeHeaders(): void {
    const headers = new Set<Element>(
      this.columns.some((column) => column.sticky || column.resizable)
        ? this.renderRoot.querySelectorAll<HTMLElement>('th[data-col-key]')
        : []
    );
    for (const header of this.observedHeaders) {
      if (!headers.has(header)) {
        this.resizeObserver?.unobserve(header);
        this.observedHeaders.delete(header);
      }
    }
    for (const header of headers) {
      if (!this.observedHeaders.has(header)) {
        this.observedHeaders.add(header);
        this.resizeObserver?.observe(header);
      }
    }
  }

  /** Recomputes actual hidden state from the live DOM and separately tracks
   *  whether the priority-column toggle remains useful while force-visible.
   *  Called from `updated()` (covers a change driven by
   *  `columns`/`rows`/`priorityColumnsVisible` rather than a container resize) and
   *  from the `ResizeObserver` callback (covers a container resize with no
   *  Lit-tracked property change at all). */
  private recomputeHiddenPriorityColumns(): void {
    const hasPriorityColumns = this.columns.some((col) => col.priority);
    const anyPriorityHidden =
      hasPriorityColumns &&
      [...this.renderRoot.querySelectorAll<HTMLElement>('th[data-priority]')].some((el) => el.offsetParent === null);
    const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
    const inlineSize = base?.clientWidth ?? 0;
    const wouldHideAtAllocation =
      hasPriorityColumns &&
      inlineSize > 0 &&
      this.columns.some(
        (column) =>
          (column.priority === 'low' && inlineSize <= LOW_PRIORITY_MAX_INLINE_SIZE) ||
          (column.priority === 'medium' && inlineSize <= MEDIUM_PRIORITY_MAX_INLINE_SIZE)
      );
    const toggleAvailable = anyPriorityHidden || (this.priorityColumnsVisible && wouldHideAtAllocation);
    this.rehomeFocusedColumn();
    if (this.priorityColumnsToggleAvailable !== toggleAvailable) {
      this.priorityColumnsToggleAvailable = toggleAvailable;
    }
    if (this.hasHiddenPriorityColumns !== anyPriorityHidden) {
      this.hasHiddenPriorityColumns = anyPriorityHidden;
    }
  }

  private rehomeFocusedColumn(): void {
    const visible = this.visibleHeaders();
    if (visible.length === 0 || this.activeColKey === null) return;
    if (!visible.some((header) => header.dataset['colKey'] === this.activeColKey)) {
      this.activeColKey = visible[0]!.dataset['colKey'] ?? null; // safe: length === 0 returned above
    }
  }

  private keyOf(row: T, index: number): string | number | undefined {
    try {
      const key: unknown = this.rowKey ? this.rowKey(row) : index;
      if (typeof key === 'string') return key.trim().length === 0 ? undefined : key;
      return typeof key === 'number' ? key : undefined;
    } catch {
      return undefined;
    }
  }

  /** The one identity projection shared by filtering, sorting, pagination, focus, actions, events,
   * totals, and rendering. Identity is resolved once per source occurrence and retained on the
   * entry, so a stateful `rowKey` callback cannot make those consumers disagree within one model. */
  private cachedCanonicalRowEntries: TableRowEntry<T>[] | null = null;
  private canonicalRowEntriesInputs: {
    rows: readonly T[];
    rowKey: ((row: T) => string | number) | undefined;
  } | null = null;
  private canonicalRowEntries(): TableRowEntry<T>[] {
    const inputs = this.canonicalRowEntriesInputs;
    if (
      this.cachedCanonicalRowEntries !== null &&
      inputs?.rows === this.rows &&
      inputs.rowKey === this.rowKey
    ) {
      return this.cachedCanonicalRowEntries;
    }
    const entries: TableRowEntry<T>[] = [];
    const seen = new Set<string>();
    this.rows.forEach((row, index) => {
      const key = this.keyOf(row, index);
      if (key === undefined) return;
      const encoded = encodeKey(key);
      if (seen.has(encoded)) return;
      seen.add(encoded);
      entries.push({ row, index, key });
    });
    this.canonicalRowEntriesInputs = { rows: this.rows, rowKey: this.rowKey };
    this.cachedCanonicalRowEntries = entries;
    return entries;
  }

  /** Memoized across update cycles and re-validated against the exact inputs the computation
   *  reads — `rows` and `filter` by identity, the trimmed filter text, and (only when there is
   *  text to case-fold at all) the effective locale. This method is read (directly or
   *  transitively, via `matchingTotalItems`/`pageCount`/`appliedPage`/`renderedEntries()`) around
   *  a dozen times across one `willUpdate()` + `render()` pass, and an *unrelated* reactive
   *  update (a roving-tabindex move, an inline-editor open, ...) shouldn't re-run the
   *  `JSON.stringify()`-per-row default filter over the full `rows` array even once — comparing
   *  the recorded inputs instead of dropping the cache on every update keeps both cases to a
   *  single filtering pass. The locale is compared as its resolved string, so a change that
   *  arrives without a matching reactive-property key (an ancestor `lang` edit picked up on the
   *  next update, `setLyraLocale()`'s keyless `requestUpdate()`) still recomputes. */
  private cachedMatchingEntries: TableRowEntry<T>[] | null = null;
  private matchingEntriesInputs: {
    entries: TableRowEntry<T>[];
    filter: ((row: T, text: string) => boolean) | undefined;
    text: string;
    locale: string;
  } | null = null;
  private matchingEntries(): TableRowEntry<T>[] {
    const text = this.filterText.trim();
    // The locale only affects case-folding, which only happens when there is
    // filter text — skipping the read here keeps a locale change from
    // invalidating an unfiltered cache.
    const locale = text === '' ? '' : this.effectiveLocale;
    const canonicalEntries = this.canonicalRowEntries();
    const inputs = this.matchingEntriesInputs;
    if (
      this.cachedMatchingEntries !== null &&
      inputs !== null &&
      inputs.entries === canonicalEntries &&
      inputs.filter === this.filter &&
      inputs.text === text &&
      inputs.locale === locale
    ) {
      return this.cachedMatchingEntries;
    }
    let entries: TableRowEntry<T>[];
    if (text === '') {
      entries = canonicalEntries;
    } else {
      const intlLocale = this.effectiveLocale;
      const normalized = text.toLocaleLowerCase(intlLocale);
      entries = canonicalEntries.filter(({ row }) => {
        const matches = this.filter
          ? this.filter(row, text)
          : safeStringifyForFilter(row).toLocaleLowerCase(intlLocale).includes(normalized);
        return matches;
      });
    }
    this.matchingEntriesInputs = { entries: canonicalEntries, filter: this.filter, text, locale };
    this.cachedMatchingEntries = entries;
    return entries;
  }

  /** Read-time-safe view of `pageSize` -- finite, truncated and bounded to 1..500.
   *  Mirrors `<lr-pagination>`'s own identically-named getter (this component composes that
   *  primitive for the actual pagination UI in `render()`, but slices `rows` itself for client-mode
   *  pagination, so it needs the same safe count independently). */
  private get normalizedPageSize(): number {
    return finiteInteger(this.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  }

  /** Placeholder row count actually rendered by `loadingAppearance="skeleton"`. An explicit,
   *  positive `skeletonRows` wins after applying the shared bound; otherwise the count is derived
   *  from the normalized `pageSize` under the same bound. */
  private get effectiveSkeletonRows(): number {
    const explicit = finiteCount(this.skeletonRows, 0, MAX_SKELETON_ROWS);
    if (explicit > 0) return explicit;
    const pageSize = this.normalizedPageSize;
    return pageSize === DEFAULT_PAGE_SIZE ? DEFAULT_SKELETON_ROWS : Math.min(pageSize, MAX_SKELETON_ROWS);
  }

  /** `totalItems: -1` (the default) is a sentinel meaning "derive from filtered rows" -- normalize
   *  first so a non-finite/garbage `totalItems` degrades to that same derived-count fallback
   *  instead of propagating NaN, while a genuine non-negative value is still honored verbatim. */
  private get matchingTotalItems(): number {
    const totalItems = finiteInteger(this.totalItems, -1);
    return totalItems >= 0 ? totalItems : this.matchingEntries().length;
  }

  private get pageCount(): number {
    const pageSize = this.normalizedPageSize;
    return pageSize > 0 ? Math.ceil(this.matchingTotalItems / pageSize) : 0;
  }

  /** Read-time-safe view of `page`, clamped to `[1, pageCount]` -- mirrors
   *  `<lr-pagination>`'s own `currentPage` getter and, like `<lr-av-player>`'s `currentTime`
   *  setter, clamps against a dynamic, just-computed upper bound rather than a fixed one. */
  private get appliedPage(): number {
    if (this.pageCount === 0) return 1;
    return finiteInteger(this.page, 1, 1, this.pageCount);
  }

  /** Memoized on the same principle as `matchingEntries()` above, and re-validated against the
   *  exact inputs the sort reads. `renderedEntries()` is read several times per update pass (the
   *  `rowsByKey` rebuild, `focusedRowKey()`, and `render()` itself), and a miss costs one
   *  consumer-supplied `sortValue()`/`cell()` call per row on top of the comparison pass — sorting
   *  once per reader would multiply that callback work by the number of readers for no benefit.
   *  `columns` is compared by identity because the ordering reads `sortValue`/`cell` off the
   *  active column object; `locale` because it selects the collator. */
  private cachedSortedEntries: TableRowEntry<T>[] | null = null;
  private sortedEntriesInputs: {
    entries: TableRowEntry<T>[];
    columns: readonly TableColumn<T>[];
    mode: TableSortMode;
    key: string;
    dir: TableSortDirection;
    locale: string;
    groupBy: ((row: T) => string | number) | undefined;
  } | null = null;
  /** `matchingEntries()` reordered by the active sort column. A no-op — the filtered array is
   *  returned by identity, never copied — under `sortMode: 'server'`, with no `sortKey`, or when
   *  `sortKey` names a column that is missing or not `sortable`, which is what keeps a table that
   *  never sets `sortKey` rendering its input order verbatim.
   *
   *  When `groupBy` is set the sort is applied *within* each group rather than across the whole
   *  set. `render()` emits a group header wherever the group key changes between consecutive
   *  rendered rows, so a flat global sort on a column uncorrelated with the group key would
   *  interleave the groups and emit a header before nearly every row — the grouping would be
   *  visually destroyed by sorting. Groups keep their first-appearance order in `rows` (a `Map`
   *  iterates in insertion order); the group key is deliberately *not* collated, because the
   *  consumer controls group order through the order it supplies `rows` in, exactly as it does
   *  when no sort is active.
   *
   *  The one exception: when the active column's value is constant inside *every* group, the
   *  within-group sort is provably inert, so the *groups* are ordered by that constant value
   *  instead. Without it, sorting on the group column would flip `aria-sort` and the chevron while
   *  changing nothing — announcing an ordering the table never applied. */
  private sortedEntries(): TableRowEntry<T>[] {
    const entries = this.matchingEntries();
    if (this.sortMode !== 'client' || this.sortKey === '') return entries;
    const col = this.columnsByKey.get(this.sortKey);
    if (!col?.sortable) return entries;
    const locale = this.effectiveLocale;
    const inputs = this.sortedEntriesInputs;
    if (
      this.cachedSortedEntries !== null &&
      inputs !== null &&
      inputs.entries === entries &&
      inputs.columns === this.columns &&
      inputs.mode === this.sortMode &&
      inputs.key === this.sortKey &&
      inputs.dir === this.sortDir &&
      inputs.locale === locale &&
      inputs.groupBy === this.groupBy
    ) {
      return this.cachedSortedEntries;
    }
    const collator = getCollator(locale, { numeric: true });
    const dir = this.sortDir === 'desc' ? -1 : 1;
    // Decorate/sort/undecorate: `sortValue()`/`cell()` runs once per row rather than once per
    // comparison, so a costly consumer accessor stays O(n) instead of O(n log n). A non-finite
    // number is folded into the same "missing" bucket as null/undefined -- NaN would otherwise
    // make the comparator self-inconsistent (every comparison against it returns 0) and leave the
    // order engine-defined rather than merely surprising.
    const decorated = entries.map((entry) => {
      const raw = col.sortValue ? col.sortValue(entry.row) : String(col.cell(entry.row) ?? '');
      return { entry, value: typeof raw === 'number' && !Number.isFinite(raw) ? null : raw };
    });
    // Array.prototype.sort is stable, so rows comparing equal keep their `rows` order.
    const compare = (
      a: { value: string | number | null | undefined },
      b: { value: string | number | null | undefined }
    ): number => {
      const av = a.value;
      const bv = b.value;
      // Missing values sort last in BOTH directions -- multiplying by `dir` here would float a
      // block of blanks to the top the moment the user flipped to descending.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return collator.compare(String(av), String(bv)) * dir;
    };
    let sorted: TableRowEntry<T>[];
    const groupBy = this.groupBy;
    if (groupBy === undefined) {
      decorated.sort(compare);
      sorted = decorated.map((decoration) => decoration.entry);
    } else {
      // Partition first, sort inside each partition. A `Map` keyed by the group key iterates in
      // insertion order, so the groups come back in their first-appearance order in `rows` and
      // stay contiguous -- see this method's doc comment.
      const buckets = new Map<string | number, typeof decorated>();
      for (const decoration of decorated) {
        const groupKey = groupBy(decoration.entry.row);
        const bucket = buckets.get(groupKey);
        if (bucket === undefined) buckets.set(groupKey, [decoration]);
        else bucket.push(decoration);
      }
      const ordered = [...buckets.values()];
      // A column whose value never varies inside a group -- the group column itself being the
      // obvious case, but also any column functionally determined by the group key, and the
      // one-row-per-group case -- makes the within-group sort provably inert: every comparison
      // ties, the sort is stable, and the rendered order is identical to the unsorted one. Sorting
      // only the rows would then leave `render()` announcing `aria-sort="ascending"` and painting a
      // chevron for an ordering the table never applied. Move the groups instead, keyed by that
      // constant value, so the announced ordering genuinely holds. Every bucket is non-empty by
      // construction, and `sort` is stable, so groups whose values tie keep first appearance.
      const constantWithinEveryGroup = ordered.every((bucket) =>
        bucket.every((decoration) => compare(decoration, bucket[0]!) === 0)
      );
      if (constantWithinEveryGroup) ordered.sort((a, b) => compare(a[0]!, b[0]!));
      sorted = [];
      for (const bucket of ordered) {
        if (!constantWithinEveryGroup) bucket.sort(compare);
        for (const decoration of bucket) sorted.push(decoration.entry);
      }
    }
    this.sortedEntriesInputs = {
      entries,
      columns: this.columns,
      mode: this.sortMode,
      key: this.sortKey,
      dir: this.sortDir,
      locale,
      groupBy,
    };
    this.cachedSortedEntries = sorted;
    return sorted;
  }

  private renderedEntries(): TableRowEntry<T>[] {
    const entries = this.sortedEntries();
    if (this.paginationMode === 'server') return entries.slice(0, this.normalizedPageSize);
    const start = (this.appliedPage - 1) * this.normalizedPageSize;
    return entries.slice(start, start + this.normalizedPageSize);
  }

  private onFilterInput = (event: Event): void => {
    event.stopPropagation();
    const input = event.currentTarget as HTMLInputElement;
    this.filterText = input.value;
    this.emit('lr-filter-change', Object.freeze({ text: this.filterText }));
  };
  private stopOwnedEvent = (event: Event): void => {
    event.stopPropagation();
  };
  private onNativeFocus = (event: FocusEvent): void => {
    event.stopPropagation();
    this.emit('focus');
  };
  private onNativeBlur = (event: FocusEvent): void => {
    event.stopPropagation();
    this.emit('blur');
  };

  private onPaginationChange = (event: Event): void => {
    event.stopPropagation();
    const { page } = (event as CustomEvent<{ page: number; pageSize?: number }>).detail;
    // Table's pagination contract carries only the requested page. The
    // nested pagination component has a wider `{ page, pageSize }` payload in v8; do not leak that
    // implementation detail into Table's independently documented event surface.
    if (this.paginationMode === 'client') this.page = page;
    this.emit('lr-page-change', Object.freeze({ page }));
  };

  /** The header cell that currently owns `tabindex="0"`. */
  private focusedColKey(): string | null {
    const visible = this.visibleHeaders();
    const visibleKeys = new Set(
      visible
        .map((el) => el.dataset['colKey'])
        .filter((key): key is string => key !== undefined && this.columnsByKey.has(key))
    );
    if (this.activeColKey !== null && this.columnsByKey.has(this.activeColKey)) {
      if (visibleKeys.size === 0 || visibleKeys.has(this.activeColKey)) return this.activeColKey;
    }
    return (
      visible.find((el) => el.dataset['colKey'] !== undefined && this.columnsByKey.has(el.dataset['colKey']))?.dataset[
        'colKey'
      ] ??
      this.columns[0]?.key ??
      null
    );
  }

  /** The body row that currently owns `tabindex="0"`. */
  private focusedRowKey(): string | null {
    if (this.activeRowKey !== null && this.rowsByKey.has(this.activeRowKey)) {
      return this.activeRowKey;
    }
    const selectedKey = this._selectedKeys.values().next().value as string | number | undefined;
    if (selectedKey !== undefined) {
      const selected = encodeKey(selectedKey);
      if (this.rowsByKey.has(selected)) return selected;
    }
    const first = this.renderedEntries()[0];
    return first ? encodeKey(first.key) : null;
  }

  private rowsAffectingRovingFocusChanged(changed: PropertyValues): boolean {
    return (
      changed.has('rows') ||
      changed.has('rowKey') ||
      changed.has('filterText') ||
      changed.has('filter') ||
      changed.has('page') ||
      changed.has('pageSize') ||
      changed.has('paginationMode') ||
      changed.has('totalItems') ||
      changed.has('columns') ||
      changed.has('sortKey') ||
      changed.has('sortDir') ||
      changed.has('sortMode') ||
      changed.has('groupBy')
    );
  }

  /** Captures a direct header/row focus owner before `repeat()` moves or removes it. Nested
   * controls and persistent editors deliberately do not qualify: they own their own focus
   * contracts, and the editor restoration path below handles the one supported moved-node case. */
  private captureRovingFocus(changed: PropertyValues): void {
    this.rovingFocusSnapshot = null;
    const active = activeElementIn(this.shadowRoot);
    const HTMLElementCtor = this.ownerDocument?.defaultView?.HTMLElement;
    if (!HTMLElementCtor || !(active instanceof HTMLElementCtor)) return;

    if (changed.has('columns') && active.matches('th[data-col-key]')) {
      const headers = this.visibleHeaders();
      const key = active.dataset['colKey'];
      const index = headers.indexOf(active);
      if (key !== undefined && index >= 0) {
        this.rovingFocusSnapshot = { kind: 'header', key, index, targetKey: null, element: active };
      }
      return;
    }

    if (this.rowsAffectingRovingFocusChanged(changed) && active.matches('tr[data-row-key]')) {
      const renderedRows = [...this.renderRoot.querySelectorAll<HTMLElement>('tbody tr[data-row-key]')];
      const key = active.dataset['rowKey'];
      const index = renderedRows.indexOf(active);
      if (key !== undefined && index >= 0) {
        this.rovingFocusSnapshot = { kind: 'row', key, index, targetKey: null, element: active };
      }
    }
  }

  /** Resolves the captured key against the new controlled collection before render, so the new
   * DOM immediately assigns `tabindex="0"` to the member `updated()` will focus. */
  private resolveRovingFocusTarget(): void {
    const snapshot = this.rovingFocusSnapshot;
    if (snapshot === null) return;
    const keys = snapshot.kind === 'header' ? this.columns.map((column) => column.key) : [...this.rowsByKey.keys()];
    snapshot.targetKey = keys.includes(snapshot.key)
      ? snapshot.key
      : keys[Math.min(snapshot.index, keys.length - 1)] ?? null;
    if (snapshot.kind === 'header') this.activeColKey = snapshot.targetKey;
    else this.activeRowKey = snapshot.targetKey;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.captureRovingFocus(changed);
    if (
      this.selectionMode === 'single' &&
      this._selectedKeys.size > 1 &&
      (changed.has('selectionMode') || changed.has('selectedRowKeys'))
    ) {
      const first = this._selectedKeys.values().next().value as string | number | undefined;
      this.selectedRowKeys = first === undefined ? new Set() : new Set([first]);
      // A host mirroring "selected rows" purely from lr-selection-change must hear about this
      // coercion too -- it is the only other place selectedRowKeys mutates, alongside the
      // click/keyboard handler's two emit sites below. Non-cancelable: this is a consistency
      // fix-up, not a user action to veto. Skipped on the very first update -- an already
      // over-large selectedRowKeys combined with selectionMode="single" at mount is the starting
      // state, not a live transition, and `changed` lists every property on that first pass.
      if (this.hasUpdated) {
        const rowKeys = Object.freeze(first === undefined ? [] : [first]) as readonly (string | number)[];
        this.emit('lr-selection-change', Object.freeze({ rowKeys }));
      }
    }
    // Restore a persisted `priorityColumnsVisible` preference once, before the first render, so the restored
    // value folds into the first paint with no follow-up update -- doing this in firstUpdated()
    // (after the first render) would schedule a second update and trip Lit's dev warning. Mirrors
    // lr-app-rail's loadPersisted() call in its own willUpdate(). The `persistReady` gate in
    // updated() keeps this restored value from being written straight back.
    if (!this.hasUpdated) {
      const parsed = readPersistedState(
        this.storageFullKey,
        (v): v is { priorityColumnsVisible?: unknown } => typeof v === 'object' && v !== null
      );
      if (parsed && typeof parsed.priorityColumnsVisible === 'boolean') {
        this.priorityColumnsVisible = parsed.priorityColumnsVisible;
      }
    }
    // Ordered before the rowsByKey rebuild below, not after: client-mode sorting resolves the
    // active column through `columnsByKey`, so rebuilding it second would have the very first
    // update (where `columns` and `rows` land together) key rowsByKey off an *unsorted* order
    // while render() -- reading the now-populated map -- paints the sorted one, silently
    // resolving delegated row clicks to the wrong row.
    if (changed.has('columns')) {
      this.columnsByKey = new Map(this.columns.map((c) => [c.key, c]));
    }
    if (
      changed.has('rows') ||
      changed.has('rowKey') ||
      changed.has('filterText') ||
      changed.has('filter') ||
      changed.has('page') ||
      changed.has('pageSize') ||
      changed.has('paginationMode') ||
      changed.has('totalItems') ||
      // Sorting reorders the entries and, under pagination, changes which of them the current
      // page even contains -- so the key->entry map has to be rebuilt alongside it.
      changed.has('columns') ||
      changed.has('sortKey') ||
      changed.has('sortDir') ||
      changed.has('sortMode') ||
      // A client sort is applied within each group, so swapping `groupBy` re-orders the entries
      // (and, under pagination, changes which of them the current page holds) too.
      changed.has('groupBy')
    ) {
      this.rowsByKey = new Map(
        this.renderedEntries().map((entry) => [encodeKey(entry.key), entry])
      );
    }
    this.resolveRovingFocusTarget();
    if (this.editingCell !== null) {
      const column = this.columnsByKey.get(this.editingCell.columnKey);
      if (!this.rowsByKey.has(this.editingCell.rowKey) || normalizedEditTrigger(column?.editTrigger) !== 'double-click') {
        this.editingCell = null;
      }
    }
    // Read *before* render() gets to move the node out from under the focus it currently holds --
    // by the time updated() runs, "the editor was focused a moment ago" and "the user clicked away
    // a while ago" are indistinguishable from the DOM alone.
    this.editorHadFocusBeforeUpdate =
      this.focusedEditorCell !== null &&
      activeElementIn(this.shadowRoot) ===
        this.editorElementFor(this.focusedEditorCell.rowKey, this.focusedEditorCell.columnKey);
  }

  /** Each sticky column's cumulative inline-start offset — the sum of the *rendered
   *  width* of every earlier sticky column — so multiple sticky columns
   *  stack left-to-right instead of all pinning to inset-inline-start: 0 and
   *  overlapping. Table columns are intrinsically sized (not fixed-width), so
   *  this can't be computed in CSS alone; it requires measuring the actual
   *  laid-out `offsetWidth` of each earlier sticky column's header cell. */
  private stickyOffsets(): Map<string, number> {
    const offsets = new Map<string, number>();
    // One DOM query, indexed by column key — the width lookup below runs once
    // per sticky column, and re-querying every header cell for each lookup
    // would be quadratic in column count. First cell wins on a duplicate key,
    // matching a first-match linear scan over document order.
    const headerWidths = new Map<string, number>();
    for (const el of this.renderRoot.querySelectorAll<HTMLElement>('th[data-col-key]')) {
      const key = el.dataset['colKey'];
      if (key !== undefined && !headerWidths.has(key)) headerWidths.set(key, el.offsetWidth);
    }
    const headerWidth = (key: string): number => headerWidths.get(key) ?? 0;
    // 'start' columns stack left-to-right in array order (unchanged from
    // today); 'end' columns stack right-to-left (reverse array order) so a
    // trailing sticky column sits flush against the edge and an earlier
    // 'end' column stacks inward from it -- the mirror image of 'start'.
    // Both directions share the same --lr-table-sticky-offset custom
    // property: a column is exclusively 'start' XOR 'end', so there's no
    // collision, only the CSS rule matching that column's own data-sticky
    // value ever consumes the value this method wrote for it.
    let runningStart = 0;
    for (const col of this.columns) {
      if (stickyDirection(col.sticky) !== 'start') continue;
      offsets.set(col.key, runningStart);
      runningStart += headerWidth(col.key);
    }
    let runningEnd = 0;
    for (let i = this.columns.length - 1; i >= 0; i--) {
      const col = this.columns[i];
      if (!col) continue; // safe: counted loop over this.columns — never undefined in-bounds
      if (stickyDirection(col.sticky) !== 'end') continue;
      offsets.set(col.key, runningEnd);
      runningEnd += headerWidth(col.key);
    }
    return offsets;
  }

  /** `[lo, hi]` of every `heatValue` result across every matching row (post-sort, pre-pagination) and
   *  every `heatValue`-defining column, or `null` when heat-tint mode is off or there's no usable
   *  domain (no numeric values and no override). `heatTintScale` overrides either or both bounds. */
  private computeHeatDomain(hasHeatTint: boolean): [number, number] | null {
    if (!hasHeatTint) return null;
    const values: number[] = [];
    for (const entry of this.matchingEntries()) {
      for (const col of this.columns) {
        const v = col.heatValue?.(entry.row);
        if (v != null && Number.isFinite(v)) values.push(v);
      }
    }
    const auto = minMax(values);
    const lo = this.heatTintScale?.min ?? auto?.[0];
    const hi = this.heatTintScale?.max ?? auto?.[1];
    if (lo === undefined || hi === undefined) return null;
    return [lo, hi];
  }

  /** This cell's tint share as a CSS percentage string (e.g. `"42.00%"`), or `null` when the column
   *  has no `heatValue`, the domain is unavailable, or this row's value is missing/non-finite. */
  private heatShare(col: TableColumn<T>, row: T, domain: [number, number] | null): string | null {
    if (!col.heatValue || !domain) return null;
    const v = col.heatValue(row);
    if (v == null || !Number.isFinite(v)) return null;
    const [lo, hi] = domain;
    const t = finiteRatio(v, lo, hi);
    return `${(t * 100).toFixed(2)}%`;
  }

  private applyStickyOffsets(): void {
    if (!this.columns.some((c) => c.sticky)) return;
    const offsets = this.stickyOffsets();
    this.renderRoot.querySelectorAll<HTMLElement>('[data-col-key]').forEach((el) => {
      const key = el.dataset['colKey'];
      if (key !== undefined && offsets.has(key)) {
        el.style.setProperty('--lr-table-sticky-offset', `${offsets.get(key)}px`);
      }
    });
  }

  /** Applies stickyOffsets()'s measured per-column offsets as an inline
   *  `--lr-table-sticky-offset` custom property on every header cell and
   *  body cell in that column (addressed by the shared `data-col-key`
   *  attribute). This is a post-render DOM measurement — column widths
   *  aren't known until after the browser has laid out this update's
   *  render() output — so it runs from `updated()`, not `willUpdate()`,
   *  intentionally kept as a separate pass from the rowsByKey/columnsByKey
   *  rebuild above: those two must stay in `willUpdate()` so `render()`'s
   *  own `focusedRowKey()` call sees the current update's identity maps
   *  (e.g. freshly-assigned `selectedRowKeys` resolving to the correct
   *  roving-tabindex row on the very first paint), whereas the sticky-offset
   *  measurement can only run after that same paint has happened. Only runs
   *  when `hasSticky` is true (opt-in) and simply recomputes on every
   *  update; column widths are measured per update so the current layout
   *  reflects the rendered columns. */
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.loadingAnnouncementsReady && changed.has('loading') && this.loading) {
      this.announcementSink?.announce(this.loadingText());
    }
    this.loadingAnnouncementsReady = true;
    // Persist `priorityColumnsVisible` whenever it changes, but never on the initial update -- willUpdate()
    // restored it on that pass, so writing it back would be redundant, and with no `storage-key` set
    // `writePersistedState(undefined, ...)` is a silent no-op regardless.
    if (this.persistReady && changed.has('priorityColumnsVisible')) {
      writePersistedState(this.storageFullKey, { priorityColumnsVisible: this.priorityColumnsVisible });
    }
    this.persistReady = true;
    if (changed.has('columns') || changed.has('rows') || changed.has('rowKey')) this.applyStickyOffsets();
    this.syncResizeHandleValues();
    // Re-observe [part='base'] whenever this update's render() produced a
    // fresh one (first mount, or a swap to/from the <lr-empty> template
    // shape) — observeBase() itself no-ops when it's the same element as
    // already observed.
    const base = this.renderRoot.querySelector('[part="base"]');
    if (base) this.observeBase(base);
    this.observeTable(this.renderRoot.querySelector('[part="table"]') ?? undefined);
    this.syncAutoScrollMode();
    this.observeHeaders();
    this.restoreRovingFocus();
    if (this.hasAlwaysOnEditors) this.restoreAlwaysOnEditorFocus();
    // Scoped to the cell that actually opened: an unqualified `[part="cell-editor"]` lookup would
    // steal focus to whichever editor happens to be first in the tree, which stopped being "the
    // one that just opened" as soon as a column could render persistent editors of its own.
    if (changed.has('editingCell') && this.editingCell) {
      const { rowKey, columnKey } = this.editingCell;
      queueMicrotask(() => this.editorElementFor(rowKey, columnKey)?.focus());
    }
    // Deferred to a microtask rather than called synchronously here: a real
    // priority-hidden transition mutates the reactive `hasHiddenPriorityColumns`
    // property, and doing that from inside this same updated() call stack
    // schedules a second update from within the first update's own lifecycle
    // callback -- Lit's dev-mode "scheduled an update ... after an update
    // completed" warning. Pushing the write out to a microtask lets this
    // update finish first, so the follow-up update is a normal externally
    // triggered one instead.
    queueMicrotask(() => this.recomputeHiddenPriorityColumns());
  }

  /** Restores only focus that the current render displaced. If another internal control or an
   * outside element owns focus now, the snapshot is discarded instead of stealing it back. */
  private restoreRovingFocus(): void {
    const snapshot = this.rovingFocusSnapshot;
    this.rovingFocusSnapshot = null;
    if (snapshot === null) return;

    const internalActive = activeElementIn(this.shadowRoot);
    if (internalActive !== null && internalActive !== snapshot.element) return;
    const documentActive = activeElementIn(this.ownerDocument);
    if (documentActive !== null && documentActive !== this && documentActive !== this.ownerDocument.body) {
      return;
    }

    const candidates =
      snapshot.kind === 'header'
        ? this.visibleHeaders()
        : [...this.renderRoot.querySelectorAll<HTMLElement>('tbody tr[data-row-key]')];
    const exact = candidates.find((candidate) =>
      snapshot.kind === 'header'
        ? candidate.dataset['colKey'] === snapshot.targetKey
        : candidate.dataset['rowKey'] === snapshot.targetKey
    );
    const target = exact ?? candidates[Math.min(snapshot.index, candidates.length - 1)] ?? null;
    if (snapshot.kind === 'header') this.focusHeader(target);
    else this.focusRow(target);
  }

  /** Header activation (click, Enter, Space) proposes one canonical sort transaction. Client mode
   * owns the accepted state; server mode leaves state controlled while reporting the same commit. */
  private activateColumn(key: string): void {
    this.activeColKey = key;
    const col = this.columnsByKey.get(key);
    if (!col?.sortable) return;
    const sortDir = this.sortKey === key ? (this.sortDir === 'asc' ? 'desc' : 'asc') : this.defaultSortDir;
    const request = Object.freeze({ phase: 'request', sortKey: col.key, sortDir } as const);
    if (this.emit('lr-sort-request', request, { cancelable: true }).defaultPrevented) return;
    if (this.sortMode === 'client') {
      this.sortKey = col.key;
      this.sortDir = sortDir;
    }
    this.emit('lr-sort', Object.freeze({ phase: 'commit', sortKey: col.key, sortDir } as const));
  }

  private activateRow(key: string): void {
    this.activeRowKey = key;
    const entry = this.rowsByKey.get(key);
    if (entry === undefined) return;
    const { row, key: selectedKey } = entry;
    this.emit('lr-row-click', Object.freeze({ row }));
    if (this.selectionMode === 'single') {
      this.selectedRowKeys = new Set([selectedKey]);
      const rowKeys = Object.freeze([selectedKey] as const);
      this.emit('lr-selection-change', Object.freeze({ rowKeys }));
    } else if (this.selectionMode === 'multiple') {
      const rawKey = selectedKey;
      const next = new Set(this._selectedKeys);
      if (next.has(rawKey)) next.delete(rawKey);
      else next.add(rawKey);
      this.selectedRowKeys = next;
      const rowKeys = Object.freeze([...next]);
      this.emit('lr-selection-change', Object.freeze({ rowKeys }));
    }
  }

  /** Whether any column opts into persistent (`editTrigger: 'always'`) editors --
   *  the table-level flag inferred from the columns themselves, mirroring how
   *  `heatValue`/`width` opt their own modes in with no separate boolean. */
  private get hasAlwaysOnEditors(): boolean {
    return this.columns.some((col) => normalizedEditTrigger(col.editTrigger) === 'always');
  }

  private editorValue(row: T, column: TableColumn<T>): string {
    const value = column.editValue?.(row) ?? (row as Record<string, unknown>)[column.key] ?? '';
    return String(value);
  }

  /** Double-click only ever *opens* an editor, so an `'always'` column is
   *  deliberately excluded: its editor is already open, and setting
   *  `editingCell` for it would render a second, competing editor in the same
   *  cell. */
  private startEditing(rowKey: string, columnKey: string): void {
    const column = this.columnsByKey.get(columnKey);
    if (normalizedEditTrigger(column?.editTrigger) !== 'double-click' || !this.rowsByKey.has(rowKey)) return;
    this.editingCell = { rowKey, columnKey };
  }

  private commitEdit(event: Event, rowKey: string, columnKey: string): void {
    event.stopPropagation();
    const input = event.currentTarget as HTMLInputElement;
    const entry = this.rowsByKey.get(rowKey);
    const column = this.columnsByKey.get(columnKey);
    const isTransient = this.editingCell?.rowKey === rowKey && this.editingCell.columnKey === columnKey;
    if (!entry || !column || normalizedEditTrigger(column.editTrigger) === undefined) {
      if (isTransient) this.editingCell = null;
      return;
    }
    const value = column.editType === 'number' && input.value !== '' ? Number(input.value) : input.value;
    this.emit('lr-cell-edit', Object.freeze({ row: entry.row, columnKey, value }));
    if (isTransient) this.editingCell = null;
  }

  /** The `[part='cell-editor']` rendered in one specific body cell, or `null` when that row/column
   *  is not currently rendered (paginated away, filtered out, column removed) or holds no editor.
   *  Matched by walking `data-row-key`/`data-col-key` rather than by interpolating them into a
   *  selector: both are consumer-supplied strings, and the row key additionally carries an encoding
   *  prefix (`string:a`), so neither is safe to splat into CSS unescaped. */
  private editorElementFor(rowKey: string, columnKey: string): HTMLInputElement | null {
    const row = [...this.renderRoot.querySelectorAll<HTMLElement>('[data-row-key]')].find(
      (el) => el.dataset['rowKey'] === rowKey
    );
    const cell = row
      ? [...row.querySelectorAll<HTMLElement>('td[data-col-key]')].find((el) => el.dataset['colKey'] === columnKey)
      : undefined;
    return (cell?.querySelector('[part="cell-editor"]') as HTMLInputElement | null) ?? null;
  }

  /** Records which persistent editor holds focus, and drops the record as soon as focus lands on
   *  anything else inside the grid. Only `'always'` columns are tracked: a double-click editor is
   *  closed (and its node removed) by the very updates this would restore focus across. */
  private onTableFocusIn = (event: FocusEvent): void => {
    const target = event.target as HTMLElement | null;
    const cell = target?.closest?.('td[data-col-key]') as HTMLElement | null;
    const row = target?.closest?.('[data-row-key]') as HTMLElement | null;
    const columnKey = cell?.dataset['colKey'];
    const rowKey = row?.dataset['rowKey'];
    this.focusedEditorCell =
      target?.getAttribute('part') === 'cell-editor' &&
      columnKey !== undefined &&
      rowKey !== undefined &&
      normalizedEditTrigger(this.columnsByKey.get(columnKey)?.editTrigger) === 'always'
        ? { rowKey, columnKey }
        : null;
  };

  /** Puts focus back into the persistent editor this update moved it out of. Runs from `updated()`,
   *  after `render()`'s DOM moves have landed. A row that left the rendered set entirely
   *  (pagination, filtering) only clears the record: yanking focus to whichever unrelated row now
   *  occupies that position would be worse than losing it. */
  private restoreAlwaysOnEditorFocus(): void {
    const cell = this.focusedEditorCell;
    if (cell === null) return;
    const editor = this.editorElementFor(cell.rowKey, cell.columnKey);
    if (editor === null) {
      this.focusedEditorCell = null;
    } else if (this.editorHadFocusBeforeUpdate && activeElementIn(this.shadowRoot) !== editor) {
      editor.focus();
    }
    this.editorHadFocusBeforeUpdate = false;
  }

  /** The editor owns its own keys. `stopPropagation()` is unconditional and stays that way: inside
   *  a text field arrow keys are caret movement, not grid navigation.
   *
   *  Enter commits either flavor. For a double-click editor that also closes it (`commitEdit`
   *  clears `editingCell`); a persistent editor has no closed state to fall back to, so it stays
   *  open and keeps focus.
   *
   *  Escape cancels a double-click edit, which is a real action, so it is consumed. A persistent
   *  editor has nothing to cancel back to -- `editingCell` was never set for it -- so Escape is
   *  left uncancelled and an ancestor dialog/popover still closes on it. */
  private onEditorKeyDown = (event: KeyboardEvent, rowKey: string, columnKey: string): void => {
    event.stopPropagation();
    const alwaysOn = normalizedEditTrigger(this.columnsByKey.get(columnKey)?.editTrigger) === 'always';
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitEdit(event, rowKey, columnKey);
    } else if (event.key === 'Escape' && !alwaysOn) {
      event.preventDefault();
      this.editingCell = null;
    }
  };

  private onTableDoubleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const table = event.currentTarget as HTMLElement;
    if (eventInteractiveTarget(event, table)) return;
    const cell = target.closest('[part="cell"][data-col-key]') as HTMLElement | null;
    const row = target.closest('[data-row-key]') as HTMLElement | null;
    if (cell && row?.dataset['rowKey'] && cell.dataset['colKey']) {
      this.startEditing(row.dataset['rowKey'], cell.dataset['colKey']);
    }
  };

  private activateExpandToggle(key: string | number): void {
    const entry = this.rowsByKey.get(encodeKey(key));
    if (entry !== undefined)
      this.emit('lr-row-expand-toggle', Object.freeze({ row: entry.row, rowKey: key }));
  }

  /** Header cells currently in the tab sequence — excludes columns hidden by
   *  a `priority`-driven `@container` rule (table.styles.ts), so Left/Right/
   *  Home/End never strand the roving tab stop on a `display: none` cell
   *  that `.focus()` would silently no-op on. Scoped to `th` — body `<td>`s
   *  now carry the same `data-col-key` attribute (for the sticky-offset
   *  measurement pass) but must never be treated as header cells here. */
  private visibleHeaders(): HTMLElement[] {
    return [...(this.renderRoot?.querySelectorAll<HTMLElement>('th[data-col-key]') ?? [])].filter(
      (el) => el.offsetParent !== null
    );
  }

  private focusHeader(el: HTMLElement | null): void {
    if (!el?.dataset['colKey']) return;
    this.activeColKey = el.dataset['colKey'];
    el.focus();
  }

  private focusRow(el: HTMLElement | null): void {
    if (!el?.dataset['rowKey']) return;
    this.activeRowKey = el.dataset['rowKey'];
    el.focus();
  }

  private toggleColumns = (): void => {
    this.priorityColumnsVisible = !this.priorityColumnsVisible;
    this.emit(
      'lr-priority-columns-visibility-change',
      Object.freeze({ visible: this.priorityColumnsVisible })
    );
  };

  private onTableClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    const table = e.currentTarget as HTMLElement;
    // A cell()-rendered native/semantic control owns its own click. Passive custom content does
    // not match the guard and deliberately remains part of the row activation surface.
    if (eventInteractiveTarget(e, table)) return;
    // Scoped to `th` — body `<td>`s also carry `data-col-key` now (for the
    // sticky-offset measurement pass), so an unscoped `[data-col-key]` would
    // match the clicked cell itself and misroute a plain cell click to
    // column-sort activation instead of falling through to the row check
    // below.
    const th = target.closest('th[data-col-key]') as HTMLElement | null;
    if (th) return this.activateColumn(th.dataset['colKey']!);
    const tr = target.closest('[data-row-key]') as HTMLElement | null;
    if (tr) this.activateRow(tr.dataset['rowKey']!);
  };

  private onTableKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    const table = e.currentTarget as HTMLElement;
    // Same guard as onTableClick — also skips the table's own
    // preventDefault(), so a focused nested control keeps its native/own
    // Enter or Space activation instead of having it swallowed.
    if (eventInteractiveTarget(e, table)) return;
    // Same th-scoping rationale as onTableClick above.
    const th = target.closest('th[data-col-key]') as HTMLElement | null;
    if (th) return this.onHeaderKeyDown(e, th);
    const tr = target.closest('[data-row-key]') as HTMLElement | null;
    if (tr) this.onRowKeyDown(e, tr);
  };

  private onHeaderKeyDown(e: KeyboardEvent, th: HTMLElement): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.activateColumn(th.dataset['colKey']!);
      return;
    }
    const headers = this.visibleHeaders();
    const index = headers.indexOf(th);
    if (index < 0) return;
    // A native <table> already mirrors column visual order under RTL on its
    // own (no logical-property help needed, unlike flex/grid layouts), so
    // ArrowRight/ArrowLeft's *meaning* has to flip here to keep moving in the
    // visual direction the key name promises -- same contract as this repo's
    // other isRtl() callers (see internal/rtl.ts).
    const rtl = isRtl(this);
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.focusHeader(headers[rtl ? Math.min(headers.length - 1, index + 1) : Math.max(0, index - 1)] ?? null);
        return;
      case 'ArrowRight':
        e.preventDefault();
        this.focusHeader(headers[rtl ? Math.max(0, index - 1) : Math.min(headers.length - 1, index + 1)] ?? null);
        return;
      case 'Home':
        e.preventDefault();
        this.focusHeader(headers[0] ?? null);
        return;
      case 'End':
        e.preventDefault();
        this.focusHeader(headers[headers.length - 1] ?? null);
        return;
      case 'ArrowDown': {
        e.preventDefault();
        const rows = [...this.renderRoot.querySelectorAll<HTMLElement>('[data-row-key]')];
        const key = this.focusedRowKey();
        this.focusRow(rows.find((r) => r.dataset['rowKey'] === key) ?? rows[0] ?? null);
        return;
      }
      default:
        return;
    }
  }

  private onRowKeyDown(e: KeyboardEvent, tr: HTMLElement): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.activateRow(tr.dataset['rowKey']!);
      return;
    }
    const bodyRows = [...this.renderRoot.querySelectorAll<HTMLElement>('[data-row-key]')];
    const index = bodyRows.indexOf(tr);
    if (index < 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusRow(bodyRows[Math.min(bodyRows.length - 1, index + 1)] ?? null);
        return;
      case 'ArrowUp':
        e.preventDefault();
        if (index === 0) {
          const headers = this.visibleHeaders();
          const key = this.focusedColKey();
          this.focusHeader(headers.find((h) => h.dataset['colKey'] === key) ?? headers[0] ?? null);
        } else {
          this.focusRow(bodyRows[index - 1] ?? null);
        }
        return;
      case 'Home':
        e.preventDefault();
        this.focusRow(bodyRows[0] ?? null);
        return;
      case 'End':
        e.preventDefault();
        this.focusRow(bodyRows[bodyRows.length - 1] ?? null);
        return;
      default:
        return;
    }
  }

  /** One body cell's inline editor.
   *
   *  The persistent (`editTrigger: 'always'`) and double-click flavors differ in exactly one binding:
   *  the persistent editor binds `value` as a **content attribute**, the double-click one keeps the
   *  `.value` **property**. Native HTML sets an input's dirty-value flag on the user's first edit,
   *  after which content-attribute updates no longer overwrite what is displayed -- so an
   *  out-of-band `rows` update to a cell the user is already typing into leaves their draft alone,
   *  with no is-focused bookkeeping of the library's own. An untouched persistent editor has no
   *  dirty flag set, so it still picks up a new `rows` value normally. A double-click editor is
   *  short-lived and opens against the value it is editing, so the property binding's deliberate
   *  re-assert is right for it. Two templates rather than one because a lit template literal fixes
   *  each binding's kind at authoring time.
   *
   *  No `tabindex` on either: a persistent editor is a plain tab stop, exactly like the row-expand
   *  toggle rendered a few lines above, and stays outside the header/row roving model. */
  /** Column keys already reported by `renderCellValue()`, so a 400-row table logs once, not 400
   *  times, for the same authoring mistake. */
  private readonly reportedMissingCellColumns = new Set<string>();

  /**
   * Renders one cell, tolerating a column that omits its required `cell` renderer.
   *
   * `TableColumn.cell` is typed and documented required, but columns arrive through a lit
   * `.columns=${[...]}` property binding, and lit-html property bindings are not type-checked by
   * `tsc` -- only by lit-analyzer, which many projects do not run. So required-ness is unenforced
   * where it is actually written. Calling it unguarded meant a single malformed column threw out of
   * lit's `repeat` directive and took the WHOLE table down, with a stack carrying only lyra and
   * lit-html frames: no application frame, no column key, no table identity. One report described
   * carrying it undiagnosed across two releases as 16 unattributed unhandled rejections, while the
   * suite still passed because its assertions were on surrounding markup.
   *
   * So: degrade to an empty cell -- the rest of the table stays usable -- and report once per
   * column, naming the key and the tag, because attribution was the harder half of that bug.
   */
  private renderCellValue(col: TableColumn<T>, row: T): unknown {
    if (typeof col.cell === 'function') return col.cell(row);
    const key = String(col.key ?? '(unkeyed)');
    if (!this.reportedMissingCellColumns.has(key)) {
      this.reportedMissingCellColumns.add(key);
      console.error(
        `<lr-table>: column ${JSON.stringify(key)} has no \`cell\` renderer, so its cells `
          + 'render empty. `cell` is required, but a lit `.columns=${...}` binding is not '
          + 'type-checked, so this cannot be caught by tsc alone.',
      );
    }
    return nothing;
  }

  private renderCellEditor(row: T, col: TableColumn<T>, rowKey: string, alwaysOn: boolean): TemplateResult {
    const type = col.editType ?? 'text';
    const isText = type === 'text';
    const value = this.editorValue(row, col);
    const label = this.localize('tableEditCell', undefined, { column: col.label });
    const spellcheck = isText ? this.spellcheck : nothing;
    const autocapitalize = isText ? this.autocapitalize || nothing : nothing;
    const autocorrect = isText ? this.autoCorrect || nothing : nothing;
    const onChange = (event: Event): void => this.commitEdit(event, rowKey, col.key);
    const onKeyDown = (event: KeyboardEvent): void => this.onEditorKeyDown(event, rowKey, col.key);
    return alwaysOn
      ? html`<input
          part="cell-editor"
          type=${type}
          value=${value}
          aria-label=${label}
          spellcheck=${spellcheck}
          autocapitalize=${autocapitalize}
          autocorrect=${autocorrect}
          @input=${this.stopOwnedEvent}
          @change=${onChange}
          @focus=${this.onNativeFocus}
          @blur=${this.onNativeBlur}
          @keydown=${onKeyDown}
        />`
      : html`<input
          part="cell-editor"
          type=${type}
          .value=${value}
          aria-label=${label}
          spellcheck=${spellcheck}
          autocapitalize=${autocapitalize}
          autocorrect=${autocorrect}
          @input=${this.stopOwnedEvent}
          @change=${onChange}
          @focus=${this.onNativeFocus}
          @blur=${this.onNativeBlur}
          @keydown=${onKeyDown}
        />`;
  }

  /** One rectangular placeholder, using `<lr-skeleton>`'s canonical `shape` axis. `announce` is
   *  switched off on every one of them: `<lr-skeleton>` defaults it
   *  to `true`, which would make each of the N x M cells its own `role="status"` live region and
   *  turn a single "Loading rows" announcement into a storm of them. The table's shared light-DOM
   *  announcement sink carries the post-mount state transition for the whole grid instead.
   *  A property binding (not `?announce=`) is required to assign `false` to a `true`-defaulting
   *  boolean property. */
  private renderSkeletonPlaceholder(): TemplateResult {
    return html`<lr-skeleton part="skeleton" shape="rect" effect="sheen" .announce=${false}></lr-skeleton>`;
  }

  /** `loadingAppearance="skeleton"`'s body rows. Deliberately built from the same per-column
   *  attributes (`data-col-key`/`data-align`/`data-priority`/`data-sticky`) and the same
   *  `cell`/`row` parts as a real row, so the `@container` priority-hide rules, the sticky-offset
   *  measurement pass and every cell style apply to them unchanged -- that, plus rendering inside
   *  the real `<colgroup>`/`<thead>`, is what keeps the grid's geometry stable across the load.
   *  They carry no `data-row-key` and no `tabindex`: they are not data rows, so the delegated
   *  click/keydown handlers and the roving tab stop ignore them. */
  private renderSkeletonRows(hasExpand: boolean, hasRowTotal: boolean): TemplateResult[] {
    return Array.from(
      { length: this.effectiveSkeletonRows },
      () => html`<tr part="row" role="row" data-skeleton-row>
        ${hasExpand ? html`<td part="expand-toggle-cell"></td>` : nothing}
        ${this.columns.map(
          (col) => html`<td
            part="cell"
            role="gridcell"
            data-col-key=${col.key}
            data-align=${col.align ?? 'start'}
            data-priority=${col.priority ?? nothing}
            data-sticky=${stickyDirection(col.sticky) ?? nothing}
          >
            ${this.renderSkeletonPlaceholder()}
          </td>`
        )}
        ${hasRowTotal ? html`<td part="row-total-cell">${this.renderSkeletonPlaceholder()}</td>` : nothing}
      </tr>`
    );
  }

  override render(): TemplateResult {
    // A skeleton needs a schema to sketch. Until columns arrive, both loading appearances use the
    // spinner rather than misreporting the unresolved schema as a configuration error.
    const skeletonLoading = this.loading && this.loadingAppearance === 'skeleton' && this.columns.length > 0;
    if (this.loading && !skeletonLoading) {
      return html`<div part="base" aria-busy="true">
        <div part="loading" aria-hidden="true">
          <lr-spinner label-placement="after" aria-label=${this.loadingText()}>
            ${this.loadingText()}
          </lr-spinner>
        </div>
      </div>`;
    }
    if (this.columns.length === 0) {
      // Deliberately not wrapped in the `empty` slot: this branch reports a *configuration*
      // problem, with its own `noColumnsHeading` copy, rather than "this data set is empty" --
      // one slot covering both would silently replace it with a no-results message.
      return html`<lr-empty
        part="empty"
        exportparts="base:empty-base, icon:empty-icon, heading:empty-heading, description:empty-description, actions:empty-actions"
        ?compact=${this.emptyCompact ?? false}
        heading=${this.localizedOverride('noColumns', this.noColumnsHeading)}
        description=${this.noColumnsDescription}
      ></lr-empty>`;
    }
    // Skeleton mode deliberately falls through to the full grid render below instead of returning
    // its own shell here: its whole point is that the <colgroup>/<thead>/filter/pagination chrome
    // stays put, which is only achievable by rendering the real table.
    const hasHostAriaLabel = this.hasAttribute('aria-label');
    const gridAriaLabel =
      this.accessibleLabel == null
        ? (hasHostAriaLabel ? this.getAttribute('aria-label')! : nothing)
        : this.accessibleLabel;

    // Sorted, not merely filtered: `footer`/`grandTotal` are documented as seeing every rendered
    // row "post-sort, pre-pagination", and an aggregate that reads position (a first/last value, a
    // running comparison) would otherwise disagree with the order actually painted below. Free
    // when no sort is active -- `sortedEntries()` returns the filtered array by identity.
    const matchingEntries = this.sortedEntries();
    // A cold load is exactly the case where `rows` is still empty, so skeleton mode must not take
    // either empty-state branch -- "no data" is a *result*, and the load has not produced one yet.
    if (!skeletonLoading && this.canonicalRowEntries().length === 0 && !this.filterable) {
      return html`<slot name="empty"
        ><lr-empty
          part="empty"
          exportparts="base:empty-base, icon:empty-icon, heading:empty-heading, description:empty-description, actions:empty-actions"
          ?compact=${this.emptyCompact ?? false}
          heading=${this.localizedOverride('noData', this.emptyHeading)}
          description=${this.emptyDescription}
        ></lr-empty
      ></slot>`;
    }

    const focusedCol = this.focusedColKey();
    const focusedRow = this.focusedRowKey();
    const hasColumnWidths = this.columns.some((col) => col.width || this.resizedColumnWidths.has(col.key));
    // `layout` is a floor, never an override: a declared/resized column width still forces the
    // fixed algorithm, and so does an in-flight drag (`resizeState` is deliberately non-reactive,
    // but a *consumer*-triggered re-render mid-gesture -- before the first effective pointermove
    // has populated `resizedColumnWidths` -- would otherwise flip the table back to `auto` and
    // break the gesture, since resizing does not work under `table-layout: auto`).
    // Kept separate from `data-has-column-widths`, which additionally signals that `<colgroup>`
    // carries real widths.
    const effectiveLayout =
      this.layout === 'fixed' || hasColumnWidths || this.resizeState !== undefined ? 'fixed' : 'auto';
    const hasExpand = Boolean(this.expandedContent);
    const hasHeatTint = this.columns.some((col) => col.heatValue !== undefined);
    const heatDomain = this.computeHeatDomain(hasHeatTint);
    const hasRowTotal = Boolean(this.rowTotal);
    // Computed once and reused at both full-width call sites below (the group-header row and the
    // expanded-row panel) rather than hand-duplicated -- a future new leading/trailing structural
    // column (the same way hasExpand/hasRowTotal were each added) only has to be added here once.
    const spanningColspan = this.columns.length + (hasExpand ? 1 : 0) + (hasRowTotal ? 1 : 0);
    const renderedEntries = this.renderedEntries();
    const renderedGroupKeys = this.groupBy ? renderedEntries.map((entry) => this.groupBy!(entry.row)) : [];
    const renderedGroupRows = new Map<string | number, T[]>();
    if (this.groupLabel) {
      renderedEntries.forEach((entry, index) => {
        const groupKey = renderedGroupKeys[index];
        if (groupKey === undefined) return;
        const rows = renderedGroupRows.get(groupKey);
        if (rows) rows.push(entry.row);
        else renderedGroupRows.set(groupKey, [entry.row]);
      });
    }
    const hasPagination = skeletonLoading || this.pageCount > 1;
    const filterLabel = this.localizedOverride('tableFilterLabel', this.filterLabel);
    const filterPlaceholder = this.localizedOverride('tableFilterPlaceholder', this.filterPlaceholder);
    const tableContent =
      renderedEntries.length === 0 && !skeletonLoading
        ? html`<slot name="empty"
            ><lr-empty
              part="empty"
              exportparts="base:empty-base, icon:empty-icon, heading:empty-heading, description:empty-description, actions:empty-actions"
              ?compact=${this.emptyCompact ?? true}
              heading=${this.localizedOverride('noData', this.emptyHeading)}
              description=${this.emptyDescription}
            ></lr-empty
          ></slot>`
        : html`<table
            part="table"
            role="grid"
            aria-label=${gridAriaLabel}
            aria-labelledby=${this.accessibleLabel == null && !hasHostAriaLabel && this.caption
              ? this.captionId
              : nothing}
            aria-multiselectable=${String(this.selectionMode === 'multiple')}
            ?data-has-column-widths=${hasColumnWidths}
            data-layout=${effectiveLayout}
            @click=${this.onTableClick}
            @keydown=${this.onTableKeyDown}
            @dblclick=${this.onTableDoubleClick}
            @focusin=${this.onTableFocusIn}
          >
            ${this.caption ? html`<caption part="caption" id=${this.captionId}>${this.caption}</caption>` : nothing}
            <colgroup>
              ${hasExpand ? html`<col style=${styleMap({ 'inline-size': 'var(--lr-icon-button-size)' })} />` : nothing}
              ${this.columns.map(
                (col) =>
                  html`<col
                    style=${styleMap({
                      // Consumer-supplied CSS lengths: styleMap emits a joined declaration string on
                      // its first commit, so an unsanitized value would inject extra declarations.
                      'inline-size': this.renderedColumnWidth(col),
                      'min-inline-size': sanitizeCssLength(col.minWidth, 'height'),
                      'max-inline-size': sanitizeCssLength(col.maxWidth, 'height'),
                    })}
                  />`
              )}
              ${hasRowTotal ? html`<col />` : nothing}
            </colgroup>
            <thead part="head">
              <tr role="row">
                ${hasExpand ? html`<th part="header-cell" data-row-expand-toggle aria-hidden="true"></th>` : nothing}
                ${this.columns.map((col) => {
                  const active = Boolean(col.sortable) && this.sortKey === col.key;
                  const ariaSort = active ? (this.sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
                  return html`<th
                    part="header-cell"
                    role="columnheader"
                    scope="col"
                    data-col-key=${col.key}
                    data-align=${col.align ?? 'start'}
                    data-priority=${col.priority ?? nothing}
                    data-sticky=${stickyDirection(col.sticky) ?? nothing}
                    data-resizable=${col.resizable ? '' : nothing}
                    ?data-sortable=${col.sortable}
                    aria-sort=${col.sortable ? ariaSort : nothing}
                    tabindex=${col.key === focusedCol ? '0' : '-1'}
                  >
                    ${col.headerCell ? col.headerCell(col) : col.label} ${this.renderResizeHandle(col)}
                    ${active
                      ? html`<span part="sort-icon" data-dir=${this.sortDir} aria-hidden="true">${chevronIcon()}</span>`
                      : nothing}
                  </th>`;
                })}
                ${hasRowTotal ? html`<th part="header-cell" data-row-total aria-hidden="true"></th>` : nothing}
              </tr>
            </thead>
            <tbody>
              ${skeletonLoading
                ? this.renderSkeletonRows(hasExpand, hasRowTotal)
                : repeat(
                    renderedEntries,
                    (entry) => entry.key,
                    (entry, entryIndex) => {
                      const { row, key } = entry;
                      const selected = this._selectedKeys.has(key);
                      const canExpandRow = hasExpand && (this.canExpand ? this.canExpand(row) : true);
                      const rowExpanded = canExpandRow && this._expandedKeys.has(key);
                      const groupKey = renderedGroupKeys[entryIndex];
                      const previousGroupKey = entryIndex > 0 ? renderedGroupKeys[entryIndex - 1] : undefined;
                      const isNewGroup =
                        this.groupBy !== undefined && (entryIndex === 0 || groupKey !== previousGroupKey);
                      return [
                        isNewGroup
                          ? html`<tr part="group-row" role="row">
                              <td part="group-cell" role="gridcell" colspan=${spanningColspan}>
                                ${this.groupLabel
                                  ? this.groupLabel(groupKey!, renderedGroupRows.get(groupKey!) ?? [])
                                  : String(groupKey)}
                              </td>
                            </tr>`
                          : nothing,
                        html`<tr
                          part="row"
                          role="row"
                          data-row-key=${encodeKey(key)}
                          ?data-stripe=${entryIndex % 2 === 0}
                          aria-selected=${this.selectionMode === 'none' ? nothing : selected ? 'true' : 'false'}
                          tabindex=${encodeKey(key) === focusedRow ? '0' : '-1'}
                        >
                          ${hasExpand
                            ? html`<td part="expand-toggle-cell">
                                ${canExpandRow
                                  ? html`<button
                                      type="button"
                                      part="row-expand-toggle"
                                      aria-expanded=${String(rowExpanded)}
                                      aria-label=${this.localize(rowExpanded ? 'collapse' : 'expand')}
                                      @click=${() => this.activateExpandToggle(key)}
                                    >
                                      <span part="row-expand-icon" aria-hidden="true">${chevronIcon()}</span>
                                    </button>`
                                  : nothing}
                              </td>`
                            : nothing}
                          ${this.columns.map((col) => {
                            const heatShare = this.heatShare(col, row, heatDomain);
                            const cellStyle = {
                              ...sanitizeCellStyle(col.cellStyle ? col.cellStyle(row) ?? {} : undefined),
                              ...(heatShare !== null ? { '--lr-table-heat-t': heatShare } : {}),
                            };
                            // An `'always'` column renders its editor unconditionally, from first
                            // paint and with no interaction; `editingCell` (a single nullable object,
                            // one open editor at a time) only ever drives the double-click flavor.
                            const alwaysOn = normalizedEditTrigger(col.editTrigger) === 'always';
                            const editing =
                              alwaysOn ||
                              (normalizedEditTrigger(col.editTrigger) === 'double-click' &&
                                this.editingCell?.rowKey === encodeKey(key) &&
                                this.editingCell.columnKey === col.key);
                            // `|| nothing`, not `?? nothing`: an empty `title=""` is not "no tooltip",
                            // it actively suppresses an ancestor's tooltip, so an empty return omits
                            // the attribute the same way `undefined` does (mirroring `lr-stat`'s
                            // `exactValue`). Suppressed while editing so the tooltip can't shadow the
                            // open `[part='cell-editor']`.
                            const cellTitle = editing ? undefined : col.cellTitle?.(row);
                            return html`<td
                              part="cell"
                              role="gridcell"
                              data-col-key=${col.key}
                              data-align=${col.align ?? 'start'}
                              data-priority=${col.priority ?? nothing}
                              data-sticky=${stickyDirection(col.sticky) ?? nothing}
                              ?data-heat=${heatShare !== null}
                              title=${cellTitle || nothing}
                              style=${Object.keys(cellStyle).length ? styleMap(cellStyle) : nothing}
                            >
                              ${editing ? this.renderCellEditor(row, col, encodeKey(key), alwaysOn) : this.renderCellValue(col, row)}
                            </td>`;
                          })}
                          ${hasRowTotal ? html`<td part="row-total-cell">${this.rowTotal?.(row)}</td>` : nothing}
                        </tr>`,
                        rowExpanded
                          ? html`<tr part="expanded-row" role="row">
                              <td part="expanded-cell" role="gridcell" colspan=${spanningColspan}>
                                ${this.expandedContent?.(row)}
                              </td>
                            </tr>`
                          : nothing,
                      ];
                    }
                  )}
            </tbody>
            ${this.columns.some((c) => c.footer)
              ? html`<tfoot part="foot">
                  <tr part="footer-row">
                    ${hasExpand ? html`<td part="footer-cell" aria-hidden="true"></td>` : nothing}
                    ${this.columns.map(
                      (col) => html`<td part="footer-cell" data-col-key=${col.key} data-align=${col.align ?? 'start'}>
                        ${col.footer?.(matchingEntries.map((entry) => entry.row)) ?? ''}
                      </td>`
                    )}
                    ${hasRowTotal
                      ? html`<td part="footer-cell" data-align="end">
                          ${this.grandTotal?.(matchingEntries.map((entry) => entry.row)) ?? ''}
                        </td>`
                      : nothing}
                  </tr>
                </tfoot>`
              : nothing}
          </table>`;

    return html`
      <div part="base" ?data-force-visible=${this.priorityColumnsVisible} aria-busy=${skeletonLoading ? 'true' : 'false'}>
        ${skeletonLoading
          ? html`<div part="loading" class="sr-only" aria-hidden="true">${this.loadingText()}</div>`
          : nothing}
        ${this.filterable
          ? html`<label part="filter-label">
              ${filterLabel}
              <input
                part="filter"
                type="search"
                .value=${this.filterText}
                placeholder=${filterPlaceholder}
                aria-label=${filterLabel}
                spellcheck=${this.spellcheck}
                autocapitalize=${this.autocapitalize || nothing}
                autocorrect=${this.autoCorrect || nothing}
                @input=${this.onFilterInput}
                @change=${this.stopOwnedEvent}
                @focus=${this.onNativeFocus}
                @blur=${this.onNativeBlur}
              />
            </label>`
          : nothing}
        ${tableContent}
        ${this.priorityColumnsToggleAvailable
          ? html`<button
              part="reveal-columns-button"
              type="button"
              aria-pressed=${this.priorityColumnsVisible ? 'true' : 'false'}
              @click=${this.toggleColumns}
            >
              ${this.priorityColumnsVisible
                ? this.localizedOverride('showFewerColumns', this.hideColumnsLabel)
                : this.localizedOverride('showAllColumns', this.revealColumnsLabel)}
            </button>`
          : nothing}
        ${this.hasMore
          ? html`<button part="more-button" type="button" @click=${() => this.emit('lr-load-more')}>
              ${this.localizedOverride('loadMore', this.moreLabel)}
            </button>`
          : nothing}
        ${hasPagination
          ? html`<lr-pagination
              part="pagination"
              format="compact"
              .page=${this.page}
              .pageSize=${this.normalizedPageSize}
              .total=${this.matchingTotalItems}
              .strings=${this.strings}
              @lr-page-change=${this.onPaginationChange}
            ></lr-pagination>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-table': LyraTable;
  }
}
