import {
  LyraDataGrid,
  type DataGridCopyOptions,
  type DataGridCsvOptions,
  type DataGridExportOptions,
  type DataGridScrollOptions,
} from '../src/lyra.js';

interface Row {
  id: number;
  name: string;
  score: number;
}

declare const grid: LyraDataGrid<Row>;

const copyOptions = {
  columnIds: ['name', 'score'],
  includeHeaders: false,
  format: 'csv',
  delimiter: ';',
  columns: ['name', 'score'],
} satisfies DataGridCopyOptions;
const csvOptions = { columns: ['name'] } satisfies DataGridCsvOptions;
const exportOptions = {
  filename: 'people.csv',
  columns: ['name'],
} satisfies DataGridExportOptions;
const scrollOptions = { align: 'center' } satisfies DataGridScrollOptions;

void copyOptions;
void csvOptions;
void exportOptions;
void scrollOptions;

void grid.copySelectedRows({
  columnIds: ['name', 'score'],
  includeHeaders: false,
  format: 'csv',
  delimiter: ';',
  columns: ['name', 'score'],
});
void grid.getDataAsCsv({ columns: ['name'] });
grid.exportDataAsCsv({ filename: 'people.csv', columns: ['name'] });
grid.scrollToIndex(0, { align: 'center' });
