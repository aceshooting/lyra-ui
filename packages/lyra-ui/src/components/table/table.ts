import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
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
  cell: (row: T) => unknown;
}

/**
 * `<lyra-table>` — a presentational, sort/select-aware data table.
 *
 * Header/row activation is delegated: one `click` and one `keydown`
 * listener on `<table>` resolve the target via `closest('[data-col-key]'
 * | '[data-row-key]')` and a key→object lookup map, instead of allocating
 * fresh per-column/per-row closures on every render.
 *
 * @customElement lyra-table
 * @event lyra-sort - A sortable header was activated. `detail: { key }`.
 * @event lyra-row-click - A row was activated. `detail: { row }`.
 * @event lyra-load-more - The "load more" control was activated.
 * @csspart base, table, head, header-cell, row, cell, more-button, sort-icon
 */
export class LyraTable<T = unknown> extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) columns: TableColumn<T>[] = [];
  @property({ attribute: false }) rows: T[] = [];
  @property({ attribute: 'sort-key' }) sortKey = '';
  @property({ attribute: 'sort-dir' }) sortDir: 'asc' | 'desc' = 'asc';
  @property({ attribute: false }) rowKey?: (row: T) => string | number;
  @property({ attribute: false }) selectedKey: string | number | null = null;
  @property({ type: Boolean, attribute: 'has-more', reflect: true }) hasMore = false;
  @property({ attribute: 'more-label' }) moreLabel = 'Load more';
  @property({ attribute: 'empty-heading' }) emptyHeading = 'No data';
  @property({ attribute: 'empty-description' }) emptyDescription = '';
  @property({ attribute: 'no-columns-heading' }) noColumnsHeading = 'No columns configured';
  @property({ attribute: 'no-columns-description' }) noColumnsDescription = '';

  private rowsByKey = new Map<string, T>();
  private columnsByKey = new Map<string, TableColumn<T>>();

  private keyOf(row: T, index: number): string | number {
    return this.rowKey ? this.rowKey(row) : index;
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
    const col = this.columnsByKey.get(key);
    if (col?.sortable) this.emit('lyra-sort', { key: col.key });
  }

  private activateRow(key: string): void {
    const row = this.rowsByKey.get(key);
    if (row !== undefined) this.emit('lyra-row-click', { row });
  }

  private onTableClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    const th = target.closest('[data-col-key]') as HTMLElement | null;
    if (th) return this.activateColumn(th.dataset.colKey!);
    const tr = target.closest('[data-row-key]') as HTMLElement | null;
    if (tr) this.activateRow(tr.dataset.rowKey!);
  };

  private onTableKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target as HTMLElement;
    const th = target.closest('[data-col-key]') as HTMLElement | null;
    if (th) {
      e.preventDefault();
      return this.activateColumn(th.dataset.colKey!);
    }
    const tr = target.closest('[data-row-key]') as HTMLElement | null;
    if (tr) {
      e.preventDefault();
      this.activateRow(tr.dataset.rowKey!);
    }
  };

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

    return html`
      <div part="base">
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
                  ?data-sortable=${col.sortable}
                  aria-sort=${col.sortable ? ariaSort : nothing}
                  tabindex=${col.sortable ? '0' : '-1'}
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
                  tabindex="0"
                >
                  ${this.columns.map(
                    (col) =>
                      html`<td part="cell" role="gridcell" data-align=${col.align ?? 'start'}>
                        ${col.cell(row) as unknown as string}
                      </td>`,
                  )}
                </tr>`;
              },
            )}
          </tbody>
        </table>
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
