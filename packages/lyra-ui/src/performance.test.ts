import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './components/virtual-list/virtual-list.js';
import './components/chart/lite-chart.js';
import './components/heatmap/heatmap.js';
import './components/table/table.js';
import './components/graph/graph.js';
import './components/flow-canvas/flow-canvas.js';
import './components/mind-map/mind-map.js';
import './components/notebook-viewer/notebook-viewer.js';
import './components/dataset-viewer/dataset-viewer.js';
import './components/csv-viewer/csv-viewer.js';
import './components/spreadsheet-viewer/spreadsheet-viewer.js';
import * as XLSX from 'xlsx';
import type { LyraVirtualList } from './components/virtual-list/virtual-list.js';
import type { LyraLiteChart, LiteSeries } from './components/chart/lite-chart.js';
import type { LyraHeatmap } from './components/heatmap/heatmap.js';
import type { LyraTable, TableColumn } from './components/table/table.js';
import type { LyraGraph, GraphNode, GraphLink } from './components/graph/graph.js';
import type { LyraFlowCanvas, FlowNode, FlowEdge, FlowRunDecorations } from './components/flow-canvas/flow-canvas.js';
import type { LyraMindMap, LyraTopic } from './components/mind-map/mind-map.js';
import type { LyraNotebookViewer } from './components/notebook-viewer/notebook-viewer.js';
import type { LyraDatasetViewer } from './components/dataset-viewer/dataset-viewer.js';
import type { LyraCsvViewer } from './components/csv-viewer/csv-viewer.js';
import type { LyraSpreadsheetViewer } from './components/spreadsheet-viewer/spreadsheet-viewer.js';
import type { LyraHighlight } from './components/document-viewer/anchors.js';

/**
 * The stress-scale benchmarks below (graph/flow-canvas in particular) mount hundreds to thousands
 * of `ResizeObserver`-watched elements in a single synchronous batch. Chromium's spec-mandated loop
 * guard can then genuinely fail to deliver every notification within one frame and dispatch a real
 * `ErrorEvent` reading "ResizeObserver loop completed with undelivered notifications" -- a
 * documented, universally-benign browser message (it does not indicate a bug in application code;
 * see e.g. https://stackoverflow.com/q/49384120), not a failure of anything this file asserts on.
 * The test harness treats any such uncaught page error as failing whatever test happens to be
 * running when it lands, so left unfiltered this becomes a source of pure flake uncorrelated with
 * the actual budget assertions below. `preventDefault()` on a capturing `error` listener suppresses
 * the browser's own "report this as an unhandled exception" step (the same flag Chromium's devtools
 * console honors) -- every *other* uncaught error is untouched and still fails its test as before.
 */
