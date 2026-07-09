import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './table.styles.js';
import '../empty/empty.js';

export interface TableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'start' | 'end';
  cell: (row: T) => unknown;
}

/**
 * `<lyra-table>` — a presentational, sort/select-aware data table. The host
 * owns actual sorting/filtering/pagination of `rows`; this component renders
 * and emits intents (`lyra-sort`, `lyra-row-click`, `lyra-load-more`).
 *
 * @customElement lyra-table
 * @event lyra-sort - A sortable header was activated. `detail: { key }`.
 * @event lyra-row-click - A row was activated. `detail: { row }`.
 * @event lyra-load-more - The "load more" control was activated.
 * @csspart base, table, head, header-cell, row, cell, more-button
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

  private keyOf(row: T, index: number): string | number {
    return this.rowKey ? this.rowKey(row) : index;
  }

  private onHeaderClick(col: TableColumn<T>): void {
    if (!col.sortable) return;
    this.emit('lyra-sort', { key: col.key });
  }

  render(): TemplateResult {
    if (this.rows.length === 0) {
      return html`<lyra-empty
        heading=${this.emptyHeading}
        description=${this.emptyDescription}
      ></lyra-empty>`;
    }

    return html`
      <div part="base">
        <table part="table" role="grid">
          <thead part="head">
            <tr role="row">
              ${this.columns.map((col) => {
                const ariaSort =
                  this.sortKey === col.key ? (this.sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
                return html`<th
                  part="header-cell"
                  role="columnheader"
                  scope="col"
                  data-align=${col.align ?? 'start'}
                  ?data-sortable=${col.sortable}
                  aria-sort=${col.sortable ? ariaSort : nothing}
                  tabindex=${col.sortable ? '0' : '-1'}
                  @click=${() => this.onHeaderClick(col)}
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      this.onHeaderClick(col);
                    }
                  }}
                >
                  ${col.label}
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
                  aria-selected=${selected ? 'true' : 'false'}
                  tabindex="0"
                  @click=${() => this.emit('lyra-row-click', { row })}
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      this.emit('lyra-row-click', { row });
                    }
                  }}
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
