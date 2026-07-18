import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './data-grid.styles.js';

export interface DataGridColumn<T = Record<string, unknown>> { key: string; label: string; width?: string; sortable?: boolean; value?: (row: T) => unknown; }
export interface LyraDataGridEventMap<T = unknown> { 'lyra-row-click': CustomEvent<{ row: T }>; 'lyra-cell-focus': CustomEvent<{ row: T; column: string }>; 'lyra-sort': CustomEvent<{ key: string; direction: 'ascending' | 'descending' }>; 'lyra-selection-change': CustomEvent<{ row: T | null }>; }

/** `<lyra-data-grid>` — keyboard-navigable, responsive data grid with sortable columns.
 * @customElement lyra-data-grid
 * @event lyra-row-click - A row was activated.
 * @event lyra-cell-focus - A cell received roving focus.
 * @event lyra-sort - A header was sorted.
 * @event lyra-selection-change - The selected row changed.
 * @csspart viewport - Scrollable grid viewport.
 * @csspart grid - Native table grid.
 * @csspart header - Header cell.
 * @csspart row - Body row.
 * @csspart cell - Body cell.
 */
export class LyraDataGrid<T = Record<string, unknown>> extends LyraElement<LyraDataGridEventMap<T>> {
  static styles = [LyraElement.styles, styles];
  @property({ attribute: false }) columns: DataGridColumn<T>[] = [];
  @property({ attribute: false }) rows: T[] = [];
  @property({ attribute: false }) rowKey: (row: T, index: number) => string | number = (_row, index) => index;
  @property({ attribute: false }) selectedKey: string | number | null = null;
  @property({ attribute: false }) sortKey = '';
  @property({ attribute: false }) sortDirection: 'ascending' | 'descending' = 'ascending';
  @property({ type: Boolean, reflect: true }) loading = false;
  @property({ attribute: 'empty-text' }) emptyText = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private focusRow = 0;
  @state() private focusColumn = 0;

  protected willUpdate(changed: PropertyValues): void {
    // Re-clamp the roving focus position whenever the data changes: if rows/columns shrink
    // below the remembered indices, no rendered cell would match them and the grid body would
    // lose its single tabindex="0" stop entirely, making it unreachable by keyboard.
    if (changed.has('rows') || changed.has('columns')) {
      this.focusRow = Math.max(0, Math.min(this.rows.length - 1, this.focusRow));
      this.focusColumn = Math.max(0, Math.min(this.columns.length - 1, this.focusColumn));
    }
  }

  private value(row: T, column: DataGridColumn<T>): unknown { return column.value ? column.value(row) : (row as Record<string, unknown>)[column.key]; }
  private activate(row: T): void { this.selectedKey = this.rowKey(row, this.rows.indexOf(row)); this.emit('lyra-row-click', { row }); this.emit('lyra-selection-change', { row }); }
  private sort(column: DataGridColumn<T>): void { if (!column.sortable) return; if (this.sortKey === column.key) this.sortDirection = this.sortDirection === 'ascending' ? 'descending' : 'ascending'; else { this.sortKey = column.key; this.sortDirection = 'ascending'; } this.emit('lyra-sort', { key: column.key, direction: this.sortDirection }); }
  private onCellKeyDown = (event: KeyboardEvent, rowIndex: number, columnIndex: number): void => { const rtl = this.effectiveDirection === 'rtl'; const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight'; const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft'; let nextRow = rowIndex; let nextColumn = columnIndex; if (event.key === 'ArrowDown') nextRow++; else if (event.key === 'ArrowUp') nextRow--; else if (event.key === forwardKey) nextColumn++; else if (event.key === backwardKey) nextColumn--; else if (event.key === 'Home') nextColumn = 0; else if (event.key === 'End') nextColumn = this.columns.length - 1; else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.activate(this.rows[rowIndex]); return; } else return; event.preventDefault(); this.focusRow = Math.max(0, Math.min(this.rows.length - 1, nextRow)); this.focusColumn = Math.max(0, Math.min(this.columns.length - 1, nextColumn)); queueMicrotask(() => this.renderRoot.querySelector<HTMLElement>(`[data-row="${this.focusRow}"][data-column="${this.focusColumn}"]`)?.focus()); };
  private cell(row: T, column: DataGridColumn<T>): string { const value = this.value(row, column); return value == null ? '' : String(value); }
  render(): TemplateResult {
    const label = this.accessibleLabel || this.localize('dataGridLabel');
    return html`<div part="viewport"><table part="grid" role="grid" aria-label=${label} aria-rowcount=${this.rows.length + 1} aria-colcount=${this.columns.length}>
      ${this.columns.length ? html`<thead><tr role="row">${this.columns.map((column) => html`<th part="header" role="columnheader" style=${column.width ? `inline-size:${column.width}` : ''} aria-sort=${this.sortKey === column.key ? this.sortDirection : 'none'}><button type="button" @click=${() => this.sort(column)}>${column.label}</button></th>`)}</tr></thead>` : nothing}
      <tbody>${this.loading ? html`<tr><td role="gridcell" colspan=${Math.max(1, this.columns.length)} part="empty">${this.localize('loading')}</td></tr>` : this.rows.length ? this.rows.map((row, rowIndex) => html`<tr part="row" role="row" data-selected=${this.rowKey(row, rowIndex) === this.selectedKey ? 'true' : 'false'} aria-selected=${this.rowKey(row, rowIndex) === this.selectedKey ? 'true' : 'false'} @click=${() => this.activate(row)}>${this.columns.map((column, columnIndex) => html`<td part="cell" role="gridcell" tabindex=${rowIndex === this.focusRow && columnIndex === this.focusColumn ? '0' : '-1'} data-row=${rowIndex} data-column=${columnIndex} aria-colindex=${columnIndex + 1} aria-rowindex=${rowIndex + 2} @keydown=${(event: KeyboardEvent) => this.onCellKeyDown(event, rowIndex, columnIndex)} @focus=${() => { this.focusRow = rowIndex; this.focusColumn = columnIndex; this.emit('lyra-cell-focus', { row, column: column.key }); }}>${this.cell(row, column)}</td>`)}</tr>`) : html`<tr><td role="gridcell" colspan=${Math.max(1, this.columns.length)} part="empty">${this.emptyText || this.localize('noData')}</td></tr>`}</tbody>
    </table></div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-data-grid': LyraDataGrid; } }