window.addEventListener(
  'error',
  (e) => {
    if (typeof e.message === 'string' && e.message.includes('ResizeObserver loop')) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  true,
);

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
  // Observed median across several local runs: ~90-180ms (canvas repaint of 5,000 nodes/10,000
  // links plus the offscreen a11y cursor-item bindings below). Budget leaves ~2-4x headroom over
  // the high end -- generous enough to absorb slow-CI variance, tight enough to catch an
  // accidental O(n^2) scene rebuild or a canvas draw that stopped batching per-frame.
  graphMs: 400,
  // renderer="canvas" keeps its *visible* surface to a single <canvas>, but its a11y layer still
  // renders one offscreen [part="cursor-item"] button per node/link/hull (for keyboard roving) plus
  // one <li> per node/link in the sr-only data-list -- so shadow-DOM size is NOT flat at this scale
  // (observed ~30,000 nodes for 5,000 graph nodes / 10,000 links). Budget only guards against a
  // further multiplication of that (e.g. duplicated cursor-items).
  graphMaxDomNodes: 40_000,
  // Observed median across several local runs: ~80-125ms (pushCardPropsAll() does a
  // querySelector('[node-id="..."]') scan per node -- O(n) DOM queries against 1,000 light-DOM
  // children -- plus the resulting per-card property pushes). ~3x headroom over the high end.
  flowCanvasMs: 350,
  // Observed median across several local runs: ~4-7ms (closed-form radial arithmetic, no physics
  // simulation) -- generous ~20x headroom, matching heatmap's own tolerance for an inherently fast
  // operation, since CI variance can dominate a sub-10ms measurement more than the real cost does.
  mindMapMs: 130,
  // Observed median across several local runs: ~0.3-3ms for a realistic 80-cell notebook (a genuine
  // notebook-scale document, not a stress ceiling -- MAX_CELLS is 2,000). Generous headroom is still
  // useful here: it would catch e.g. a full unvirtualized re-render of every cell's markdown/code
  // block on every notebook reassignment.
  notebookViewerMs: 100,
  // Observed median across several local runs: ~2-3ms (only the ~15-25 currently-visible rows
  // re-run cellHighlightsForRow() against 50 highlights; the other ~8,975 rows stay virtualized).
  // Generous headroom guards against the highlight scan regressing to a full-grid pass.
  datasetViewerMs: 60,
  // Observed median across several local runs: ~2.5-4ms -- same shape as dataset-viewer's budget
  // above (only the virtualized viewport's visible rows re-run the highlight scan).
  csvViewerMs: 60,
  // Observed median across several local runs: ~3-4ms -- same shape as dataset-viewer/csv-viewer
  // above (only the virtualized viewport's visible rows re-run the highlight scan).
  spreadsheetViewerMs: 60,
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

it('keeps canvas-mode graph selection churn within the large-graph budget', async function () {
  // d3-force is lazy-loaded and, with `seed` set, settles synchronously (see graph.class.ts's
  // rebuildSimulation()) rather than animating over ~300 rAF frames -- but that synchronous
  // settle plus the very first 30k-element DOM/canvas paint for 5,000 nodes/10,000 links still
  // needs more headroom than mocha's 6s default, especially on a loaded CI worker. 30s is enough
  // in isolation (~15s) but has been observed to time out under the full ~290-file suite's
  // concurrent Chromium load; doubled for headroom rather than tightened, since this test's job
  // is to catch a real regression in the benchmarked median, not to police wall-clock scheduling
  // noise from unrelated files running at the same time.
  this.timeout(60000);
  const GRAPH_NODE_COUNT = 5_000;
  const GRAPH_LINK_COUNT = 10_000;
  const host = (await fixture(
    html`<lyra-graph
      renderer="canvas"
      seed="1"
      selection-mode="multiple"
      width="960"
      height="640"
      style="width:960px;height:640px"
    ></lyra-graph>`,
  )) as LyraGraph;
  const nodes: GraphNode[] = Array.from({ length: GRAPH_NODE_COUNT }, (_, index) => ({
    id: `n${index}`,
    label: `Node ${index}`,
  }));
  const links: GraphLink[] = Array.from({ length: GRAPH_LINK_COUNT }, (_, index) => ({
    source: `n${index % GRAPH_NODE_COUNT}`,
    target: `n${(index * 7 + 1) % GRAPH_NODE_COUNT}`,
  }));
  host.nodes = nodes;
  host.links = links;
  await waitUntil(() => !!host.shadowRoot!.querySelector('canvas'), undefined, { timeout: 20000 });
  const result = await benchmark(
    host,
    (iteration) => {
      host.selectedNodeIds = [nodes[iteration % nodes.length]!.id];
    },
    async () => {
      await host.updateComplete;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    },
    3,
  );
  report('graph/5000x10000-canvas', result);
  expect(result.medianMs).to.be.below(BUDGETS.graphMs);
  expect(result.domNodes).to.be.below(BUDGETS.graphMaxDomNodes);
  expect(result.layoutReads).to.be.at.most(BUDGETS.maxLayoutReads);
  if (result.heapDelta !== null) expect(result.heapDelta).to.be.below(BUDGETS.maxHeapGrowth);
});

it('keeps flow-canvas decoration churn within the large-flow budget', async function () {
  this.timeout(20000);
  const FLOW_NODE_COUNT = 1_000;
  const COLUMNS = 20;
  const host = (await fixture(
    html`<lyra-flow-canvas style="width: 960px; height: 640px"></lyra-flow-canvas>`,
  )) as LyraFlowCanvas;
  // Explicit `position` on every node so willUpdate()'s auto-layout pass is a documented no-op --
  // this benchmark targets the component's own decoration-push/render cost, not the (separately
  // deterministic, O(n)) layered auto-layout algorithm.
  const nodes: FlowNode[] = Array.from({ length: FLOW_NODE_COUNT }, (_, index) => ({
    id: `n${index}`,
    position: { x: (index % COLUMNS) * 220, y: Math.floor(index / COLUMNS) * 120 },
    data: { label: `Step ${index}` },
  }));
  const edges: FlowEdge[] = Array.from({ length: FLOW_NODE_COUNT - 1 }, (_, index) => ({
    id: `e${index}`,
    source: `n${index}`,
    target: `n${index + 1}`,
  }));
  host.nodes = nodes;
  host.edges = edges;
  await host.updateComplete;
  await waitUntil(() => host.querySelectorAll('lyra-flow-node').length === FLOW_NODE_COUNT);
  const result = await benchmark(
    host,
    (iteration) => {
      const status = iteration % 2 === 0 ? 'running' : 'success';
      const decorations: FlowRunDecorations = {};
      for (const node of nodes) decorations[node.id] = { status, progress: iteration / 5 };
      host.decorations = decorations;
    },
    () => host.updateComplete,
    3,
  );
  report('flow-canvas/1000x999', result);
  expect(result.medianMs).to.be.below(BUDGETS.flowCanvasMs);
  expect(result.layoutReads).to.be.at.most(BUDGETS.maxLayoutReads);
  if (result.heapDelta !== null) expect(result.heapDelta).to.be.below(BUDGETS.maxHeapGrowth);
});

/** Builds a single-root `count`-topic tree, each node fanning out to `branching` children --
 *  breadth-first, so the tree stays balanced (depth ~log_branching(count)) instead of one long
 *  chain. Mirrors a realistic large mind map (many shallow branches), not a graph's dense mesh. */
function buildMindMapTopics(count: number, branching: number): LyraTopic[] {
  const nodes: LyraTopic[] = Array.from({ length: count }, (_, index) => ({ id: `t${index}`, label: `Topic ${index}` }));
  for (let i = 1; i < count; i++) {
    const parent = nodes[Math.floor((i - 1) / branching)]!;
    (parent.children ??= []).push(nodes[i]!);
  }
  return [nodes[0]!];
}

it('keeps mind-map topic churn within the large-map budget', async () => {
  const TOPIC_COUNT = 1_000;
  const host = (await fixture(html`<lyra-mind-map expand-depth="99"></lyra-mind-map>`)) as LyraMindMap;
  const topics = buildMindMapTopics(TOPIC_COUNT, 5);
  host.topics = topics;
  await host.updateComplete;
  await waitUntil(() => host.shadowRoot!.querySelectorAll('[part="node"]').length === TOPIC_COUNT);
  const result = await benchmark(
    host,
    (iteration) => {
      host.topics = topics.map((topic, index) => (index === 0 ? { ...topic, label: `Topic 0 (${iteration})` } : topic));
    },
    () => host.updateComplete,
  );
  report('mind-map/1000', result);
  expect(result.medianMs).to.be.below(BUDGETS.mindMapMs);
  expect(result.layoutReads).to.be.at.most(BUDGETS.maxLayoutReads);
  if (result.heapDelta !== null) expect(result.heapDelta).to.be.below(BUDGETS.maxHeapGrowth);
});

/** A Jupyter-notebook-shaped (nbformat 4.x) document alternating markdown/code cells, each code
 *  cell carrying a small stdout output -- a realistic notebook size (tens of cells), not
 *  `notebook-viewer.class.ts`'s hard MAX_CELLS=2000 safety ceiling. */
function buildNotebook(cellCount: number, revision = 0): { nbformat: number; nbformat_minor: number; metadata: Record<string, unknown>; cells: Record<string, unknown>[] } {
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: { language_info: { name: 'python' } },
    cells: Array.from({ length: cellCount }, (_, index) =>
      index % 2 === 0
        ? { cell_type: 'markdown', id: `md${index}`, source: [`## Section ${index} (rev ${revision})\n`, 'Some narrative text.'], metadata: {} }
        : {
            cell_type: 'code',
            id: `code${index}`,
            source: `print("step ${index}")`,
            execution_count: index,
            metadata: {},
            outputs: [{ output_type: 'stream', name: 'stdout', text: `step ${index}\n` }],
          },
    ),
  };
}

