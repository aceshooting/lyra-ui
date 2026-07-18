import {
  html,
  nothing,
  type TemplateResult,
  type PropertyValues,
  type ComplexAttributeConverter,
} from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { isRtl } from '../../internal/rtl.js';
import { finiteCount, finiteInteger } from '../../internal/numbers.js';
import { styles } from './table.styles.js';
import { chevronIcon } from '../../internal/icons.js';
import { minMax } from '../heatmap/heatmap-scale.js';
import '../empty/empty.class.js';
import '../pagination/pagination.js';
import '../spinner/spinner.js';

/**
 * String-aware boolean attribute converter for `spellcheck`. Lit's built-in `type: Boolean`
 * converter is presence-based -- the attribute's mere presence (regardless of its string value)
 * maps to `true`, so a plain-markup consumer writing the literal `spellcheck="false"` would
 * actually get `true` (this property's default), the opposite of what that string reads as -- the
 * same bug class `<lyra-textarea>`'s `spellcheckConverter` and `<lyra-model-select>`'s identical
 * converter document and fix.
 */
const spellcheckConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    // `true` is this property's default, so there's nothing worth reflecting for it; only the
    // non-default `false` needs an attribute at all.
    return value ? null : 'false';
  },
};

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
  /** Enables pointer-driven resizing from this column's header. The table keeps the live width
   *  internally and emits `lyra-column-resize` on every drag step. */
  resizable?: boolean;
  sortable?: boolean;
  align?: 'start' | 'end';
  /** Responsive priority — `undefined` (the default) means "always visible".
   *  `'low'` columns hide first (narrowest container), `'medium'` next, as
   *  `[part='base']`'s container-query width shrinks; both can be forced back
   *  on via `[part='reveal-columns-button']`. */
  priority?: 'medium' | 'low';
  /** Pins this column's header/cell to one edge with `position: sticky` so
   *  it stays visible while the table scrolls horizontally. `true` (legacy)
   *  and `'start'` both pin to the inline-start edge; `'end'` pins to the
   *  inline-end edge (e.g. a trailing actions column in a narrow viewport).
   *  Both directions use CSS logical properties, so RTL flips automatically. */
  sticky?: boolean | 'start' | 'end';
  /** Renders a sticky-bottom footer cell for this column, computed from every currently-rendered
   *  row (post-sort, pre-pagination) -- e.g. a column total. Omit for a column with no footer
   *  value; a `<tfoot>` renders at all only when at least one column defines this. */
  footer?(rows: T[]): unknown;
  /** Applied directly to the generated `<td>` via `styleMap` -- e.g. a computed heat-tint
   *  background that a `cell()`-returned inner element can't paint into the cell's own padding.
   *  Omit for no per-cell style override (the default; unchanged output). */
  cellStyle?(row: T): Record<string, string> | undefined;
  /** Numeric accessor backing the heat-tint background. A column that omits this is excluded from
   *  tinting (e.g. a label column) — its presence on any column is the opt-in signal for heat-tint
   *  mode as a whole, mirroring how `expandedContent` alone signals expand-mode (no separate
   *  boolean). Returns `null`/`undefined` for a cell with no value: excluded from both the domain
   *  computation and the tint (reads as "no data", not "zero"). */
  heatValue?(row: T): number | null | undefined;
  /** Enables double-click inline editing for this cell. The table emits the
   *  proposed value and never mutates `row`; apply the change in the consumer
   *  and pass the updated `rows` back in. */
  editable?: boolean;
  /** Reads the value shown in the inline editor. When omitted, `row[key]` is
   *  used for record-like rows. */
  editValue?: (row: T) => string | number;
  /** Native editor type used when `editable` is enabled. */
  editType?: 'text' | 'number';
  cell: (row: T) => unknown;
}

/** Interactive elements a nested `cell()` template may render (e.g. an
 *  actions-column button). Clicks/keydowns landing on one of these — or
 *  bubbling up through one — must not be re-interpreted as row/column
 *  activation by the table's own delegated listeners. */
const INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, summary, audio[controls], video[controls], [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"]), [role="button"], [role="checkbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="menuitem"], [role="option"], [role="radio"], [role="separator"], [role="slider"], [role="spinbutton"], [role="switch"], [role="tab"], [role="textbox"]';

/** Normalizes TableColumn.sticky's legacy boolean form (`true` == `'start'`,
 *  today's only supported direction) alongside the `'start'`/`'end'` union --
 *  `false`/`undefined` both resolve to "not sticky". */
function stickyDirection(sticky: boolean | 'start' | 'end' | undefined): 'start' | 'end' | undefined {
  if (sticky === true) return 'start';
  if (sticky === 'start' || sticky === 'end') return sticky;
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
    return JSON.stringify(row, (_key, value) => {
      if (typeof value === 'bigint') return value.toString();
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    }) ?? '';
  } catch {
    return '';
  }
}

/** Whether `target` (or an ancestor up to the delegated listener's own
 *  `<table>`, exclusive) is a custom element — i.e. any tag containing a
 *  hyphen, the one universal rule every custom element name must follow —
 *  which is never itself matched by INTERACTIVE_SELECTOR's plain-HTML
 *  selector list but should still own its own clicks/keydowns (e.g. a
 *  `<lyra-select>`/`<lyra-combobox>` rendered by a `cell()` template)
 *  instead of being re-interpreted as row/column activation. */
function closestInteractive(target: HTMLElement, boundary: HTMLElement): Element | null {
  let el: Element | null = target;
  while (el && el !== boundary) {
    if (
      (el.matches(INTERACTIVE_SELECTOR) && !el.matches('[data-row-key], th[data-col-key]')) ||
      el.tagName.includes('-')
    )
      return el;
    el = el.parentElement;
  }
  return null;
}

