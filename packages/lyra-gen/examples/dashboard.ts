/** Host application composition; source authorization and durable storage stay with the application. */
import { html, render } from 'lit';
import { LyraDashboardGrid } from '@aceshooting/lyra-ui/components/lr-dashboard-grid.js';
import type { LyraTable } from '@aceshooting/lyra-ui/components/lr-table.js';
import type { LyraLiteChart } from '@aceshooting/lyra-ui/components/lr-lite-chart.js';
import { DashboardGridBinding, bindDashboardSelection, type DashboardLayoutState } from '@aceshooting/lyra-gen/dashboard-binding.js';
import { DashboardNavigation, SharedDashboardState, dashboardPageWindow } from '@aceshooting/lyra-gen/dashboard.js';
import { DashboardDataQueue, LiveDataController, resolveDashboardLineage, type DashboardQueryResult, type DashboardSourceRecord, type DashboardDataSnapshot, type DashboardQueryContext, type HostQueryRegistry } from '@aceshooting/lyra-gen/live-data.js';
import { initialCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { validateSchema } from '@aceshooting/lyra-gen/schema.js';
import type { LyraGenView } from '@aceshooting/lyra-gen/types.js';

export interface DashboardExampleRow { readonly c0: string; readonly c1: number }
export interface DashboardExampleOptions {
  readonly registry: HostQueryRegistry;
  readonly context: DashboardQueryContext;
  readonly query: string;
  readonly layout?: DashboardLayoutState;
  readonly pageSize?: number;
  readonly totalRows?: number;
  /** Source availability is resolved for the current viewer, including on every activation. */
  readonly sources?: {
    readonly available: (source: DashboardSourceRecord) => boolean;
    readonly activate: (source: DashboardSourceRecord) => void;
    readonly label: string;
    readonly unverified: string;
    readonly citation: (source: DashboardSourceRecord) => string;
  };
  readonly persist?: (next: DashboardLayoutState, previous: DashboardLayoutState, signal: AbortSignal) => boolean | Promise<boolean>;
  /** Omitted means activation selects only. The host independently authorizes every detail entry. */
  readonly authorizeDrilldown?: (recordId: string) => boolean | Promise<boolean>;
  /** Applications supply translated, viewer-appropriate presentation strings. */
  readonly labels: {
    readonly title: string; readonly table: string; readonly chart: string; readonly note: string;
    readonly refresh: string; readonly cancel: string; readonly pin: string; readonly unpin: string;
    readonly category: string; readonly value: string; readonly sharedFilter: string;
    readonly previous: string; readonly next: string; readonly overview: string; readonly back: string;
    readonly navigationDenied: string;
    readonly detail: (row: DashboardExampleRow) => string;
    readonly page: (page: { readonly requestedOffset: number; readonly shownOffset: number; readonly limit: number; readonly stale: boolean }) => string;
    readonly selection: (ids: readonly string[]) => string;
    readonly queue: (metrics: { readonly items: number; readonly dropped: number }) => string;
    readonly provenance: (snapshot: DashboardDataSnapshot) => string;
    readonly layoutError: (code: 'invalid-layout' | 'save-failed') => string;
    readonly status: (snapshot: DashboardDataSnapshot) => string;
  };
}
const emptyRows: readonly DashboardExampleRow[] = [];
export function mountLiveDashboard(root: HTMLElement, options: DashboardExampleOptions) {
  let revision = 0;
  let rows = emptyRows;
  let disposed = false;
  let detailRowId: string | undefined;
  let shownResult: DashboardQueryResult | undefined;
  let requestGeneration = 0;
  let offset = 0;
  let shownOffset = 0;
  let returnFocus: HTMLElement | undefined;
  let returnPanel = 'table';
  let selection: ReturnType<typeof bindDashboardSelection<DashboardExampleRow>> | undefined;
  const pageSize = dashboardPageWindow(0, options.pageSize ?? 20, 100, options.totalRows).limit || 1;
  const grid = new LyraDashboardGrid();
  grid.accessibleLabel = options.labels.title;
  grid.rowHeight = 100;
  const overview = root.ownerDocument.createElement('section');
  const breadcrumbs = root.ownerDocument.createElement('nav');
  breadcrumbs.setAttribute('aria-label', options.labels.overview);
  const detail = root.ownerDocument.createElement('section');
  detail.hidden = true;
  const detailTitle = root.ownerDocument.createElement('h2'); detailTitle.tabIndex = -1;
  const detailValue = root.ownerDocument.createElement('p');
  const detailSources = root.ownerDocument.createElement('div'); detail.append(detailTitle, detailValue, detailSources);
  const status = root.ownerDocument.createElement('p'); status.setAttribute('role', 'status');
  const selected = root.ownerDocument.createElement('p');
  const queued = root.ownerDocument.createElement('output');
  const provenance = root.ownerDocument.createElement('p');
  const valueSources = root.ownerDocument.createElement('section');
  if (options.sources) valueSources.setAttribute('aria-label', options.sources.label);
  const layoutStatus = root.ownerDocument.createElement('p'); layoutStatus.setAttribute('role', 'status');
  const live = new LiveDataController(options.registry, options.context);
  const shared = new SharedDashboardState((_scope, filters) => Object.values(filters).every(value => typeof value === 'string'));
  const queue = new DashboardDataQueue<number>({ maxItems: 4, maxBytes: 64, batchSize: 2, overflow: 'drop-oldest' });
  const navigation = new DashboardNavigation(destination => destination === 'overview' || (destination.startsWith('detail:') && Boolean(options.authorizeDrilldown) ? options.authorizeDrilldown!(decodeURIComponent(destination.slice(7))) : false));
  const parentFrame = () => ({ destination: 'overview', label: options.labels.overview, state: { filters: shared.snapshot('query').filters, selection: [...shared.snapshot('records').selection], offset }, scroll: { inline: root.scrollLeft, block: root.scrollTop } });
  const navReady = navigation.enter(parentFrame());
  const document = (kind: 'table' | 'chart'): LyraGenView => ({ version: '1', surfaceId: kind, revision, catalog: { id: initialCatalog.id, version: initialCatalog.version }, root: kind === 'table' ? {
    id: 'table-root', type: 'stack', children: [
      { id: 'note', type: 'input', props: { label: options.labels.note, value: '', name: 'note' }, bindings: { value: '/note' } },
      { id: 'records', type: 'table', props: { caption: options.labels.table, columns: [{ key: 'c0', label: options.labels.category }, { key: 'c1', label: options.labels.value }], rows: rows.map(row => ({ ...row })), pageSize: 100 } },
    ],
  } : { id: 'summary', type: 'chart', props: { label: options.labels.chart, type: 'bar', labels: rows.map(row => row.c0), datasets: [{ label: options.labels.value, data: rows.map(row => row.c1) }], withDataTable: true } } });
  const initialState: DashboardLayoutState = options.layout ?? { version: 1, revision: 0, panels: [{ id: 'table', column: 0, row: 0, width: 3, height: 4 }, { id: 'chart', column: 3, row: 0, width: 3, height: 4 }] };
  const binding = new DashboardGridBinding({ grid, catalog: initialCatalog, panels: [{ id: 'table', view: document('table') }, { id: 'chart', view: document('chart') }], state: initialState,
    constraints: { columns: 6, maxRows: 20, maxPanels: 4, collision: 'reject' }, persist: options.persist, onError: code => { layoutStatus.textContent = options.labels.layoutError(code); } });
  const toolbar = root.ownerDocument.createElement('div');
  const hasNext = () => rows.length === pageSize && (options.totalRows === undefined || offset + pageSize < options.totalRows);
  const paintBreadcrumbs = () => render(html`<span>${options.labels.overview}</span>${detail.hidden ? '' : html`<span aria-hidden="true"> / </span><span aria-current="page">${detailTitle.textContent}</span><button type="button" data-action="back" @click=${() => { void back(); }}>${options.labels.back}</button>`}`, breadcrumbs);
  const paintToolbar = () => render(html`<button type="button" @click=${() => { void refresh(); }}>${options.labels.refresh}</button>
    <button type="button" @click=${() => live.cancel()}>${options.labels.cancel}</button>
    <button type="button" aria-pressed=${binding.state.panels.find(panel => panel.id === 'table')?.pinned ? 'true' : 'false'} @click=${async () => {
      const pinned = binding.state.panels.find(panel => panel.id === 'table')?.pinned;
      await binding.setPinned('table', !pinned); if (!disposed) paintToolbar();
    }}>${binding.state.panels.find(panel => panel.id === 'table')?.pinned ? options.labels.unpin : options.labels.pin}</button>
    <label>${options.labels.sharedFilter}<input type="search" name="category" .value=${String(shared.snapshot('query').filters['category'] ?? '')} @change=${(event: Event) => {
      shared.update('query', 'filter', { filters: { category: (event.currentTarget as HTMLInputElement).value } }); offset = 0; void refresh();
    }}></label>
    <button type="button" data-action="previous" ?disabled=${offset === 0 || live.snapshot.status === 'loading'} @click=${() => { offset = Math.max(0, offset - pageSize); void refresh(); }}>${options.labels.previous}</button>
    <button type="button" data-action="next" ?disabled=${!hasNext() || live.snapshot.status === 'loading'} @click=${() => { offset += pageSize; void refresh(); }}>${options.labels.next}</button>
    <output data-page>${options.labels.page({ requestedOffset: offset, shownOffset, limit: pageSize, stale: live.snapshot.stale })}</output>`, toolbar);
  root.append(breadcrumbs, overview, detail);
  overview.append(toolbar, status, layoutStatus, provenance, selected, queued, grid, valueSources);
  const paintSources = () => {
    const sources = options.sources;
    if (!sources) return;
    const result = shownResult;
    const sourceFor = (pointer: string) => {
      const grounded = result && resolveDashboardLineage(result, pointer);
      if (!grounded || !grounded.verified || !grounded.source) return undefined;
      try { return sources.available(grounded.source) ? grounded.source : undefined; } catch { return undefined; }
    };
    const valueDetail = (row: DashboardExampleRow, index: number) => {
      const pointer = `/${index}/c1`;
      const source = sourceFor(pointer);
      return html`<p data-value-pointer=${pointer}><span>${row.c0}: ${row.c1}</span> ${source
        ? html`<button type="button" @click=${() => {
          if (disposed || shownResult !== result || rows[index] !== row) return;
          const current = sourceFor(pointer);
          if (!current || disposed || shownResult !== result || rows[index] !== row) { paintSources(); return; }
          sources.activate(current);
        }}>${sources.citation(source)}</button>`
        : html`<span data-unverified>${sources.unverified}</span>`}</p>`;
    };
    render(html`${rows.map(valueDetail)}`, valueSources);
    const index = rows.findIndex(row => row.c0 === detailRowId);
    render(index < 0 ? html`` : valueDetail(rows[index]!, index), detailSources);
  };
  const cleanups: (() => void)[] = [];
  let boundTable: LyraTable<DashboardExampleRow, string> | undefined;
  let boundChart: LyraLiteChart | undefined;
  const releaseControls = () => {
    selection?.dispose(); selection = undefined;
    for (const cleanup of cleanups.splice(0)) cleanup();
    boundTable = undefined; boundChart = undefined;
  };
  const controls = () => {
    if (disposed) return;
    const tableView = binding.panel('table'), chartView = binding.panel('chart');
    const table = tableView?.shadowRoot?.querySelector<LyraTable<DashboardExampleRow, string>>(`${initialCatalog.components['table']!.tag}[data-gen-id="records"]`);
    const chart = chartView?.shadowRoot?.querySelector<LyraLiteChart>(`${initialCatalog.components['chart']!.tag}[data-gen-id="summary"]`);
    if (selection && (table !== boundTable || chart !== boundChart)) releaseControls();
    if (tableView?.status !== 'ready' || chartView?.status !== 'ready') return;
    if (table && chart && !selection) {
      boundTable = table; boundChart = chart;
      selection = bindDashboardSelection({ table, chart, shared, scope: 'records', rowId: row => row.c0, keys: rows.map(row => row.c0), onSelection: snapshot => { selected.textContent = options.labels.selection(snapshot.selection); chart.description = selected.textContent; } });
      if (options.authorizeDrilldown) {
        const onTable = (event: Event) => { const row = (event as CustomEvent<{ row: DashboardExampleRow }>).detail.row; void drilldown(row.c0, event.composedPath()[0] as HTMLElement); };
        const onChart = (event: Event) => { const index = (event as CustomEvent<{ index: number }>).detail.index; const row = rows[index]; if (row) void drilldown(row.c0, event.composedPath()[0] as HTMLElement, 'chart'); };
        table.addEventListener('lr-row-activate', onTable); chart.addEventListener('lr-datum-activate', onChart);
        cleanups.push(() => { table.removeEventListener('lr-row-activate', onTable); chart.removeEventListener('lr-datum-activate', onChart); });
      }
    }
    // This example's query returns its complete selected page. Preserve known selection across pages.
    selection?.setKeys(rows.map(row => row.c0), options.totalRows === undefined && offset === 0 && rows.length < pageSize ? new Set(rows.map(row => row.c0)) : undefined);
  };
  // A catalog replacement can settle without another ready event for the same revision.
  const controlReadiness = new MutationObserver(controls);
  for (const id of ['table', 'chart']) controlReadiness.observe(binding.panel(id)!, { attributes: true, attributeFilter: ['aria-busy'] });
  const updateRows = async (snapshot: DashboardDataSnapshot, pageOffset: number) => {
    const checked = validateSchema(snapshot.result?.data, { type: 'array', maxItems: pageSize, items: { type: 'object', properties: { c0: { type: 'string', minLength: 1, maxLength: 256 }, c1: { type: 'number' } }, required: ['c0', 'c1'], additionalProperties: false } });
    if (!checked.ok) { status.textContent = options.labels.status({ ...snapshot, status: 'error', stale: true, error: 'invalid-result' }); return; }
    const next = checked.value as unknown as readonly DashboardExampleRow[];
    if (new Set(next.map(row => row.c0)).size !== next.length) { status.textContent = options.labels.status({ ...snapshot, status: 'error', stale: true, error: 'invalid-result' }); return; }
    rows = next; shownResult = snapshot.result; shownOffset = pageOffset; revision++; paintSources();
    binding.updatePanel('table', document('table')); binding.updatePanel('chart', document('chart'));
    await Promise.all([binding.panel('table')!.updateComplete, binding.panel('chart')!.updateComplete]);
    if (!disposed) controls();
  };
  async function refresh() {
    const generation = ++requestGeneration;
    const window = dashboardPageWindow(offset, pageSize, 100, options.totalRows);
    const snapshot = await live.refresh(options.query, { ...shared.snapshot('query').filters, offset: window.offset, limit: window.limit || 1 });
    if (!disposed && generation === requestGeneration && ['ready', 'empty', 'partial'].includes(snapshot.status)) await updateRows(snapshot, window.offset);
    if (!disposed) paintToolbar();
    return snapshot;
  }
  async function drilldown(id: string, focus?: HTMLElement, panelId = 'table'): Promise<boolean> {
    await navReady;
    const row = rows.find(record => record.c0 === id);
    if (!row || disposed || !detail.hidden || !options.authorizeDrilldown) return false;
    const parent = parentFrame();
    let allowed = false;
    try { allowed = await navigation.enter({ destination: `detail:${encodeURIComponent(id)}`, label: options.labels.detail(row), state: {}, scroll: { inline: 0, block: 0 } }, parent); } catch { allowed = false; }
    if (!allowed || disposed || !rows.some(record => record.c0 === id)) { if (!disposed) layoutStatus.textContent = options.labels.navigationDenied; return false; }
    requestGeneration++; if (live.snapshot.status === 'loading') live.cancel(); returnFocus = focus; returnPanel = panelId;
    detailRowId = row.c0; paintSources();
    detailTitle.textContent = options.labels.detail(row); detailValue.textContent = `${options.labels.value}: ${row.c1}`;
    overview.hidden = true; overview.inert = true; detail.hidden = false; paintBreadcrumbs(); detailTitle.focus({ preventScroll: true });
    return true;
  }
  async function back(): Promise<boolean> {
    const parent = await navigation.back();
    if (!parent || disposed) return false;
    detailRowId = undefined; paintSources();
    detail.hidden = true; overview.hidden = false; overview.inert = false; paintBreadcrumbs();
    root.scrollLeft = parent.scroll.inline; root.scrollTop = parent.scroll.block;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    let focused = root.ownerDocument.activeElement;
    while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
    if (!returnFocus || focused !== returnFocus) binding.focusPanel(returnPanel);
    returnFocus = undefined;
    return true;
  }
  const off = live.subscribe(snapshot => {
    status.textContent = options.labels.status(snapshot); provenance.textContent = options.labels.provenance(snapshot);
    grid.setAttribute('aria-busy', snapshot.status === 'loading' ? 'true' : 'false');
    if (!snapshot.result && (snapshot.status === 'denied' || snapshot.status === 'idle')) {
      rows = []; shownResult = undefined; detailRowId = undefined; paintSources(); selection?.setKeys([], new Set()); shared.update('query', 'context', { filters: {} }); offset = 0; shownOffset = 0; revision++; requestGeneration++;
      binding.panel('table')!.bindingState = {}; binding.panel('chart')!.bindingState = {};
      binding.updatePanel('table', document('table')); binding.updatePanel('chart', document('chart'));
      detailTitle.textContent = ''; detailValue.textContent = ''; detail.hidden = true; overview.hidden = false; overview.inert = false;
      navigation.reset(); void navigation.enter(parentFrame()); paintBreadcrumbs();
    }
    paintToolbar();
  });
  paintToolbar(); paintBreadcrumbs();
  const ready = Promise.all([binding.panel('table')!.updateComplete, binding.panel('chart')!.updateComplete]).then(async () => {
    await Promise.all(['table', 'chart', 'input'].map(type => initialCatalog.components[type]!.load!()));
    await Promise.all([binding.panel('table')!.updateComplete, binding.panel('chart')!.updateComplete]);
    if (!disposed) controls();
  });
  return { grid, binding, live, shared, navigation, overview, breadcrumbs, detail, detailSources, status, layoutStatus, provenance, valueSources, selected, queued, ready, refreshSources: paintSources, refresh, drilldown, back, queue,
    enqueue(sequence: number) { const accepted = queue.push(sequence); queued.textContent = options.labels.queue(queue.metrics); return accepted; },
    /** One pull batch requests at most one refresh; host transport decides when another batch is ready. */
    async flush() { const batch = queue.takeBatch(); if (batch.length) await refresh(); queued.textContent = options.labels.queue(queue.metrics); return batch.length; },
    dispose() { disposed = true; requestGeneration++; off(); controlReadiness.disconnect(); releaseControls(); navigation.reset(); binding.dispose(); live.dispose(); shared.dispose(); queue.dispose(); overview.remove(); breadcrumbs.remove(); detail.remove(); } };
}