/** `<lyra-virtual-list>`'s rendered cells live in its own nested shadow root, composed from
 *  `renderCell()`'s TemplateResult -- mirrors notebook-viewer.test.ts's identical `rowRoot()` helper. */
function notebookRowRoot(el: LyraNotebookViewer): ShadowRoot {
  return el.shadowRoot!.querySelector('lyra-virtual-list')!.shadowRoot!;
}

it('keeps notebook-viewer cell churn within the notebook-scale budget', async () => {
  const CELL_COUNT = 80;
  const host = (await fixture(
    html`<lyra-notebook-viewer max-height="480px" style="width: 720px"></lyra-notebook-viewer>`,
  )) as LyraNotebookViewer;
  host.notebook = buildNotebook(CELL_COUNT, 0);
  await host.updateComplete;
  await waitUntil(() => notebookRowRoot(host).querySelectorAll('[part="cell"]').length > 0);
  const result = await benchmark(
    host,
    (iteration) => {
      host.notebook = buildNotebook(CELL_COUNT, iteration + 1);
    },
    () => host.updateComplete,
  );
  report('notebook-viewer/80-cells', result);
  expect(result.medianMs).to.be.below(BUDGETS.notebookViewerMs);
  expect(result.layoutReads).to.be.at.most(BUDGETS.maxLayoutReads);
  if (result.heapDelta !== null) expect(result.heapDelta).to.be.below(BUDGETS.maxHeapGrowth);
});

