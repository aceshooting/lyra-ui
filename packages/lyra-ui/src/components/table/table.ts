import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './table.styles.js';
import { chevronIcon } from '../../internal/icons.js';
import '../empty/empty.js';

export interface TableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'start' | 'end';
  /** Responsive priority — `undefined` (the default) means "always visible".
   *  `'low'` columns hide first (narrowest container), `'medium'` next, as
   *  `[part='base']`'s container-query width shrinks; both can be forced back
   *  on via `[part='reveal-columns-button']`. */
  priority?: 'medium' | 'low';
  /** Pins this column's header/cell to the inline-start edge with
   *  `position: sticky` so it stays visible while the table scrolls
   *  horizontally. */
  sticky?: boolean;
  cell: (row: T) => unknown;
}

/** Interactive elements a nested `cell()` template may render (e.g. an
 *  actions-column button). Clicks/keydowns landing on one of these — or
 *  bubbling up through one — must not be re-interpreted as row/column
 *  activation by the table's own delegated listeners. */
const INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, [role="button"], [role="combobox"], [role="listbox"], [role="slider"]';

/** Encodes a row/column identity key for use as a Map key or a DOM
 *  `data-row-key` attribute value, preserving the distinction between a
 *  numeric key and a string key that happen to stringify the same way
 *  (`1` vs `"1"`) -- a bare `String(key)` would silently collide the two. */
function encodeKey(key: string | number): string {
  return `${typeof key}:${key}`;
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
    if (el.matches(INTERACTIVE_SELECTOR) || el.tagName.includes('-')) return el;
    el = el.parentElement;
  }
  return null;
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
 * `columns[].priority` ('medium' | 'low') hides that column under
 * `[part='base']`'s `@container` breakpoints; `[part='reveal-columns-button']`
 * forces them all back into view. Rather than a *static* check of whether any
 * column merely declares a `priority`, the button (and the public
 * `columnsHidden` property, see below) reflects whether a `priority` column
 * is *actually* hidden right now — measured via `ResizeObserver` on
 * `[part='base']` plus a post-render DOM check — or `showAllColumns`
 * force-visible mode is currently active (so there's still a way to toggle
 * it back off). `columns[].sticky` pins a column's header/cells to the
 * inline-start edge while the table scrolls horizontally.
 *
 * @customElement lyra-table
 * @event lyra-sort - A sortable header was activated. `detail: { key }`.
 * @event lyra-row-click - A row was activated. `detail: { row }`.
 * @event lyra-load-more - The "load more" control was activated.
 * @event lyra-columns-hidden-change - `columnsHidden` actually changed value
 *   (a `priority` column just became hidden/un-hidden by the `@container`
 *   rules, or `showAllColumns` force-visible mode was toggled while a
 *   `priority` column was hidden). `detail: { hidden: boolean }`.
 * @csspart base, table, head, header-cell, row, cell, more-button, sort-icon, reveal-columns-button
 */
export class LyraTable<T = unknown> extends LyraElement {
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
  @property({ type: Boolean, attribute: 'has-more', reflect: true }) hasMore = false;
  @property({ attribute: 'more-label' }) moreLabel = 'Load more';
  @property({ attribute: 'empty-heading' }) emptyHeading = 'No data';
  @property({ attribute: 'empty-description' }) emptyDescription = '';
  @property({ attribute: 'no-columns-heading' }) noColumnsHeading = 'No columns configured';
  @property({ attribute: 'no-columns-description' }) noColumnsDescription = '';
  @property({ attribute: 'reveal-columns-label' }) revealColumnsLabel = 'Show all columns';
  @property({ attribute: 'hide-columns-label' }) hideColumnsLabel = 'Show fewer columns';

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
   *  `@container` hide rules in table.styles.ts. Toggled by
   *  `[part='reveal-columns-button']`. */
  @state() private showAllColumns = false;

  /** Roving-tabindex position among header cells; `null` until a header is
   *  clicked/navigated to, at which point `focusedColKey()` falls back to
   *  the first column. */
  @state() private activeColKey: string | null = null;
  /** Roving-tabindex position among body rows; `null` until a row is
   *  clicked/navigated to, at which point `focusedRowKey()` falls back to
   *  `selectedKey` (if it matches a row) or the first row. */
  @state() private activeRowKey: string | null = null;

  private rowsByKey = new Map<string, T>();
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

  connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(() => this.recomputeColumnsHidden());
    // A reconnect re-creates the observer above but the shadow root content
    // survives across disconnect/reconnect (Lit doesn't tear down the shadow
    // root) — re-observe [part='base'] here if it already exists from before
    // the disconnect. On the very first mount connectedCallback() fires
    // *before* Lit's first render, so [part='base'] doesn't exist yet and
    // this is a no-op; updated() below (which always runs after render, first
    // paint included) covers that case instead.
    const base = this.renderRoot?.querySelector('[part="base"]');
    if (base) this.observeBase(base);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.observedBase = undefined;
  }

  private observeBase(base: Element): void {
    if (this.observedBase === base) return;
    if (this.observedBase) this.resizeObserver?.unobserve(this.observedBase);
    this.resizeObserver?.observe(base);
    this.observedBase = base;
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
    if (this.columnsHidden === next) return;
    this.columnsHidden = next;
    this.emit('lyra-columns-hidden-change', { hidden: next });
  }

  private keyOf(row: T, index: number): string | number {
    return this.rowKey ? this.rowKey(row) : index;
  }

  /** The header cell that currently owns `tabindex="0"`. */
  private focusedColKey(): string | null {
    if (this.activeColKey !== null && this.columnsByKey.has(this.activeColKey)) {
      return this.activeColKey;
    }
    return this.columns[0]?.key ?? null;
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
    return this.rows.length > 0 ? encodeKey(this.keyOf(this.rows[0], 0)) : null;
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('rows') || changed.has('rowKey')) {
      this.rowsByKey = new Map(this.rows.map((row, i) => [encodeKey(this.keyOf(row, i)), row]));
    }
    if (changed.has('columns')) {
      this.columnsByKey = new Map(this.columns.map((c) => [c.key, c]));
    }
  }

  /** Each sticky column's cumulative left offset — the sum of the *rendered
   *  width* of every earlier sticky column — so multiple sticky columns
   *  stack left-to-right instead of all pinning to inset-inline-start: 0 and
   *  overlapping. Table columns are intrinsically sized (not fixed-width), so
   *  this can't be computed in CSS alone; it requires measuring the actual
   *  laid-out `offsetWidth` of each earlier sticky column's header cell. */
  private stickyOffsets(): Map<string, number> {
    const offsets = new Map<string, number>();
    let running = 0;
    for (const col of this.columns) {
      if (!col.sticky) continue;
      offsets.set(col.key, running);
      const headerEl = this.renderRoot.querySelector<HTMLElement>(`th[data-col-key="${col.key}"]`);
      running += headerEl?.offsetWidth ?? 0;
    }
    return offsets;
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
   *  update; a future optimization pass could cache column widths instead of
   *  re-querying every time — out of scope for this correctness fix. */
  protected updated(): void {
    if (this.columns.some((c) => c.sticky)) {
      for (const [key, offset] of this.stickyOffsets()) {
        this.renderRoot
          .querySelectorAll<HTMLElement>(`[data-col-key="${key}"]`)
          .forEach((el) => el.style.setProperty('--lyra-table-sticky-offset', `${offset}px`));
      }
    }
    // Re-observe [part='base'] whenever this update's render() produced a
    // fresh one (first mount, or a swap to/from the <lyra-empty> template
    // shape) — observeBase() itself no-ops when it's the same element as
    // already observed.
    const base = this.renderRoot.querySelector('[part="base"]');
    if (base) this.observeBase(base);
    this.recomputeColumnsHidden();
  }

  private activateColumn(key: string): void {
    this.activeColKey = key;
    const col = this.columnsByKey.get(key);
    if (col?.sortable) this.emit('lyra-sort', { key: col.key });
  }

  private activateRow(key: string): void {
    this.activeRowKey = key;
    const row = this.rowsByKey.get(key);
    if (row !== undefined) this.emit('lyra-row-click', { row });
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
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.focusHeader(headers[Math.max(0, index - 1)]);
        return;
      case 'ArrowRight':
        e.preventDefault();
        this.focusHeader(headers[Math.min(headers.length - 1, index + 1)]);
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
        heading=${this.noColumnsHeading}
        description=${this.noColumnsDescription}
      ></lyra-empty>`;
    }
    if (this.rows.length === 0) {
      return html`<lyra-empty
        heading=${this.emptyHeading}
        description=${this.emptyDescription}
      ></lyra-empty>`;
    }

    const focusedCol = this.focusedColKey();
    const focusedRow = this.focusedRowKey();

    return html`
      <div part="base" ?data-force-visible=${this.showAllColumns}>
        <table part="table" role="grid" @click=${this.onTableClick} @keydown=${this.onTableKeyDown}>
          <thead part="head">
            <tr role="row">
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
                  ?data-sticky=${col.sticky}
                  ?data-sortable=${col.sortable}
                  aria-sort=${col.sortable ? ariaSort : nothing}
                  tabindex=${col.key === focusedCol ? '0' : '-1'}
                >
                  ${col.label}
                  ${active
                    ? html`<span part="sort-icon" data-dir=${this.sortDir} aria-hidden="true"
                        >${chevronIcon()}</span
                      >`
                    : nothing}
                </th>`;
              })}
            </tr>
          </thead>
          <tbody>
            ${repeat(
              this.rows,
              (row, i) => this.keyOf(row, i),
              (row, i) => {
                const key = this.keyOf(row, i);
                const selected = this.selectedKey !== null && this.selectedKey === key;
                return html`<tr
                  part="row"
                  role="row"
                  data-row-key=${encodeKey(key)}
                  aria-selected=${selected ? 'true' : 'false'}
                  tabindex=${encodeKey(key) === focusedRow ? '0' : '-1'}
                >
                  ${this.columns.map(
                    (col) =>
                      html`<td
                        part="cell"
                        role="gridcell"
                        data-col-key=${col.key}
                        data-align=${col.align ?? 'start'}
                        data-priority=${col.priority ?? nothing}
                        ?data-sticky=${col.sticky}
                      >
                        ${col.cell(row) as unknown as string}
                      </td>`,
                  )}
                </tr>`;
              },
            )}
          </tbody>
        </table>
        ${this.columnsHidden
          ? html`<button
              part="reveal-columns-button"
              type="button"
              aria-pressed=${this.showAllColumns ? 'true' : 'false'}
              @click=${this.toggleColumns}
            >
              ${this.showAllColumns ? this.hideColumnsLabel : this.revealColumnsLabel}
            </button>`
          : nothing}
        ${this.hasMore
          ? html`<button
              part="more-button"
              type="button"
              @click=${() => this.emit('lyra-load-more')}
            >
              ${this.moreLabel}
            </button>`
          : nothing}
      </div>
    `;
  }
}

defineElement('table', LyraTable);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-table': LyraTable;
  }
}
