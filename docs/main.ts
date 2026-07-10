import '../packages/lyra-ui/src/lyra.js';
import { toast } from '../packages/lyra-ui/src/lyra.js';
import type {
  LyraSparkline,
  LyraTable,
  LyraExportButton,
  TableColumn,
} from '../packages/lyra-ui/src/lyra.js';

const data = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
for (const id of ['spark-line', 'spark-area', 'spark-bar']) {
  const el = document.getElementById(id) as LyraSparkline | null;
  if (el) el.values = data;
}

document.getElementById('toast-info')?.addEventListener('click', () => toast('Just so you know'));
document
  .getElementById('toast-success')
  ?.addEventListener('click', () => toast({ message: 'Saved!', variant: 'success' }));
document.getElementById('toast-danger')?.addEventListener('click', () =>
  toast({
    message: 'Item deleted',
    variant: 'danger',
    duration: 0,
    action: { label: 'Undo', onClick: (item) => item.hide() },
  }),
);

interface DemoRow {
  id: string;
  name: string;
  score: number;
}

const demoRows: DemoRow[] = [
  { id: 'a', name: 'Alpha', score: 92 },
  { id: 'b', name: 'Beta', score: 81 },
  { id: 'c', name: 'Gamma', score: 76 },
];

const demoColumns: TableColumn<DemoRow>[] = [
  { key: 'name', label: 'Name', sortable: true, cell: (r) => r.name },
  { key: 'score', label: 'Score', sortable: true, align: 'end', cell: (r) => r.score },
];

const table = document.getElementById('demo-table') as LyraTable<DemoRow> | null;
if (table) {
  table.columns = demoColumns;
  table.rows = demoRows;
}

const exportButton = document.getElementById('demo-export') as LyraExportButton | null;
if (exportButton) {
  exportButton.formats = ['csv', 'json'];
  exportButton.columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'score', label: 'Score' },
  ];
  exportButton.rows = demoRows;
}