// -- fetch-based grid viewers (dataset-viewer / csv-viewer / spreadsheet-viewer) ------------------
//
// These three compose <lyra-virtual-list> for their body rows (per an earlier audit finding), so
// the budget below targets each viewer's OWN per-row work -- resolving `highlights` against the
// parsed grid inside `renderRow()` -- layered on top of virtual-list's already-covered cost, not
// virtual-list's own virtualization (see the `virtual-list/10000` benchmark above for that).
//
// A resource guard (`assertTableSize`/`assertTableDimensions`, `resource-loader.ts`) rejects a
// parsed grid over 10,000 rows -- GRID_ROW_COUNT stays comfortably under that ceiling while still
// matching the `virtual-list/10000` benchmark's "realistic large document" scale.
const GRID_ROW_COUNT = 9_000;
const GRID_HIGHLIGHT_COUNT = 50;

/** Stubs `window.fetch` to resolve every call with `body`, restoring the original on the returned
 *  callback -- mirrors dataset-viewer.test.ts/csv-viewer.test.ts's identical `fetchText()` helper. */
function mockFetchText(body: string): () => void {
  const original = window.fetch;
  window.fetch = (() =>
    Promise.resolve({ ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(body) } as Response)) as typeof window.fetch;
  return () => {
    window.fetch = original;
  };
}

/** `count` highlights spread evenly across `rowCount` data rows, one A1-notation single-row range
 *  each -- large enough that `cellHighlightsForRow()`'s per-visible-row `this.highlights.flatMap()`
 *  scan (run for every row `<lyra-virtual-list>` currently renders) is doing genuine work, not a
 *  1-entry no-op. `revision` only changes each entry's `label`, matching the other benchmarks'
 *  "reassign the whole structure, one field changed" churn convention. */
function buildGridHighlights(count: number, rowCount: number, revision: number): LyraHighlight[] {
  return Array.from({ length: count }, (_, index) => {
    const row = 2 + Math.floor((index / count) * rowCount); // +2: past the always-present header row
    return { id: `h${index}`, anchor: { kind: 'cell-range', range: `A${row}:D${row}` }, label: `Highlight ${index} (rev ${revision})` };
  });
}

it('keeps dataset-viewer highlight churn within the large-dataset budget', async () => {
  const header = 'name\trole\tstatus\tvalue';
  const rows = Array.from({ length: GRID_ROW_COUNT }, (_, index) => `Person ${index}\tRole ${index % 12}\t${index % 2 ? 'active' : 'idle'}\t${index * 3}`);
  const restore = mockFetchText([header, ...rows].join('\n'));
  let host!: LyraDatasetViewer;
  try {
    host = (await fixture(html`<lyra-dataset-viewer style="width: 720px"></lyra-dataset-viewer>`)) as LyraDatasetViewer;
    host.src = 'https://example.test/perf.tsv';
    await waitUntil(() => host.shadowRoot!.querySelector('[part="table"]') !== null, undefined, { timeout: 5000 });
    const result = await benchmark(
      host,
      (iteration) => {
        host.highlights = buildGridHighlights(GRID_HIGHLIGHT_COUNT, GRID_ROW_COUNT, iteration);
      },
      () => host.updateComplete,
    );
    report('dataset-viewer/9000-rows', result);
    expect(result.medianMs).to.be.below(BUDGETS.datasetViewerMs);
    expect(result.layoutReads).to.be.at.most(BUDGETS.maxLayoutReads);
    if (result.heapDelta !== null) expect(result.heapDelta).to.be.below(BUDGETS.maxHeapGrowth);
  } finally {
    restore();
  }
});