export interface LyraTableEventMap<T = unknown> {
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
  'lyra-columns-hidden-change': CustomEvent<{ hidden: boolean }>;
  'lyra-columns-revealed': CustomEvent<{ revealed: boolean }>;
  'lyra-sort': CustomEvent<{ key: string }>;
  'lyra-row-click': CustomEvent<{ row: T }>;
  'lyra-row-expand-toggle': CustomEvent<{ row: T; key: string | number }>;
  'lyra-load-more': CustomEvent<undefined>;
  'lyra-selection-change': CustomEvent<{ keys: Array<string | number> }>;
  'lyra-filter-change': CustomEvent<{ text: string }>;
  'lyra-page-change': CustomEvent<{ page: number }>;
  'lyra-cell-edit': CustomEvent<{ row: T; key: string; value: string | number }>;
  'lyra-column-resize': CustomEvent<{ key: string; width: number }>;
}
/**
 * `<lyra-table>` — a presentational, sort/select-aware data table.
 *
 * Header/row activation is delegated: one `click` and one `keydown`
 * listener on `<table>` resolve the target via `closest('[data-col-key]'
 * | '[data-row-key]')` and a key→object lookup map, instead of allocating
 * fresh per-column/per-row closures on every render. Both listeners guard
 * against nested interactive `cell()` content first (see
 * `INTERACTIVE_SELECTOR`) so a button/link/input inside a cell owns its own
 * activation instead of triggering `lyra-row-click`.
 *
 * Keyboard focus follows a roving-tabindex pattern (one `tabindex="0"` stop
 * among the header cells, one among the body rows — see `focusedColKey()` /
 * `focusedRowKey()`), matching this repo's other `role="grid"`/composite
 * widgets. Left/Right/Home/End move within the header row; Up/Down/Home/End
 * move within the body; Down from the header enters the body's roving stop,
 * and Up from the body's first row returns to the header's roving stop.
 * Enter/Space still only sort/activate (see `activateColumn()` /
 * `activateRow()`).
 *
 * Set `aria-label` on the host to give the `role="grid"` element an
 * accessible name; it's forwarded into the shadow DOM's `<table>`.
 *
 * `columns[].priority` ('medium' | 'low') hides that column under
 * `[part='base']`'s `@container` breakpoints; `[part='reveal-columns-button']`
 * forces them all back into view. Rather than a *static* check of whether any
 * column merely declares a `priority`, the button (and the public
 * `columnsHidden` property, see below) reflects whether a `priority` column
 * is *actually* hidden right now — measured via `ResizeObserver` on
 * `[part='base']` plus a post-render DOM check — or the public `showAllColumns`
 * force-visible mode is currently active (so there's still a way to toggle
 * it back off). `showAllColumns` defaults to `false` and toggles itself on
 * `[part='reveal-columns-button']` activation with no external wiring
 * required, but is also settable up front (property or the reflected
 * `show-all-columns` attribute) to restore a previously-persisted
 * preference, and readable back — directly or via the `lyra-columns-revealed`
 * event — to persist the current one. `columns[].sticky` pins a column's
 * header/cells to the inline-start (default/`true`) or inline-end (`'end'`)
 * edge while the table scrolls horizontally.
 *
 * `expandedContent` (a table-level `(row: T) => unknown`, not a per-column
 * hook, since the resulting panel spans every column via `colspan`) makes
 * every row render a leading chevron-toggle cell before its data columns.
 * `canExpand` optionally gates which rows actually get an interactive
 * toggle — a row that fails it still gets a blank leading cell for column
 * alignment. Which rows are currently open is fully consumer-owned via
 * `expandedKeys` (a `Set<string | number>` of row keys, per `rowKey`/
 * `keyOf()`) — the table only reads it and emits `lyra-row-expand-toggle`
 * on activation, mirroring `sortKey`/`selectedKey`'s existing
 * presentational-only convention.
 *
 * Selection is opt-in through the `selectionMode` property. Use `single` or
 * `multiple` to self-manage row selection; the default `none` remains
 * presentational. `selectedKeys` contains the raw keys selected in multiple
 * mode.
 *
 * `filterable` adds a compact search field above the grid. `filterText` is
 * controlled and emits `lyra-filter-change`; `filter` can provide a typed
 * predicate, otherwise the row is matched against its JSON representation.
 * `pageSize` enables controlled pagination through the existing
 * `<lyra-pagination>` primitive. Client mode slices `rows`; server mode
 * renders the supplied page unchanged while using `totalItems` for the
 * navigation summary. `loading` keeps the table shell busy and renders an
 * indeterminate spinner.
 * Columns with `editable: true` open a native text/number editor on
 * double-click and emit `lyra-cell-edit`; row mutation remains consumer-owned.
 * `spellcheck`/`autocapitalize`/`autoCorrect` forward to the filter input and, for a `'text'`
 * (the default) `editType`, the inline cell editor -- no effect on a `'number'` cell editor.
 * `groupBy` inserts non-focusable group header rows before each group; use
 * `groupLabel` when the raw group key needs custom content.
 *
 * `columns[].heatValue` opts a column into heat-tint mode: its numeric return value is normalized
 * against a shared scale spanning every `heatValue`-defining column across every currently-rendered
 * row (auto-derived, or overridden via `heatTintScale`) and painted as a `color-mix()` background via
 * the retheme-able `--lyra-table-heat-tint-lo`/`-hi` custom properties (matching `lyra-heatmap`'s own
 * ramp-token convention). `rowTotal`/`grandTotal` add a trailing column mirroring `expandedContent`'s
 * leading one: `rowTotal(row)` renders per-row, `grandTotal(rows)` renders at its intersection with
 * the footer row (only when a column also defines `footer`) — both share `footer`'s own
 * "consumer computes/renders" contract rather than assuming addition.
 *
 * @customElement lyra-table
 * @event lyra-sort - A sortable header was activated. `detail: { key }`.
 * @event lyra-row-click - A row was activated. `detail: { row }`.
 * @event lyra-load-more - The "load more" control was activated.
 * @event lyra-columns-hidden-change - `columnsHidden` actually changed value
 *   (a `priority` column just became hidden/un-hidden by the `@container`
 *   rules, or `showAllColumns` force-visible mode was toggled while a
 *   `priority` column was hidden). `detail: { hidden: boolean }`.
 * @event lyra-columns-revealed - `showAllColumns` was toggled by
 *   `[part='reveal-columns-button']`. `detail: { revealed: boolean }`.
 * @event lyra-row-expand-toggle - The row-expand chevron was activated.
 *   `detail: { row, key }`. Fired only when `expandedContent` is set and
 *   the row passes `canExpand`; does not itself mutate `expandedKeys` — the
 *   consumer updates it and passes the new value back in.
 * @event lyra-selection-change - Opt-in row selection changed. `detail: { keys }`.
 * @event lyra-filter-change - The filter field changed. `detail: { text }`.
 * @event lyra-page-change - A pagination control requested a page. `detail: { page }`.
 * @event lyra-cell-edit - An inline editor committed a value. `detail: { row, key, value }`.
 * @event lyra-column-resize - A resizable column changed width during a pointer drag. `detail:
 *   { key, width }`, where `width` is in CSS pixels.
 * @event focus - Re-dispatched from the internal filter/cell-editor native inputs' own `focus` —
 *   bubbling and composed (unlike the native event, which is neither).
 * @event blur - Re-dispatched from the internal filter/cell-editor native inputs' own `blur`, for
 *   the same reason as `focus`.
 * @csspart base - The root wrapper around the `<table>` and its footer controls.
 * @csspart table - The `<table role="grid">` element.
 * @csspart head - The `<thead>` element.
 * @csspart header-cell - Each `<th>` header cell.
 * @csspart resize-handle - The pointer resize handle in a `resizable` column header.
 * @csspart row - Each body `<tr>`.
 * @csspart cell - Each body `<td>`.
 * @csspart row-total-cell - Each body row's trailing `<td>` holding `rowTotal(row)`, rendered only
 *   when `rowTotal` is set. The corresponding footer-row cell (holding `grandTotal`) is a
 *   `footer-cell` instead, matching every other footer cell.
 * @csspart foot - The `<tfoot>`, only rendered when at least one column defines `footer`.
 * @csspart footer-row - The single footer row.
 * @csspart footer-cell - A single footer cell.
 * @csspart cell-editor - The native inline cell editor, shown after a double-click on an editable cell.
 * @csspart more-button - The "load more" control, shown when `hasMore` is true.
 * @csspart sort-icon - The chevron shown in the active sortable column's header cell.
 * @csspart reveal-columns-button - The button that toggles `priority`-hidden columns back into view.
 * @csspart expand-toggle-cell - Each row's (and the header's) leading
 *   chevron-toggle cell, rendered only when `expandedContent` is set.
 * @csspart row-expand-toggle - The `<button>` inside `expand-toggle-cell`,
 *   absent for a row that fails `canExpand`.
 * @csspart row-expand-icon - The chevron icon inside `row-expand-toggle`.
 * @csspart expanded-row - The full-width panel `<tr>` rendered beneath a
 *   row whose key is in `expandedKeys`.
 * @csspart expanded-cell - The single `colspan`-spanning `<td>` inside
 *   `expanded-row`, containing `expandedContent(row)`.
 * @csspart group-row - A non-focusable group header row.
 * @csspart group-cell - The full-width group header cell.
 * @csspart filter - The optional row-filter input.
 * @csspart filter-label - The `<label>` wrapping the filter input.
 * @csspart loading - The loading-state wrapper.
 * @csspart pagination - The optional pagination component.
 * @cssprop [--lyra-table-resize-min-width=var(--lyra-size-3rem)] - Default minimum width for a
 *   resizable column without an explicit pixel `minWidth`.
 * @cssprop [--lyra-table-resize-handle-opacity=0.12] - Hover/focus opacity of the resize handle.
 */
