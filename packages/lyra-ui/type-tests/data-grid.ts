import {
  LyraDataGrid,
  type DataGridCopyOptions,
  type DataGridCsvOptions,
  type DataGridExportOptions,
  type DataGridGroupDetail,
  type DataGridRequest,
  type DataGridScrollOptions,
  type LyraDataGridEventMap,
} from '../src/lyra.js';

interface Row {
  id: number;
  name: string;
  score: number;
}

declare const grid: LyraDataGrid<Row>;

type UpstreamCopySelectedRowsOptions = {
  columnIds?: string[];
  includeHeaders?: boolean;
  format?: 'tsv' | 'csv';
  escapeFormulas?: boolean;
};
type UpstreamExportDataAsCsvOptions = {
  fileName?: string;
  columnIds?: string[];
  includeHeaders?: boolean;
  delimiter?: string;
  escapeFormulas?: boolean;
};
type UpstreamGetDataAsCsvOptions = {
  columnIds?: string[];
  includeHeaders?: boolean;
  delimiter?: string;
  escapeFormulas?: boolean;
};
type UpstreamScrollToIndexOptions = {
  align?: 'start' | 'center' | 'end';
};

type Assert<T extends true> = T;
type IsEqual<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <Value>() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;
type AllUpstreamOptionFieldsAreAccepted<Upstream extends object, Target extends object> = Exclude<{
  [Key in keyof Upstream]-?: Key extends keyof Target
    ? Upstream[Key] extends Target[Key]
      ? true
      : false
    : false;
}[keyof Upstream], true> extends never
  ? true
  : false;

type DataGridCopyOptionsAcceptAllUpstreamFields = Assert<
  AllUpstreamOptionFieldsAreAccepted<UpstreamCopySelectedRowsOptions, DataGridCopyOptions>
>;
type DataGridExportOptionsAcceptAllUpstreamFields = Assert<
  AllUpstreamOptionFieldsAreAccepted<UpstreamExportDataAsCsvOptions, DataGridExportOptions>
>;
type DataGridCsvOptionsAcceptAllUpstreamFields = Assert<
  AllUpstreamOptionFieldsAreAccepted<UpstreamGetDataAsCsvOptions, DataGridCsvOptions>
>;
type DataGridScrollOptionsAcceptAllUpstreamFields = Assert<
  AllUpstreamOptionFieldsAreAccepted<UpstreamScrollToIndexOptions, DataGridScrollOptions>
>;
type DataGridRequestEventUsesMirroredName = Assert<
  IsEqual<LyraDataGridEventMap<Row>['request']['detail'], DataGridRequest>
>;
type DataGridGroupExpandEventUsesCanonicalDetail = Assert<
  IsEqual<LyraDataGridEventMap<Row>['lr-group-expand']['detail'], DataGridGroupDetail<Row>>
>;
type DataGridGroupCollapseEventUsesCanonicalDetail = Assert<
  IsEqual<LyraDataGridEventMap<Row>['lr-group-collapse']['detail'], DataGridGroupDetail<Row>>
>;

// The v9 event contract retains the mirrored `request` event as the sole request surface.
// @ts-expect-error `lr-data-request` was intentionally removed.
export type RemovedDataGridRequestEvent = LyraDataGridEventMap<Row>['lr-data-request'];

export type DataGridUpstreamOptionContractAssertions =
  | DataGridCopyOptionsAcceptAllUpstreamFields
  | DataGridExportOptionsAcceptAllUpstreamFields
  | DataGridCsvOptionsAcceptAllUpstreamFields
  | DataGridScrollOptionsAcceptAllUpstreamFields
  | DataGridRequestEventUsesMirroredName
  | DataGridGroupExpandEventUsesCanonicalDetail
  | DataGridGroupCollapseEventUsesCanonicalDetail;

const upstreamCopyOptions: UpstreamCopySelectedRowsOptions = {
  columnIds: ['name', 'score'],
  includeHeaders: false,
  format: 'csv',
  escapeFormulas: true,
};
const upstreamExportOptions: UpstreamExportDataAsCsvOptions = {
  fileName: 'people.csv',
  columnIds: ['name'],
  includeHeaders: true,
  delimiter: ';',
  escapeFormulas: true,
};
const upstreamCsvOptions: UpstreamGetDataAsCsvOptions = {
  columnIds: ['name'],
  includeHeaders: true,
  delimiter: ';',
  escapeFormulas: true,
};
const upstreamScrollOptions: UpstreamScrollToIndexOptions = { align: 'center' };

const dataGridCopyOptions: DataGridCopyOptions = upstreamCopyOptions;
const dataGridExportOptions: DataGridExportOptions = upstreamExportOptions;
const dataGridCsvOptions: DataGridCsvOptions = upstreamCsvOptions;
const dataGridScrollOptions: DataGridScrollOptions = upstreamScrollOptions;

const copyOptions = {
  columnIds: ['name', 'score'],
  includeHeaders: false,
  format: 'csv',
  delimiter: ';',
} satisfies DataGridCopyOptions;
const csvOptions = { columnIds: ['name'] } satisfies DataGridCsvOptions;
const exportOptions = {
  fileName: 'people.csv',
  columnIds: ['name'],
} satisfies DataGridExportOptions;
const scrollOptions = { align: 'center' } satisfies DataGridScrollOptions;

void copyOptions;
void csvOptions;
void exportOptions;
void scrollOptions;
void dataGridCopyOptions;
void dataGridExportOptions;
void dataGridCsvOptions;
void dataGridScrollOptions;

void grid.copySelectedRows(upstreamCopyOptions);
grid.exportDataAsCsv(upstreamExportOptions);
void grid.getDataAsCsv(upstreamCsvOptions);
grid.scrollToIndex(0, upstreamScrollOptions);

void grid.copySelectedRows({
  columnIds: ['name', 'score'],
  includeHeaders: false,
  format: 'csv',
  delimiter: ';',
});
void grid.getDataAsCsv({ columnIds: ['name'] });
grid.exportDataAsCsv({ fileName: 'people.csv', columnIds: ['name'] });
grid.scrollToIndex(0, { align: 'center' });
