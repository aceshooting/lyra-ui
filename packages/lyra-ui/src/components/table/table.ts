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
const INTERACTIVE_SELECTOR = 'button, a[href], input, select, textarea, [role="button"]';

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
 * (rendered whenever any column has a priority) forces them all back into
 * view. `columns[].sticky` pins a column's header/cells to the inline-start
 * edge while the table scrolls horizontally.
 *
 * @customElement lyra-table
 * @event lyra-sort - A sortable header was activated. `detail: { key }`.
 * @event lyra-row-click - A row was activated. `detail: { row }`.
 * @event lyra-load-more - The "load more" control was activated.
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
      const selected = String(this.selectedKey);
      if (this.rowsByKey.has(selected)) return selected;
    }
    return this.rows.length > 0 ? String(this.keyOf(this.rows[0], 0)) : null;
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('rows') || changed.has('rowKey')) {
      this.rowsByKey = new Map(this.rows.map((row, i) => [String(this.keyOf(row, i)), row]));
    }
    if (changed.has('columns')) {
      this.columnsByKey = new Map(this.columns.map((c) => [c.key, c]));
    }
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
   *  that `.focus()` would silently no-op on. */
  private visibleHeaders(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('[data-col-key]')].filter(
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
    // A cell()-rendered button/link/input etc. owns its own click — don't let
    // the delegated row/column resolution below re-interpret it as row or
    // header activation.
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    const th = target.closest('[data-col-key]') as HTMLElement | null;
    if (th) return this.activateColumn(th.dataset.colKey!);
    const tr = target.closest('[data-row-key]') as HTMLElement | null;
    if (tr) this.activateRow(tr.dataset.rowKey!);
  };

  private onTableKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    // Same guard as onTableClick — also skips the table's own
    // preventDefault(), so a focused nested control keeps its native/own
    // Enter or Space activation instead of having it swallowed.
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    const th = target.closest('[data-col-key]') as HTMLElement | null;
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

    const hasPriorityColumns = this.columns.some((col) => col.priority);
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
                  data-row-key=${String(key)}
                  aria-selected=${selected ? 'true' : 'false'}
                  tabindex=${String(key) === focusedRow ? '0' : '-1'}
                >
                  ${this.columns.map(
                    (col) =>
                      html`<td
                        part="cell"
                        role="gridcell"
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
        ${hasPriorityColumns
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