export class LyraTable<T = unknown> extends LyraElement<LyraTableEventMap<T>> {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) columns: TableColumn<T>[] = [];
  @property({ attribute: false }) rows: T[] = [];
  @property({ attribute: 'sort-key' }) sortKey = '';
  @property({ attribute: 'sort-dir' }) sortDir: 'asc' | 'desc' = 'asc';
  /** Derives each row's stable identity for `repeat()`'s DOM-reconciliation
   *  key and the delegated click/keydown row lookup (`rowsByKey`,
   *  `data-row-key`). When omitted, `keyOf()` falls back to the row's index
   *  in `rows`, which is only a safe identity while `rows` never reorders —
   *  provide `rowKey` whenever `rows` can be sorted, filtered, or otherwise
   *  re-ordered across renders, or row identity (selection, focus, click
   *  targets) can silently attach to the wrong row. */
  @property({ attribute: false }) rowKey?: (row: T) => string | number;
  @property({ attribute: false }) selectedKey: string | number | null = null;
  @property({ reflect: true, attribute: 'selection-mode' }) selectionMode: 'none' | 'single' | 'multiple' = 'none';
  @property({ attribute: false }) selectedKeys: Set<string | number> = new Set();
  @property({ type: Boolean, reflect: true }) filterable = false;
  @property({ attribute: 'filter-text' }) filterText = '';
  @property({ attribute: false }) filter?: (row: T, text: string) => boolean;
  @property({ attribute: 'filter-label' }) filterLabel = '';
  @property({ attribute: 'filter-placeholder' }) filterPlaceholder = '';
  /** Forwarded to the filter input's, and (when the active column's `editType` is `'text'`, the
   *  default) the inline cell-editor input's, native `spellcheck`. Defaults to `true`, matching
   *  the native element's own default. `spellcheck="false"` is parsed as `false` (see
   *  `spellcheckConverter` above). No effect on a `'number'` cell editor. */
  @property({ converter: spellcheckConverter }) spellcheck = true;
  /** Forwarded to the same inputs' native `autocapitalize`. Empty string omits the attribute
   *  (browser default). */
  @property() autocapitalize = '';
  /** Forwarded to the same inputs' native `autocorrect` (Safari/WebKit-specific). Empty string
   *  omits the attribute (browser default). Named `autoCorrect` (capital `C`), not `autocorrect`,
   *  to dodge a TS `lib.dom.d.ts` collision -- same fix as `<lyra-textarea>`/`<lyra-model-select>`. */
  @property({ attribute: 'autocorrect' }) autoCorrect = '';
  @property({ type: Boolean, reflect: true }) loading = false;
  @property({ attribute: 'loading-label' }) loadingLabel = '';
  @property({ attribute: false }) groupBy?: (row: T) => string | number;
  @property({ attribute: false }) groupLabel?: (key: string | number, rows: T[]) => unknown;
  /** Set to a positive value to enable the controlled pagination footer. */
  @property({ type: Number, attribute: 'page-size' }) pageSize = 0;
  /** Controlled current page used when `pageSize` is positive. */
  @property({ type: Number, reflect: true }) page = 1;
  /** Total item count for server pagination; `-1` derives it from filtered rows. */
  @property({ type: Number, attribute: 'total-items' }) totalItems = -1;
  @property({ reflect: true, attribute: 'pagination-mode' }) paginationMode: 'client' | 'server' = 'client';
  /** Renders a full-width panel beneath a row when that row's key is in
   *  `expandedKeys`. Table-level (not per-column) since the panel spans
   *  every column via `colspan`. Setting this makes every row render a
   *  leading chevron-toggle cell before all data columns; omit for no
   *  leading cell at all (unchanged output). */
  @property({ attribute: false }) expandedContent?: (row: T) => unknown;
  /** Gates whether a given row gets an interactive chevron/toggle at all,
   *  when `expandedContent` is set. Omit to make every row expandable. A
   *  row that fails this check still gets a leading cell (for column
   *  alignment) but it renders empty — no button, no `aria-expanded`, no
   *  click handler. */
  @property({ attribute: false }) canExpand?: (row: T) => boolean;
  /** Consumer-owned open/closed state, keyed the same way as `rowKey`/
   *  `selectedKey`. The table never mutates this itself — it only reads it
   *  to decide which rows currently render `expandedContent`; toggle it in
   *  response to `lyra-row-expand-toggle`, mirroring how `sortKey`/
   *  `selectedKey` already work. */
  @property({ attribute: false }) expandedKeys: Set<string | number> = new Set();
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
  @property({ attribute: false }) grandTotal?: (rows: T[]) => unknown;
  @property({ type: Boolean, attribute: 'has-more', reflect: true }) hasMore = false;
  @property({ attribute: 'more-label' }) moreLabel = '';
  @property({ attribute: 'empty-heading' }) emptyHeading = '';
  @property({ attribute: 'empty-description' }) emptyDescription = '';
  @property({ attribute: 'no-columns-heading' }) noColumnsHeading = '';
  @property({ attribute: 'no-columns-description' }) noColumnsDescription = '';
  @property({ attribute: 'reveal-columns-label' }) revealColumnsLabel = '';
  @property({ attribute: 'hide-columns-label' }) hideColumnsLabel = '';

  /** Whether a `priority` column is *actually* hidden right now by
   *  table.styles.ts's `@container` rules, or `showAllColumns` force-visible
   *  mode is currently active — the same computed value that gates whether
   *  `[part='reveal-columns-button']` renders at all (see `render()`), kept
   *  in sync by `recomputeColumnsHidden()`. Computed/read-only by
   *  convention: consumers may read it (and listen for
   *  `lyra-columns-hidden-change`), but setting it directly has no lasting
   *  effect, since it's recomputed on the very next render or
   *  `[part='base']` resize. */
  @property({ type: Boolean, attribute: 'columns-hidden', reflect: true }) columnsHidden = false;

  /** Forces `priority`-hidden columns back into view, overriding the
   *  `@container` hide rules in table.styles.ts. Toggles itself on
   *  `[part='reveal-columns-button']` activation by default — no external
   *  wiring is required for the button to work. Also settable from outside
   *  (property or the reflected `show-all-columns` attribute) to restore a
   *  previously-persisted preference, and readable back at any time — or via
   *  the `lyra-columns-revealed` event, fired whenever the button toggles it
   *  — to persist the current one. */
  @property({ type: Boolean, attribute: 'show-all-columns', reflect: true }) showAllColumns = false;

  /** Roving-tabindex position among header cells; `null` until a header is
   *  clicked/navigated to, at which point `focusedColKey()` falls back to
   *  the first column. */
  @state() private activeColKey: string | null = null;
  /** Roving-tabindex position among body rows; `null` until a row is
   *  clicked/navigated to, at which point `focusedRowKey()` falls back to
   *  `selectedKey` (if it matches a row) or the first row. */
  @state() private activeRowKey: string | null = null;
  @state() private editingCell: { rowKey: string; columnKey: string } | null = null;
  @state() private resizedColumnWidths = new Map<string, number>();

  private resizeState?: {
    key: string;
    pointerId: number;
    startX: number;
    startWidth: number;
    minWidth: number;
    handle: HTMLElement;
  };

  private rowsByKey = new Map<string, { row: T; index: number }>();
  private columnsByKey = new Map<string, TableColumn<T>>();

  /** Watches `[part='base']`'s own inline-size — the `@container` query
   *  container table.styles.ts's priority-hide rules react to — so a
   *  `priority` column flipping hidden/visible from an *external* width
   *  change (a window resize, an ancestor flex-layout reflow, ...) is caught
   *  even though no Lit-tracked property changed. Mirrors
   *  lite-chart.ts's connectedCallback()/disconnectedCallback() ResizeObserver
   *  lifecycle. */
  private resizeObserver?: ResizeObserver;
  /** The `[part='base']` element `resizeObserver` is currently observing —
   *  `render()`'s columns/rows-empty branches swap in `<lyra-empty>` instead,
   *  a different template shape that gives `[part='base']` a fresh DOM
   *  identity on the next non-empty render, so `updated()` re-observes
   *  whenever this no longer matches the live element. */
  private observedBase?: Element;
  private readonly observedHeaders = new Set<Element>();

  private parsePixelLength(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed.endsWith('px')) return undefined;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private minimumResizeWidth(column: TableColumn<T>): number {
    const explicit = this.parsePixelLength(column.minWidth);
    if (explicit !== undefined) return Math.max(0, explicit);
    const themed = Number.parseFloat(
      getComputedStyle(this).getPropertyValue('--lyra-table-resize-min-width'),
    );
    return Number.isFinite(themed) ? Math.max(0, themed) : 48;
  }

  private renderedColumnWidth(column: TableColumn<T>): string | undefined {
    const resized = this.resizedColumnWidths.get(column.key);
    return resized === undefined ? column.width : `${resized}px`;
  }

  private onResizePointerDown = (event: PointerEvent): void => {
    const handle = event.currentTarget as HTMLElement;
    const key = handle.dataset.colKey;
    const column = key ? this.columnsByKey.get(key) : undefined;
    const header = handle.closest('th[data-col-key]') as HTMLElement | null;
    if (!key || !column || !header) return;
    this.resizeState = {
      key,
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: header.getBoundingClientRect().width,
      minWidth: this.minimumResizeWidth(column),
      handle,
    };
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', this.onResizePointerMove);
    window.addEventListener('pointerup', this.onResizePointerEnd);
    window.addEventListener('pointercancel', this.onResizePointerEnd);
  };

  private onResizePointerMove = (event: PointerEvent): void => {
    const state = this.resizeState;
    if (!state || event.pointerId !== state.pointerId) return;
    const delta = isRtl(this) ? state.startX - event.clientX : event.clientX - state.startX;
    const width = Math.max(state.minWidth, state.startWidth + delta);
    if (this.resizedColumnWidths.get(state.key) === width) return;
    this.resizedColumnWidths = new Map(this.resizedColumnWidths).set(state.key, width);
    this.emit('lyra-column-resize', { key: state.key, width });
  };

  private onResizePointerEnd = (event: PointerEvent): void => {
    if (!this.resizeState || event.pointerId !== this.resizeState.pointerId) return;
    this.resizeState.handle.releasePointerCapture?.(event.pointerId);
    this.resizeState = undefined;
    window.removeEventListener('pointermove', this.onResizePointerMove);
    window.removeEventListener('pointerup', this.onResizePointerEnd);
    window.removeEventListener('pointercancel', this.onResizePointerEnd);
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(() => {
      this.recomputeColumnsHidden();
      this.applyStickyOffsets();
    });
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
      this.observeHeaders();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('pointermove', this.onResizePointerMove);
    window.removeEventListener('pointerup', this.onResizePointerEnd);
    window.removeEventListener('pointercancel', this.onResizePointerEnd);
    this.resizeState = undefined;
    this.resizeObserver?.disconnect();
    this.observedBase = undefined;
    this.observedHeaders.clear();
  }

  private observeBase(base: Element): void {
    if (this.observedBase === base) return;
    if (this.observedBase) this.resizeObserver?.unobserve(this.observedBase);
    this.resizeObserver?.observe(base);
    this.observedBase = base;
  }

  private observeHeaders(): void {
    const headers = new Set<Element>(
      this.columns.some((column) => column.sticky)
        ? this.renderRoot.querySelectorAll<HTMLElement>('th[data-col-key]')
        : [],
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

  /** Recomputes `columnsHidden` from the live DOM (mirrors `visibleHeaders()`'s
   *  own `offsetParent !== null` technique for detecting `@container`-hidden
   *  cells) and dispatches `lyra-columns-hidden-change` only on a real
   *  transition. Called from `updated()` (covers a change driven by
   *  `columns`/`rows`/`showAllColumns` rather than a container resize) and
   *  from the `ResizeObserver` callback (covers a container resize with no
   *  Lit-tracked property change at all). */
  private recomputeColumnsHidden(): void {
    const hasPriorityColumns = this.columns.some((col) => col.priority);
    const anyPriorityHidden =
      hasPriorityColumns &&
      [...this.renderRoot.querySelectorAll<HTMLElement>('th[data-priority]')].some(
        (el) => el.offsetParent === null,
      );
    const next = anyPriorityHidden || (hasPriorityColumns && this.showAllColumns);
    this.rehomeFocusedColumn();
    if (this.columnsHidden === next) return;
    this.columnsHidden = next;
    this.emit('lyra-columns-hidden-change', { hidden: next });
  }

  private rehomeFocusedColumn(): void {
    const visible = this.visibleHeaders();
    if (visible.length === 0 || this.activeColKey === null) return;
    if (!visible.some((header) => header.dataset.colKey === this.activeColKey)) {
      this.activeColKey = visible[0].dataset.colKey ?? null;
    }
  }

  private keyOf(row: T, index: number): string | number {
    return this.rowKey ? this.rowKey(row) : index;
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
  private cachedMatchingEntries: Array<{ row: T; index: number }> | null = null;
  private matchingEntriesInputs: {
    rows: T[];
    filter: ((row: T, text: string) => boolean) | undefined;
    text: string;
    locale: string;
  } | null = null;
  private matchingEntries(): Array<{ row: T; index: number }> {
    const text = this.filterText.trim();
    // The locale only affects case-folding, which only happens when there is
    // filter text — skipping the read here keeps a locale change from
    // invalidating an unfiltered cache.
    const locale = text === '' ? '' : this.effectiveLocale;
    const inputs = this.matchingEntriesInputs;
    if (
      this.cachedMatchingEntries !== null &&
      inputs !== null &&
      inputs.rows === this.rows &&
      inputs.filter === this.filter &&
      inputs.text === text &&
      inputs.locale === locale
    ) {
      return this.cachedMatchingEntries;
    }
    let entries: Array<{ row: T; index: number }>;
    if (text === '') {
      entries = this.rows.map((row, index) => ({ row, index }));
    } else {
      const normalized = text.toLocaleLowerCase(locale);
      entries = this.rows.flatMap((row, index) => {
        const matches = this.filter
          ? this.filter(row, text)
          : safeStringifyForFilter(row).toLocaleLowerCase(locale).includes(normalized);
        return matches ? [{ row, index }] : [];
      });
    }
    this.matchingEntriesInputs = { rows: this.rows, filter: this.filter, text, locale };
    this.cachedMatchingEntries = entries;
    return entries;
  }

  /** Read-time-safe view of `pageSize` -- non-negative, finite, truncated to a whole item count.
   *  Mirrors `<lyra-pagination>`'s own identically-named getter (this component composes that
   *  primitive for the actual pagination UI in `render()`, but slices `rows` itself for client-mode
   *  pagination, so it needs the same safe count independently). */
  private get normalizedPageSize(): number {
    return finiteCount(this.pageSize);
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

  /** Read-time-safe view of the controlled `page` property, clamped to `[1, pageCount]` -- mirrors
   *  `<lyra-pagination>`'s own `currentPage` getter and, like `<lyra-av-player>`'s `currentTime`
   *  setter, clamps against a dynamic, just-computed upper bound rather than a fixed one. */
  private get appliedPage(): number {
    if (this.pageCount === 0) return 1;
    return finiteInteger(this.page, 1, 1, this.pageCount);
  }

  private renderedEntries(): Array<{ row: T; index: number }> {
    const entries = this.matchingEntries();
    if (this.normalizedPageSize === 0 || this.paginationMode === 'server') return entries;
    const start = (this.appliedPage - 1) * this.normalizedPageSize;
    return entries.slice(start, start + this.normalizedPageSize);
  }

  private onFilterInput = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement;
    this.filterText = input.value;
    this.emit('lyra-filter-change', { text: this.filterText });
  };
  private onNativeFocus = (): void => { this.emit('focus'); };
  private onNativeBlur = (): void => { this.emit('blur'); };

  private onPaginationChange = (event: Event): void => {
    event.stopPropagation();
    this.emit('lyra-page-change', (event as CustomEvent<{ page: number }>).detail);
  };

  /** The header cell that currently owns `tabindex="0"`. */
  private focusedColKey(): string | null {
    const visible = this.visibleHeaders();
    const visibleKeys = new Set(
      visible.map((el) => el.dataset.colKey).filter((key): key is string => key !== undefined && this.columnsByKey.has(key)),
    );
    if (this.activeColKey !== null && this.columnsByKey.has(this.activeColKey)) {
      if (visibleKeys.size === 0 || visibleKeys.has(this.activeColKey)) return this.activeColKey;
    }
    return visible.find((el) => el.dataset.colKey !== undefined && this.columnsByKey.has(el.dataset.colKey))?.dataset.colKey ?? this.columns[0]?.key ?? null;
  }

  /** The body row that currently owns `tabindex="0"`. */
  private focusedRowKey(): string | null {
    if (this.activeRowKey !== null && this.rowsByKey.has(this.activeRowKey)) {
      return this.activeRowKey;
    }
    if (this.selectedKey !== null) {
      const selected = encodeKey(this.selectedKey);
      if (this.rowsByKey.has(selected)) return selected;
    }
    const first = this.renderedEntries()[0];
    return first ? encodeKey(this.keyOf(first.row, first.index)) : null;
  }

  protected willUpdate(changed: PropertyValues): void {
    if (
      changed.has('rows') ||
      changed.has('rowKey') ||
      changed.has('filterText') ||
      changed.has('filter') ||
      changed.has('page') ||
      changed.has('pageSize') ||
      changed.has('paginationMode') ||
      changed.has('totalItems')
    ) {
      this.rowsByKey = new Map(
        this.renderedEntries().map((entry) => [
          encodeKey(this.keyOf(entry.row, entry.index)),
          entry,
        ]),
      );
    }
    if (changed.has('columns')) {
      this.columnsByKey = new Map(this.columns.map((c) => [c.key, c]));
    }
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
      const key = el.dataset.colKey;
      if (key !== undefined && !headerWidths.has(key)) headerWidths.set(key, el.offsetWidth);
    }
    const headerWidth = (key: string): number => headerWidths.get(key) ?? 0;
    // 'start' columns stack left-to-right in array order (unchanged from
    // today); 'end' columns stack right-to-left (reverse array order) so a
    // trailing sticky column sits flush against the edge and an earlier
    // 'end' column stacks inward from it -- the mirror image of 'start'.
    // Both directions share the same --lyra-table-sticky-offset custom
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
    const span = hi - lo || 1;
    const t = Math.min(1, Math.max(0, (v - lo) / span));
    return `${(t * 100).toFixed(2)}%`;
  }

  private applyStickyOffsets(): void {
    if (!this.columns.some((c) => c.sticky)) return;
    const offsets = this.stickyOffsets();
    this.renderRoot.querySelectorAll<HTMLElement>('[data-col-key]').forEach((el) => {
      const key = el.dataset.colKey;
      if (key !== undefined && offsets.has(key)) {
        el.style.setProperty('--lyra-table-sticky-offset', `${offsets.get(key)}px`);
      }
    });
  }

  /** Applies stickyOffsets()'s measured per-column offsets as an inline
   *  `--lyra-table-sticky-offset` custom property on every header cell and
   *  body cell in that column (addressed by the shared `data-col-key`
   *  attribute). This is a post-render DOM measurement — column widths
   *  aren't known until after the browser has laid out this update's
   *  render() output — so it runs from `updated()`, not `willUpdate()`,
   *  intentionally kept as a separate pass from the rowsByKey/columnsByKey
   *  rebuild above: those two must stay in `willUpdate()` so `render()`'s
   *  own `focusedRowKey()` call sees the current update's identity maps
   *  (e.g. a freshly-assigned `selectedKey` resolving to the correct
   *  roving-tabindex row on the very first paint), whereas the sticky-offset
   *  measurement can only run after that same paint has happened. Only runs
   *  when `hasSticky` is true (opt-in) and simply recomputes on every
   *  update; column widths are measured per update so the current layout
   *  reflects the rendered columns. */
  protected updated(changed: PropertyValues): void {
    if (changed.has('columns') || changed.has('rows') || changed.has('rowKey')) this.applyStickyOffsets();
    // Re-observe [part='base'] whenever this update's render() produced a
    // fresh one (first mount, or a swap to/from the <lyra-empty> template
    // shape) — observeBase() itself no-ops when it's the same element as
    // already observed.
    const base = this.renderRoot.querySelector('[part="base"]');
    if (base) this.observeBase(base);
    this.observeHeaders();
    if (changed.has('editingCell') && this.editingCell) {
      queueMicrotask(() => {
        (this.renderRoot.querySelector('[part="cell-editor"]') as HTMLInputElement | null)?.focus();
      });
    }
    // Deferred to a microtask rather than called synchronously here: a real
    // priority-hidden transition mutates the reactive `columnsHidden`
    // property, and doing that from inside this same updated() call stack
    // schedules a second update from within the first update's own lifecycle
    // callback -- Lit's dev-mode "scheduled an update ... after an update
    // completed" warning. Pushing the write out to a microtask lets this
    // update finish first, so the follow-up update is a normal externally
    // triggered one instead.
    queueMicrotask(() => this.recomputeColumnsHidden());
  }

  private activateColumn(key: string): void {
    this.activeColKey = key;
    const col = this.columnsByKey.get(key);
    if (col?.sortable) this.emit('lyra-sort', { key: col.key });
  }

  private activateRow(key: string): void {
    this.activeRowKey = key;
    const entry = this.rowsByKey.get(key);
    if (entry === undefined) return;
    const { row, index } = entry;
    this.emit('lyra-row-click', { row });
    if (this.selectionMode === 'single') {
      this.selectedKey = this.keyOf(row, index);
      this.emit('lyra-selection-change', { keys: this.selectedKey === null ? [] : [this.selectedKey] });
    } else if (this.selectionMode === 'multiple') {
      const rawKey = this.keyOf(row, index);
      const next = new Set(this.selectedKeys);
      if (next.has(rawKey)) next.delete(rawKey); else next.add(rawKey);
      this.selectedKeys = next;
      this.emit('lyra-selection-change', { keys: [...next] });
    }
  }

  private editorValue(row: T, column: TableColumn<T>): string {
    const value = column.editValue?.(row) ?? (row as Record<string, unknown>)[column.key] ?? '';
    return String(value);
  }

  private startEditing(rowKey: string, columnKey: string): void {
    const column = this.columnsByKey.get(columnKey);
    if (!column?.editable || !this.rowsByKey.has(rowKey)) return;
    this.editingCell = { rowKey, columnKey };
  }

  private commitEdit(event: Event, rowKey: string, columnKey: string): void {
    const input = event.currentTarget as HTMLInputElement;
    const entry = this.rowsByKey.get(rowKey);
    const column = this.columnsByKey.get(columnKey);
    if (!entry || !column?.editable) return;
    const value = column.editType === 'number' && input.value !== '' ? Number(input.value) : input.value;
    this.emit('lyra-cell-edit', { row: entry.row, key: columnKey, value });
    this.editingCell = null;
  }

  private onEditorKeyDown = (event: KeyboardEvent, rowKey: string, columnKey: string): void => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitEdit(event, rowKey, columnKey);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.editingCell = null;
    }
  };

  private onTableDoubleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const table = event.currentTarget as HTMLElement;
    if (closestInteractive(target, table)) return;
    const cell = target.closest('[part="cell"][data-col-key]') as HTMLElement | null;
    const row = target.closest('[data-row-key]') as HTMLElement | null;
    if (cell && row?.dataset.rowKey && cell.dataset.colKey) {
      this.startEditing(row.dataset.rowKey, cell.dataset.colKey);
    }
  };

  private activateExpandToggle(key: string | number): void {
    const entry = this.rowsByKey.get(encodeKey(key));
    if (entry !== undefined) this.emit('lyra-row-expand-toggle', { row: entry.row, key });
  }

  /** Header cells currently in the tab sequence — excludes columns hidden by
   *  a `priority`-driven `@container` rule (table.styles.ts), so Left/Right/
   *  Home/End never strand the roving tab stop on a `display: none` cell
   *  that `.focus()` would silently no-op on. Scoped to `th` — body `<td>`s
   *  now carry the same `data-col-key` attribute (for the sticky-offset
   *  measurement pass) but must never be treated as header cells here. */
  private visibleHeaders(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('th[data-col-key]')].filter(
      (el) => el.offsetParent !== null,
    );
  }

  private focusHeader(el: HTMLElement | null): void {
    if (!el?.dataset.colKey) return;
    this.activeColKey = el.dataset.colKey;
    el.focus();
  }

  private focusRow(el: HTMLElement | null): void {
    if (!el?.dataset.rowKey) return;
    this.activeRowKey = el.dataset.rowKey;
    el.focus();
  }

  private toggleColumns = (): void => {
    this.showAllColumns = !this.showAllColumns;
    this.emit('lyra-columns-revealed', { revealed: this.showAllColumns });
  };

  private onTableClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    const table = e.currentTarget as HTMLElement;
    // A cell()-rendered button/link/input/custom-element etc. owns its own
    // click — don't let the delegated row/column resolution below
    // re-interpret it as row or header activation.
    if (closestInteractive(target, table)) return;
    // Scoped to `th` — body `<td>`s also carry `data-col-key` now (for the
    // sticky-offset measurement pass), so an unscoped `[data-col-key]` would
    // match the clicked cell itself and misroute a plain cell click to
    // column-sort activation instead of falling through to the row check
    // below.
    const th = target.closest('th[data-col-key]') as HTMLElement | null;
    if (th) return this.activateColumn(th.dataset.colKey!);
    const tr = target.closest('[data-row-key]') as HTMLElement | null;
    if (tr) this.activateRow(tr.dataset.rowKey!);
  };

  private onTableKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    const table = e.currentTarget as HTMLElement;
    // Same guard as onTableClick — also skips the table's own
    // preventDefault(), so a focused nested control keeps its native/own
    // Enter or Space activation instead of having it swallowed.
    if (closestInteractive(target, table)) return;
    // Same th-scoping rationale as onTableClick above.
    const th = target.closest('th[data-col-key]') as HTMLElement | null;
    if (th) return this.onHeaderKeyDown(e, th);
    const tr = target.closest('[data-row-key]') as HTMLElement | null;
    if (tr) this.onRowKeyDown(e, tr);
  };

  private onHeaderKeyDown(e: KeyboardEvent, th: HTMLElement): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.activateColumn(th.dataset.colKey!);
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
        this.focusHeader(headers[rtl ? Math.min(headers.length - 1, index + 1) : Math.max(0, index - 1)]);
        return;
      case 'ArrowRight':
        e.preventDefault();
        this.focusHeader(headers[rtl ? Math.max(0, index - 1) : Math.min(headers.length - 1, index + 1)]);
        return;
      case 'Home':
        e.preventDefault();
        this.focusHeader(headers[0]);
        return;
      case 'End':
        e.preventDefault();
        this.focusHeader(headers[headers.length - 1]);
        return;
      case 'ArrowDown': {
        e.preventDefault();
        const rows = [...this.renderRoot.querySelectorAll<HTMLElement>('[data-row-key]')];
        const key = this.focusedRowKey();
        this.focusRow(rows.find((r) => r.dataset.rowKey === key) ?? rows[0] ?? null);
        return;
      }
      default:
        return;
    }
  }

  private onRowKeyDown(e: KeyboardEvent, tr: HTMLElement): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.activateRow(tr.dataset.rowKey!);
      return;
    }
    const bodyRows = [...this.renderRoot.querySelectorAll<HTMLElement>('[data-row-key]')];
    const index = bodyRows.indexOf(tr);
    if (index < 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusRow(bodyRows[Math.min(bodyRows.length - 1, index + 1)]);
        return;
      case 'ArrowUp':
        e.preventDefault();
        if (index === 0) {
          const headers = this.visibleHeaders();
          const key = this.focusedColKey();
          this.focusHeader(headers.find((h) => h.dataset.colKey === key) ?? headers[0] ?? null);
        } else {
          this.focusRow(bodyRows[index - 1]);
        }
        return;
      case 'Home':
        e.preventDefault();
        this.focusRow(bodyRows[0]);
        return;
      case 'End':
        e.preventDefault();
        this.focusRow(bodyRows[bodyRows.length - 1]);
        return;
      default:
        return;
    }
  }

  render(): TemplateResult {
    if (this.columns.length === 0) {
      return html`<lyra-empty
        heading=${this.localize('noColumns', this.noColumnsHeading || undefined)}
        description=${this.noColumnsDescription}
      ></lyra-empty>`;
    }
    if (this.loading) {
      return html`<div part="base" aria-busy="true">
        <div part="loading" role="status" aria-live="polite">
          <lyra-spinner label-placement="after" accessible-label=${this.localize('tableLoading', this.loadingLabel || undefined)}>
            ${this.localize('tableLoading', this.loadingLabel || undefined)}
          </lyra-spinner>
        </div>
      </div>`;
    }

    const matchingEntries = this.matchingEntries();
    if (this.rows.length === 0 && !this.filterable && this.normalizedPageSize === 0) {
      return html`<lyra-empty
        heading=${this.localize('noData', this.emptyHeading || undefined)}
        description=${this.emptyDescription}
      ></lyra-empty>`;
    }

    const focusedCol = this.focusedColKey();
    const focusedRow = this.focusedRowKey();
    const hasColumnWidths = this.columns.some((col) => col.width || this.resizedColumnWidths.has(col.key));
    const hasExpand = Boolean(this.expandedContent);
    const hasHeatTint = this.columns.some((col) => col.heatValue !== undefined);
    const heatDomain = this.computeHeatDomain(hasHeatTint);
    const hasRowTotal = Boolean(this.rowTotal);
    const renderedEntries = this.renderedEntries();
    const hasPagination = this.normalizedPageSize > 0;
    const filterLabel = this.localize('tableFilterLabel', this.filterLabel || undefined);
    const filterPlaceholder = this.localize('tableFilterPlaceholder', this.filterPlaceholder || undefined);
    const tableContent =
      renderedEntries.length === 0
        ? html`<lyra-empty
            compact
            heading=${this.localize('noData', this.emptyHeading || undefined)}
            description=${this.emptyDescription}
          ></lyra-empty>`
        : html`<table
            part="table"
            role="grid"
            aria-label=${this.getAttribute('aria-label') || nothing}
            aria-multiselectable=${this.selectionMode === 'multiple' ? 'true' : nothing}
            ?data-has-column-widths=${hasColumnWidths}
            @click=${this.onTableClick}
            @keydown=${this.onTableKeyDown}
            @dblclick=${this.onTableDoubleClick}
          >
            <colgroup>
              ${hasExpand ? html`<col style=${styleMap({ 'inline-size': 'var(--lyra-icon-button-size)' })} />` : nothing}
              ${this.columns.map(
                (col) =>
                  html`<col style=${styleMap({
                    'inline-size': this.renderedColumnWidth(col),
                    'min-inline-size': col.minWidth,
                  })} />`,
              )}
              ${hasRowTotal ? html`<col />` : nothing}
            </colgroup>
            <thead part="head">
              <tr role="row">
                ${hasExpand
                  ? html`<th part="header-cell" data-row-expand-toggle aria-hidden="true"></th>`
                  : nothing}
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
                    ${col.headerCell ? col.headerCell(col) : col.label}
                    ${col.resizable
                      ? html`<span
                          part="resize-handle"
                          data-col-key=${col.key}
                          role="separator"
                          aria-orientation="vertical"
                          aria-label=${this.localize('resizeColumn', undefined, { label: col.label })}
                          @pointerdown=${this.onResizePointerDown}
                        ></span>`
                      : nothing}
                    ${active
                      ? html`<span part="sort-icon" data-dir=${this.sortDir} aria-hidden="true"
                          >${chevronIcon()}</span
                        >`
                      : nothing}
                  </th>`;
                })}
                ${hasRowTotal ? html`<th part="header-cell" data-row-total aria-hidden="true"></th>` : nothing}
              </tr>
            </thead>
            <tbody>
              ${repeat(
                renderedEntries,
                (entry) => this.keyOf(entry.row, entry.index),
                (entry, entryIndex) => {
                  const { row, index } = entry;
                  const key = this.keyOf(row, index);
                  const selected = (this.selectedKey !== null && this.selectedKey === key) || this.selectedKeys.has(key);
                  const canExpandRow = hasExpand && (this.canExpand ? this.canExpand(row) : true);
                  const rowExpanded = canExpandRow && this.expandedKeys.has(key);
                  const groupKey = this.groupBy?.(row);
                  const previousGroupKey =
                    entryIndex > 0 ? this.groupBy?.(renderedEntries[entryIndex - 1]!.row) : undefined;
                  const isNewGroup =
                    this.groupBy !== undefined && (entryIndex === 0 || groupKey !== previousGroupKey);
                  return [
                    isNewGroup
                      ? html`<tr part="group-row" role="row">
                          <td
                            part="group-cell"
                            role="gridcell"
                            colspan=${this.columns.length + (hasExpand ? 1 : 0) + (hasRowTotal ? 1 : 0)}
                          >
                            ${this.groupLabel
                              ? this.groupLabel(
                                  groupKey!,
                                  renderedEntries
                                    .filter((candidate) => this.groupBy?.(candidate.row) === groupKey)
                                    .map((candidate) => candidate.row),
                                )
                              : String(groupKey)}
                          </td>
                        </tr>`
                      : nothing,
                    html`<tr
                      part="row"
                      role="row"
                      data-row-key=${encodeKey(key)}
                      aria-selected=${selected ? 'true' : 'false'}
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
                          ...(col.cellStyle ? col.cellStyle(row) ?? {} : {}),
                          ...(heatShare !== null ? { '--lyra-table-heat-t': heatShare } : {}),
                        };
                        return html`<td
                            part="cell"
                            role="gridcell"
                            data-col-key=${col.key}
                            data-align=${col.align ?? 'start'}
                            data-priority=${col.priority ?? nothing}
                            data-sticky=${stickyDirection(col.sticky) ?? nothing}
                            ?data-heat=${heatShare !== null}
                            style=${Object.keys(cellStyle).length ? styleMap(cellStyle) : nothing}
                          >
                            ${this.editingCell?.rowKey === encodeKey(key) && this.editingCell.columnKey === col.key
                              ? html`<input
                                  part="cell-editor"
                                  type=${col.editType ?? 'text'}
                                  .value=${this.editorValue(row, col)}
                                  aria-label=${this.localize('tableEditCell', undefined, { column: col.label })}
                                  spellcheck=${(col.editType ?? 'text') === 'text' ? this.spellcheck : nothing}
                                  autocapitalize=${(col.editType ?? 'text') === 'text'
                                    ? this.autocapitalize || nothing
                                    : nothing}
                                  autocorrect=${(col.editType ?? 'text') === 'text'
                                    ? this.autoCorrect || nothing
                                    : nothing}
                                  @change=${(event: Event) => this.commitEdit(event, encodeKey(key), col.key)}
                                  @focus=${this.onNativeFocus}
                                  @blur=${this.onNativeBlur}
                                  @keydown=${(event: KeyboardEvent) =>
                                    this.onEditorKeyDown(event, encodeKey(key), col.key)}
                                />`
                              : col.cell(row)}
                          </td>`;
                      })}
                      ${hasRowTotal ? html`<td part="row-total-cell">${this.rowTotal?.(row)}</td>` : nothing}
                    </tr>`,
                    rowExpanded
                      ? html`<tr part="expanded-row" role="row">
                          <td
                            part="expanded-cell"
                            role="gridcell"
                            colspan=${this.columns.length + (hasExpand ? 1 : 0) + (hasRowTotal ? 1 : 0)}
                          >
                            ${this.expandedContent?.(row)}
                          </td>
                        </tr>`
                      : nothing,
                  ];
                },
              )}
            </tbody>
            ${this.columns.some((c) => c.footer)
              ? html`<tfoot part="foot">
                  <tr part="footer-row">
                    ${hasExpand ? html`<td part="footer-cell" aria-hidden="true"></td>` : nothing}
                    ${this.columns.map(
                      (col) => html`<td
                        part="footer-cell"
                        data-col-key=${col.key}
                        data-align=${col.align ?? 'start'}
                      >${col.footer?.(matchingEntries.map((entry) => entry.row)) ?? ''}</td>`,
                    )}
                    ${hasRowTotal
                      ? html`<td part="footer-cell">${this.grandTotal?.(matchingEntries.map((entry) => entry.row)) ?? ''}</td>`
                      : nothing}
                  </tr>
                </tfoot>`
              : nothing}
          </table>`;

    return html`
      <div part="base" ?data-force-visible=${this.showAllColumns} aria-busy="false">
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
                @focus=${this.onNativeFocus}
                @blur=${this.onNativeBlur}
              />
            </label>`
          : nothing}
        ${tableContent}
        ${this.columnsHidden
          ? html`<button
              part="reveal-columns-button"
              type="button"
              aria-pressed=${this.showAllColumns ? 'true' : 'false'}
              @click=${this.toggleColumns}
            >
              ${this.showAllColumns
                ? this.localize('showFewerColumns', this.hideColumnsLabel || undefined)
                : this.localize('showAllColumns', this.revealColumnsLabel || undefined)}
            </button>`
          : nothing}
        ${this.hasMore
          ? html`<button
              part="more-button"
              type="button"
              @click=${() => this.emit('lyra-load-more')}
            >
              ${this.localize('loadMore', this.moreLabel || undefined)}
            </button>`
          : nothing}
        ${hasPagination
          ? html`<lyra-pagination
              part="pagination"
              .page=${this.page}
              .pageSize=${this.normalizedPageSize}
              .totalItems=${this.matchingTotalItems}
              .strings=${this.strings}
              hide-summary
              @lyra-page-change=${this.onPaginationChange}
            ></lyra-pagination>`
          : nothing}
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-table': LyraTable;
  }
}
