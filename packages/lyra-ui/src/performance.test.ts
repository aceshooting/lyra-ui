import { fixture, expect, html } from '@open-wc/testing';
import './components/virtual-list/virtual-list.js';
import './components/chart/lite-chart.js';
import './components/heatmap/heatmap.js';
import './components/table/table.js';
import type { LyraVirtualList } from './components/virtual-list/virtual-list.js';
import type { LyraLiteChart, LiteSeries } from './components/chart/lite-chart.js';
import type { LyraHeatmap } from './components/heatmap/heatmap.js';
import type { LyraTable, TableColumn } from './components/table/table.js';

interface BenchmarkResult {
  medianMs: number;
  layoutReads: number;
  domNodes: number;
  heapDelta: number | null;
}

/**
 * These are intentionally broad Chromium budgets: they catch an accidental full-DOM render,
 * repeated layout loop, or unbounded cache while leaving room for slower CI workers. The median
 * over several warmed updates filters out one-off browser scheduling noise.
 */
const BUDGETS = {
  virtualListMs: 120,
  liteChartMs: 120,
  heatmapMs: 140,
  tableMs: 220,
  maxLayoutReads: 250,
  maxHeapGrowth: 32 * 1024 * 1024,
} as const;

async function benchmark(
  host: HTMLElement,
  update: (iteration: number) => void,
  settle: () => Promise<unknown>,
  iterations = 5,
): Promise<BenchmarkResult> {
  await settle();
  const samples: number[] = [];
  let layoutReads = 0;
  const originalRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (...args: Parameters<typeof originalRect>) {
    layoutReads++;
    return originalRect.apply(this, args);
  };
  const beforeHeap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
    ?.usedJSHeapSize;
  try {
    for (let iteration = 0; iteration < iterations; iteration++) {
      const start = performance.now();
      update(iteration);
      await settle();
      samples.push(performance.now() - start);
    }
  } finally {
    Element.prototype.getBoundingClientRect = originalRect;
  }
  const afterHeap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
    ?.usedJSHeapSize;
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    medianMs: sorted[Math.floor(sorted.length / 2)] ?? 0,
    layoutReads,
    domNodes: host.shadowRoot?.querySelectorAll('*').length ?? 0,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : null,
  };
}

function report(name: string, result: BenchmarkResult): void {
  console.info(`[lyra-performance] ${name}`, result);
}

it('keeps virtual-list updates within the large-list budget', async () => {
  const host = (await fixture(html`<lyra-virtual-list style="height: 320px; width: 640px"></lyra-virtual-list>`)) as LyraVirtualList;
  host.rowHeight = '32';
  host.overscan = 4;
  host.renderItem = (item) => html`<span>${item}</span>`;
  const items = Array.from({ length: 10_000 }, (_, index) => `row-${index}`);
  host.items = items;
  const result = await benchmark(host, (iteration) => {
    host.items = items.map((item, index) => (index === iteration ? `${item}-updated` : item));
  }, () => host.updateComplete);
  report('virtual-list/10000', result);
  expect(result.medianMs).to.be.below(BUDGETS.virtualListMs);
  expect(result.domNodes).to.be.below(160);
  expect(result.layoutReads).to.be.at.most(BUDGETS.maxLayoutReads);
  if (result.heapDelta !== null) expect(result.heapDelta).to.be.below(BUDGETS.maxHeapGrowth);
});

it('keeps lite-chart dataset churn within the large-series budget', async () => {
  const host = (await fixture(html`<lyra-lite-chart type="line"></lyra-lite-chart>`)) as LyraLiteChart;
  const labels = Array.from({ length: 1_000 }, (_, index) => `${index}`);
  const data = labels.map((_, index) => Math.sin(index / 24) * 50 + 50);
  const series: LiteSeries[] = [{ label: 'Series', data }];
  host.labels = labels;
  host.datasets = series;
  const result = await benchmark(host, (iteration) => {
    host.datasets = [{ label: 'Series', data: data.map((value, index) => (index === iteration ? value + 1 : value)) }];
  }, () => host.updateComplete);
  report('lite-chart/1000', result);
  expect(result.medianMs).to.be.below(BUDGETS.liteChartMs);
  expect(result.layoutReads).to.be.at.most(BUDGETS.maxLayoutReads);
  if (result.heapDelta !== null) expect(result.heapDelta).to.be.below(BUDGETS.maxHeapGrowth);
});

it('keeps heatmap data churn within the matrix budget', async () => {
  const host = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
  const values = Array.from({ length: 50 }, (_, row) =>
    Array.from({ length: 50 }, (_, column) => row * 50 + column),
  );
  host.rowLabels = values.map((_, index) => `row-${index}`);
  host.colLabels = values[0]!.map((_, index) => `col-${index}`);
  host.values = values;
  const result = await benchmark(host, (iteration) => {
    host.values = values.map((row, rowIndex) =>
      row.map((value, columnIndex) => (rowIndex === iteration ? value + columnIndex : value)),
    );
  }, () => host.updateComplete);
  report('heatmap/50x50', result);
  expect(result.medianMs).to.be.below(BUDGETS.heatmapMs);
  expect(result.layoutReads).to.be.at.most(BUDGETS.maxLayoutReads);
  if (result.heapDelta !== null) expect(result.heapDelta).to.be.below(BUDGETS.maxHeapGrowth);
});

it('keeps table row churn within the large-table budget', async () => {
  const host = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Record<string, string>>;
  const columns: TableColumn<Record<string, string>>[] = [
    { key: 'id', label: 'ID', sticky: true, cell: (row) => row.id },
    { key: 'name', label: 'Name', cell: (row) => row.name },
    { key: 'status', label: 'Status', cell: (row) => row.status },
    { key: 'value', label: 'Value', cell: (row) => row.value },
  ];
  const rows = Array.from({ length: 1_000 }, (_, index) => ({
    id: `${index}`,
    name: `Item ${index}`,
    status: index % 2 ? 'ready' : 'pending',
    value: `${index * 3}`,
  }));
  host.columns = columns;
  host.rows = rows;
  const result = await benchmark(host, (iteration) => {
    host.rows = rows.map((row, index) => (index === iteration ? { ...row, status: 'updated' } : row));
  }, () => host.updateComplete, 3);
  report('table/1000x4', result);
  expect(result.medianMs).to.be.below(BUDGETS.tableMs);
  expect(result.layoutReads).to.be.at.most(BUDGETS.maxLayoutReads);
  if (result.heapDelta !== null) expect(result.heapDelta).to.be.below(BUDGETS.maxHeapGrowth);
});