it('keeps csv-viewer highlight churn within the large-csv budget', async () => {
  const rows = [
    'name,role,status,value',
    ...Array.from({ length: GRID_ROW_COUNT }, (_, index) => `Person ${index},Role ${index % 12},${index % 2 ? 'active' : 'idle'},${index * 3}`),
  ];
  const restore = mockFetchText(rows.join('\n'));
  let host!: LyraCsvViewer;
  try {
    host = (await fixture(html`<lyra-csv-viewer style="width: 720px"></lyra-csv-viewer>`)) as LyraCsvViewer;
    host.src = 'https://example.test/perf.csv';
    await waitUntil(() => host.shadowRoot!.querySelector('[part="sheet"]') !== null, undefined, { timeout: 5000 });
    const result = await benchmark(
      host,
      (iteration) => {
        host.highlights = buildGridHighlights(GRID_HIGHLIGHT_COUNT, GRID_ROW_COUNT, iteration);
      },
      () => host.updateComplete,
    );
    report('csv-viewer/9000-rows', result);
    expect(result.medianMs).to.be.below(BUDGETS.csvViewerMs);
    expect(result.layoutReads).to.be.at.most(BUDGETS.maxLayoutReads);
    if (result.heapDelta !== null) expect(result.heapDelta).to.be.below(BUDGETS.maxHeapGrowth);
  } finally {
    restore();
  }
});

/** Builds an in-memory `.xlsx` workbook's raw bytes via SheetJS -- mirrors
 *  spreadsheet-viewer.test.ts's identical `buffer()` helper. */
function buildXlsxBuffer(rows: unknown[][]): ArrayBuffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
  const binary = XLSX.write(book, { type: 'binary', bookType: 'xlsx' }) as string;
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i) & 255;
  return result.buffer;
}

/** Stubs `window.fetch` to resolve every call with `body` as an `arrayBuffer()` response -- mirrors
 *  spreadsheet-viewer.test.ts's identical `fetchBuffer()` helper. */
function mockFetchArrayBuffer(body: ArrayBuffer): () => void {
  const original = window.fetch;
  window.fetch = (() =>
    Promise.resolve({ ok: true, status: 200, statusText: 'OK', arrayBuffer: () => Promise.resolve(body) } as Response)) as typeof window.fetch;
  return () => {
    window.fetch = original;
  };
}

it('keeps spreadsheet-viewer highlight churn within the large-workbook budget', async function () {
  // Encoding ~9,000 rows to SheetJS's binary-string XLSX format is itself real (one-time, outside
  // the timed benchmark loop) work -- more headroom than mocha's 6s default.
  this.timeout(20000);
  const header = ['name', 'role', 'status', 'value'];
  const rows = [header, ...Array.from({ length: GRID_ROW_COUNT }, (_, index) => [`Person ${index}`, `Role ${index % 12}`, index % 2 ? 'active' : 'idle', index * 3])];
  const restore = mockFetchArrayBuffer(buildXlsxBuffer(rows));
  let host!: LyraSpreadsheetViewer;
  try {
    host = (await fixture(html`<lyra-spreadsheet-viewer style="width: 720px"></lyra-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    host.src = 'https://example.test/perf.xlsx';
    await waitUntil(() => host.shadowRoot!.querySelector('[part="sheet"]') !== null, undefined, { timeout: 10000 });
    const result = await benchmark(
      host,
      (iteration) => {
        host.highlights = buildGridHighlights(GRID_HIGHLIGHT_COUNT, GRID_ROW_COUNT, iteration);
      },
      () => host.updateComplete,
    );
    report('spreadsheet-viewer/9000-rows', result);
    expect(result.medianMs).to.be.below(BUDGETS.spreadsheetViewerMs);
    expect(result.layoutReads).to.be.at.most(BUDGETS.maxLayoutReads);
    if (result.heapDelta !== null) expect(result.heapDelta).to.be.below(BUDGETS.maxHeapGrowth);
  } finally {
    restore();
  }
});
