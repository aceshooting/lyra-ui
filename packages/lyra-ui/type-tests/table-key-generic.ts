import { LyraTable, type LyraTableEventMap, type TableColumn } from '../src/lyra.js';

interface Row {
  id: number;
  name: string;
}

const columns: TableColumn<Row>[] = [{ key: 'name', label: 'Name', cell: (r) => r.name }];
void columns;

// --- `cell` is optional exactly for an `editTrigger: 'always'` column, since that column's editor
// renders unconditionally and the table's render path never falls back to `cell` for it -----------
const alwaysColumnWithoutCell: TableColumn<Row> = { key: 'name', label: 'Name', editTrigger: 'always' };
void alwaysColumnWithoutCell;

// @ts-expect-error `cell` stays required for a column with no `editTrigger` at all -- its resting
// (only) state is exactly what `cell` renders
const plainColumnWithoutCell: TableColumn<Row> = { key: 'name', label: 'Name' };
void plainColumnWithoutCell;

// @ts-expect-error `cell` stays required for an `editTrigger: 'double-click'` column too -- its
// resting cell (not currently being edited) is what `cell` renders, unlike an `'always'` column
const doubleClickColumnWithoutCell: TableColumn<Row> = {
  key: 'name',
  label: 'Name',
  editTrigger: 'double-click',
};
void doubleClickColumnWithoutCell;

// --- a table parameterized with a concrete key type reads that type with no cast ----------------
declare const numberKeyedTable: LyraTable<Row, number>;

const rowKeyReturn: number = numberKeyedTable.rowKey!({ id: 1, name: 'Alpha' });
void rowKeyReturn;

const selected: ReadonlySet<number> = numberKeyedTable.selectedRowKeys;
const expanded: ReadonlySet<number> = numberKeyedTable.expandedRowKeys;
void selected;
void expanded;
numberKeyedTable.selectedRowKeys = new Set([1, 2]);
numberKeyedTable.expandedRowKeys = new Set([1]);

// @ts-expect-error a table parameterized with `number` never accepts a string key
numberKeyedTable.selectedRowKeys = new Set(['a']);

declare const toggleDetail: LyraTableEventMap<Row, number>['lr-row-expand-toggle'];
const toggleRowKey: number = toggleDetail.detail.rowKey;
void toggleRowKey;

// @ts-expect-error `rowKey` is `number`, never `string`, once the table is parameterized
const toggleRowKeyAsString: string = toggleDetail.detail.rowKey;
void toggleRowKeyAsString;

declare const requestDetail: LyraTableEventMap<Row, number>['lr-row-expand-request'];
const requestRowKey: number = requestDetail.detail.rowKey;
void requestRowKey;

declare const selectionDetail: LyraTableEventMap<Row, number>['lr-selection-change'];
const selectionKeys: readonly number[] = selectionDetail.detail.rowKeys;
void selectionKeys;

// --- an unparameterized table keeps the pre-existing `string | number` union unchanged -----------
declare const untypedTable: LyraTable<Row>;

const untypedSelected: ReadonlySet<string | number> = untypedTable.selectedRowKeys;
void untypedSelected;
untypedTable.selectedRowKeys = new Set(['a', 1]);

declare const untypedToggleDetail: LyraTableEventMap<Row>['lr-row-expand-toggle'];
const untypedRowKey: string | number = untypedToggleDetail.detail.rowKey;
void untypedRowKey;

// The tag map keeps the un-narrowed element type, so `document.querySelector('lr-table')` and
// every shipped `.rowKey`/event-detail read compiles exactly as it did before this parameter
// existed.
declare const fromTagMap: HTMLElementTagNameMap['lr-table'];
const fromTagMapKeys: ReadonlySet<string | number> = fromTagMap.selectedRowKeys;
void fromTagMapKeys;
