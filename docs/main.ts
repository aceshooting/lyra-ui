import '../packages/lyra-ui/src/lyra.js';
import { toast } from '../packages/lyra-ui/src/lyra.js';
import type {
  LyraSparkline,
  LyraTable,
  LyraExportButton,
  TableColumn,
  LyraTimeRange,
  LyraPlayback,
  LyraHeatmap,
  LyraGraph,
  GraphNode,
  GraphLink,
  LyraTree,
  TreeItem,
  LyraBarChart,
  LyraLineChart,
  LyraPieChart,
  LyraBoxPlot,
  LyraHistogram,
  Series,
  BoxPlotSeries,
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

const timeRange = document.getElementById('demo-time-range') as LyraTimeRange | null;
const timeRangeReadout = document.getElementById('demo-time-range-readout');
if (timeRange && timeRangeReadout) {
  const render = (start: number, end: number): void => {
    timeRangeReadout.textContent = `start: ${start}, end: ${end}`;
  };
  render(timeRange.start, timeRange.end);
  timeRange.addEventListener('lyra-input', (e) => {
    const { start, end } = (e as CustomEvent<{ start: number; end: number }>).detail;
    render(start, end);
  });
}

const playback = document.getElementById('demo-playback') as LyraPlayback | null;
if (playback) {
  playback.loop = true;
}

const heatmap = document.getElementById('demo-heatmap') as LyraHeatmap | null;
if (heatmap) {
  heatmap.rowLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  heatmap.colLabels = ['0h', '6h', '12h', '18h'];
  heatmap.values = [
    [1, 4, 9, 2],
    [0, 2, 6, 3],
    [5, 8, 3, 1],
    [-1, 1, 4, 7],
    [2, 3, 5, 6],
  ];
}

const graph = document.getElementById('demo-graph') as LyraGraph | null;
if (graph) {
  const graphNodes: GraphNode[] = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
    { id: 'd', label: 'D' },
  ];
  const graphLinks: GraphLink[] = [
    { source: 'a', target: 'b' },
    { source: 'a', target: 'c' },
    { source: 'b', target: 'd' },
    { source: 'c', target: 'd' },
  ];
  graph.nodes = graphNodes;
  graph.links = graphLinks;
}

const tree = document.getElementById('demo-tree') as LyraTree | null;
if (tree) {
  const treeData: TreeItem[] = [
    {
      id: '1',
      label: 'Root',
      badge: 2,
      children: [
        { id: '1.1', label: 'Child A' },
        { id: '1.2', label: 'Child B' },
      ],
    },
    { id: '2', label: 'Leaf' },
  ];
  tree.data = treeData;
}

const barChart = document.getElementById('demo-bar-chart') as LyraBarChart | null;
if (barChart) {
  barChart.labels = ['Q1', 'Q2', 'Q3', 'Q4'];
  const barSeries: Series[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
  barChart.datasets = barSeries;
}

const lineChart = document.getElementById('demo-line-chart') as LyraLineChart | null;
if (lineChart) {
  lineChart.labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May'];
  const lineSeries: Series[] = [
    { label: 'Sessions', data: [4, 7, 6, 9, 12], fill: true },
    { label: 'Errors', data: [1, 2, 1, 0, 3], color: '#e5484d' },
  ];
  lineChart.datasets = lineSeries;
}

const pieChart = document.getElementById('demo-pie-chart') as LyraPieChart | null;
if (pieChart) {
  pieChart.labels = ['Chrome', 'Firefox', 'Safari', 'Other'];
  const pieSeries: Series[] = [
    { label: 'Browsers', data: [58, 18, 15, 9], color: ['#5b8def', '#f7b955', '#59c19a', '#b6b8c3'] },
  ];
  pieChart.datasets = pieSeries;
}

const boxPlot = document.getElementById('demo-box-plot') as LyraBoxPlot | null;
if (boxPlot) {
  boxPlot.labels = ['K=2', 'K=3', 'K=4'];
  const boxSeries: BoxPlotSeries[] = [
    {
      label: 'Loss',
      data: [
        { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
        { min: 2, q1: 3, median: 4, q3: 5, max: 6 },
        { min: 1.5, q1: 2.5, median: 3.5, q3: 4.5, max: 6.5 },
      ],
    },
  ];
  boxPlot.boxes = boxSeries;
}

const histogram = document.getElementById('demo-histogram') as LyraHistogram | null;
if (histogram) {
  histogram.values = [2, 4, 4, 5, 6, 6, 6, 7, 8, 9, 9, 10, 11, 12, 12, 13, 15];
}
