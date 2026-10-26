import { createViewDefinition, createViewCatalog, assertViewSemantics, waitForChartGeometry } from './views.js';
import { announceCommit, delay, settle, visible } from './text.js';

const require = (condition, message) => { if (!condition) throw new Error(message); };
const encode = JSON.stringify;
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const SAVED_CATALOG = Object.freeze({ id: 'profile-saved-dashboard', version: '1' });
export const SAVED_SOURCE = Object.freeze({ id: 'report', source: 'reviewed-report' });
export const createSavedCatalog = library => createViewCatalog({ ...library, initialCatalog: { ...library.initialCatalog, ...SAVED_CATALOG } });
export const createLiveUniverse = () => Array.from({ length: 1000 }, (_, index) => ({ c0: `${index < 50 ? 'Focus' : 'Record'}-${String(index).padStart(3, '0')}`, c1: index + 1 }));
export function liveQueryResult(universe, { offset = 0, limit = 100, category = '' } = {}) {
  require(Number.isSafeInteger(offset) && offset >= 0 && Number.isSafeInteger(limit) && limit > 0 && limit <= 100 && typeof category === 'string', 'Invalid fixture query.');
  const data = universe.filter(row => row.c0.includes(category)).slice(offset, offset + limit).map(row => ({ ...row }));
  return { data, sources: [{ id: 'report-source', label: 'Reviewed report', updatedAt: 1700000000000 }],
    lineage: Object.fromEntries(data.flatMap((_row, index) => [[`/${index}/c0`, 'report-source'], [`/${index}/c1`, 'report-source']])), sampled: false, aggregation: 'raw' };
}
const findNode = (definition, id) => {
  const visit = node => node.id === id ? node : node.children?.map(visit).find(Boolean);
  const result = visit(definition.root); require(result, `Missing fixture node ${id}.`); return result;
};
export function createSavedDefinition(title = 'Saved report') {
  const view = createViewDefinition('V', { surfaceId: 'saved-report' });
  view.catalog = { ...SAVED_CATALOG };
  findNode(view, 'table').props.rows = [];
  findNode(view, 'chart').props.labels = []; findNode(view, 'chart').props.datasets = [];
  return { format: 'lyra-dashboard', version: 1, title, view, dataSources: [{ ...SAVED_SOURCE }] };
}
export function createSavedSource() {
  const view = createViewDefinition('V');
  const chart = findNode(view, 'chart').props;
  return { rows: findNode(view, 'table').props.rows, labels: chart.labels, datasets: chart.datasets,
    source: { id: 'report-source', label: 'Reviewed report', updatedAt: 1700000000000 } };
}
export function projectSavedDefinition(definition, data) {
  require(definition.dataSources.length === 1 && definition.dataSources[0].id === SAVED_SOURCE.id && definition.dataSources[0].source === SAVED_SOURCE.source, 'Unexpected saved source.');
  require(Array.isArray(data.rows) && data.rows.length === 100 && data.labels?.length === 100 && data.datasets?.length === 4
    && data.datasets.every(series => series.data.length === 100) && data.source?.id === 'report-source', 'Incomplete saved source data.');
  const view = structuredClone(definition.view);
  findNode(view, 'table').props.rows = structuredClone(data.rows);
  Object.assign(findNode(view, 'chart').props, { labels: [...data.labels], datasets: structuredClone(data.datasets) });
  return view;
}

export function serializeDashboardDefinition(workload) {
  if (workload === 'D') {
    const universe = createLiveUniverse();
    return encode({ universe, firstPage: liveQueryResult(universe), ticks: Array.from({ length: 20 }, (_, index) => index) });
  }
  if (workload === 'S') return encode({ definition: createSavedDefinition(), source: createSavedSource() });
  throw new Error('Unknown dashboard definition.');
}
export async function dashboardInputIdentity(workload) {
  const source = serializeDashboardDefinition(workload), bytes = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return { json: { sha256: [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join(''), utf8Bytes: bytes.length, utf16Units: source.length } };
}
export function describeDashboardDefinition(workload) {
  const text = serializeDashboardDefinition(workload), data = JSON.parse(text);
  let jsonValues = 0; const count = value => { jsonValues++; if (value && typeof value === 'object') Object.values(value).forEach(count); }; count(data);
  let generatedNodes = 4;
  if (workload === 'S') { generatedNodes = 0; const visit = node => { generatedNodes++; node.children?.forEach(visit); }; visit(data.definition.view.root); }
  return { jsonUtf8Bytes: new TextEncoder().encode(text).length, jsonUtf16Units: text.length, jsonValues, generatedNodes,
    sourceIds: workload === 'D' ? ['report-source'] : ['reviewed-report', 'report-source'], chunkOffsets: [] };
}

const dBase = { rows: 100, offset: 0, filter: '', input: '', note: '', selection: [], detail: false, row: 0, height: 4, pinned: false, queue: 0, dropped: 0, status: 'ready' };
const descriptor = (id, kind, trigger, projection, native) => ({ id, kind, trigger, expectedFingerprint: encode(projection), ...(native ? { native } : {}) });
const dOp = (id, overrides = {}, native, kind = 'interaction') => descriptor(id, kind, native ? 'event' : 'host', { workload: 'D', phase: id, ...dBase, ...overrides }, native);
const click = selector => ({ action: 'click', selector });
const press = (selector, value) => ({ action: 'press', selector, value });
const fill = (selector, value) => ({ action: 'fill', selector, value });
const filterInput = '[data-dashboard-live] input[name="category"]';
const noteInput = '[data-dashboard-live] [data-gen-id="note"] input';
const cell = '[data-dashboard-live] [part="cell"][data-cell-id="table"]';
const dirty = { note: 'Keep my note' };
const laidOut = { ...dirty, selection: ['Focus-001'], row: 1, height: 5, pinned: true };
const queued = { ...laidOut, dropped: 16 };
const sBase = { mounted: true, rows: 100, columns: 8, series: 4, categories: 100, note: 'Model default', title: 'Saved report', baseRevision: 2, publication: 2, instanceRevision: 1, status: 'opened', conflict: '' };
const sOp = (id, overrides = {}, native, kind = 'interaction') => descriptor(id, kind, native ? 'event' : 'host', { workload: 'S', phase: id, ...sBase, ...overrides }, native);
const saved = { note: 'Personal saved note', instanceRevision: 2 };
const published = { ...saved, title: 'Edited report', baseRevision: 4, publication: 4 };
export const fixtureDefinitions = freeze({
  D: { workload: 'D', serialized: describeDashboardDefinition('D'), sizes: { panels: 2, universeRows: 1000, pageSize: 100, columns: 2, series: 1, categories: 100, filteredRows: 50, queueItems: 4, queueBytes: 64, queueBatch: 2, queueBurst: 20, responseDelayMs: 100 },
    oracleIds: ['exact-retained-page-and-chart', 'source-lineage', 'shared-filter-selection', 'native-grid-geometry', 'dirty-note', 'bounded-queue', 'cancel-supersede-revoke'], operations: [
      dOp('mount', {}, undefined, 'ready'), dOp('edit-note', dirty, fill(noteInput, dirty.note)),
      dOp('next', { ...dirty, offset: 100 }, click('[data-dashboard-live] [data-action="next"]')),
      dOp('previous', dirty, click('[data-dashboard-live] [data-action="previous"]')),
      dOp('filter-input', { ...dirty, input: 'Focus' }, fill(filterInput, 'Focus')),
      dOp('filter', { ...dirty, input: 'Focus', filter: 'Focus', rows: 50 }, press(filterInput, 'Tab')),
      dOp('filter-clear', { ...dirty, filter: 'Focus', rows: 50 }, fill(filterInput, '')),
      dOp('filter-reset', dirty, press(filterInput, 'Tab')),
      dOp('table-drilldown', { ...dirty, selection: ['Focus-000'], detail: true }, press('[data-gen-id="records"] tbody tr:first-child', 'Enter')),
      dOp('table-back', { ...dirty, selection: ['Focus-000'] }, click('[data-dashboard-live] [data-action="back"]')),
      dOp('chart-drilldown', { ...dirty, selection: ['Focus-001'], detail: true }, press('[data-gen-id="summary"] [part="bar"][data-index="1"]', 'Enter')),
      dOp('chart-back', { ...dirty, selection: ['Focus-001'] }, click('[data-dashboard-live] [data-action="back"]')),
      dOp('move', { ...dirty, selection: ['Focus-001'], row: 1 }, press(cell, 'Control+ArrowDown')),
      dOp('resize', { ...dirty, selection: ['Focus-001'], row: 1, height: 5 }, press(cell, 'Control+Shift+ArrowDown')),
      dOp('pin', laidOut, press('[data-dashboard-live] button[data-profile-pin]', 'Enter')),
      dOp('queue-burst', { ...laidOut, queue: 4, dropped: 16 }), dOp('queue-flush', { ...laidOut, queue: 2, dropped: 16 }), dOp('queue-drain', queued),
      dOp('delayed-supersede', queued, undefined, 'delayed'), dOp('delayed-cancel', { ...queued, status: 'cancelled' }, undefined, 'delayed'),
      dOp('delayed-reconnect', queued, undefined, 'delayed'), dOp('stale-failure', { ...queued, status: 'error' }),
      dOp('background-refresh', queued, undefined, 'ready'),
      dOp('revoke', { ...queued, rows: 0, note: '', selection: [], status: 'denied' }),
    ] },
  S: { workload: 'S', serialized: describeDashboardDefinition('S'), sizes: { definitions: 1, publications: 1, instances: 1, seededHistory: 2, rows: 100, columns: 8, series: 4, categories: 100, controls: 7, options: 8, sources: 1, storedRows: 0, responseBytesMax: 262144, addedDelayMs: 0 },
    oracleIds: ['populated-source-projection', 'real-file-read-cas', 'viewer-editor-tenant-permissions', 'saved-instance-reopen', 'preserved-conflict-proposal', 'revoked-content-removed'], operations: [
      sOp('mount', { mounted: false, rows: 0, columns: 0, series: 0, categories: 0, status: 'closed' }, undefined, 'ready'),
      sOp('open', {}, click('[data-saved-action="open"]'), 'ready'),
      sOp('edit-note', { note: saved.note, status: 'edited' }, fill('[data-saved-view] [data-gen-id="note"] input', saved.note)),
      sOp('save-instance', { ...saved, status: 'saved-state' }, click('[data-saved-action="save-instance"]')),
      sOp('edit-title', { ...saved, title: 'Edited report', status: 'edited-title' }, fill('[data-saved-title]', 'Edited report')),
      sOp('save-draft', { ...saved, title: 'Edited report', baseRevision: 3, status: 'saved-draft' }, click('[data-saved-action="save-draft"]')),
      sOp('publish', { ...published, status: 'published' }, click('[data-saved-action="publish"]')),
      sOp('follow', { ...published, status: 'opened' }, click('[data-saved-action="open"]'), 'ready'),
      sOp('close', { ...published, mounted: false, rows: 0, columns: 0, series: 0, categories: 0, status: 'closed' }, click('[data-saved-action="close"]')),
      sOp('reopen', { ...published, status: 'opened' }, click('[data-saved-action="open"]'), 'ready'),
      sOp('conflict', { ...published, status: 'conflict', conflict: 'Unsaved proposal' }, click('[data-saved-action="conflict"]')),
      sOp('viewer-denied', { ...published, status: 'denied', conflict: 'Unsaved proposal' }, click('[data-saved-action="viewer-denied"]')),
      sOp('tenant-denied', { ...published, status: 'denied', conflict: 'Unsaved proposal' }, click('[data-saved-action="tenant-denied"]')),
      sOp('revoke', { ...published, mounted: false, rows: 0, columns: 0, series: 0, categories: 0, status: 'denied', conflict: 'Unsaved proposal' }, click('[data-saved-action="revoke"]')),
    ] },
});

const viewNode = (view, id) => view?.shadowRoot?.querySelector(`[data-gen-id="${id}"]`);
export function assertDashboardChartShape(chart, rows, overviewVisible) {
  require(chart.labels.length === rows && chart.datasets.length === 1 && chart.datasets[0].data.length === rows, 'Wrong chart bounds.');
  if (overviewVisible) require(chart.shadowRoot.querySelectorAll('[part="bar"]').length === rows, 'Chart observations were truncated.');
}
export function assertDashboardPin(layout, id, pinned) {
  const cell = layout.find(item => item.cellId === id);
  require(cell && (cell.locked === undefined || typeof cell.locked === 'boolean') && (cell.locked ?? false) === pinned, 'Pin is not applied to the real grid.');
}
export function waitForDashboardView(view, signal) {
  return new Promise((resolve, reject) => {
    const clear = () => { view.removeEventListener('lr-gen-ready', inspect); view.removeEventListener('lr-gen-error', inspect); signal?.removeEventListener('abort', abort); };
    const abort = () => { clear(); reject(new Error('Dashboard view readiness aborted.')); };
    const inspect = () => {
      if (signal?.aborted) { abort(); return; }
      if (view.status === 'ready') { clear(); resolve(); }
      else if (view.status === 'error') { clear(); reject(new Error('Dashboard view failed to render.')); }
    };
    view.addEventListener('lr-gen-ready', inspect); view.addEventListener('lr-gen-error', inspect);
    signal?.addEventListener('abort', abort, { once: true }); inspect();
  });
}
function chartDiagnostic(chart) {
  const bounds = chart?.shadowRoot?.querySelector('svg')?.getBoundingClientRect();
  return { connected: Boolean(chart?.isConnected), categories: chart?.labels?.length ?? 0, series: chart?.datasets?.length ?? 0,
    bars: chart?.shadowRoot?.querySelectorAll('[part="bar"]').length ?? 0, width: bounds?.width ?? 0, height: bounds?.height ?? 0 };
}
function waitForResult(host, read, signal, afterRender = async () => {}) {
  return new Promise((resolve, reject) => {
    const events = ['lr-gen-ready', 'lr-gen-state-change', 'lr-layout-change', 'lr-row-activate', 'lr-datum-activate', 'input', 'change', 'click', 'keydown', 'fixture-commit'];
    let running = false, again = false;
    const observer = new MutationObserver(() => changed());
    const clear = () => { observer.disconnect(); events.forEach(name => host.removeEventListener(name, changed, true)); signal.removeEventListener('abort', stop); };
    const stop = () => { clear(); reject(new Error('Dashboard fixture aborted.')); };
    const changed = () => {
      if (running) { again = true; return; }
      running = true;
      void (async () => {
        do {
          again = false; await settle(host); await Promise.resolve(); await settle(host); await afterRender(signal);
          if (read().status === 'committed') { clear(); resolve(); return; }
        } while (again && !signal.aborted);
      })().catch(error => { clear(); reject(error); }).finally(() => { running = false; });
    };
    events.forEach(name => host.addEventListener(name, changed, true));
    observer.observe(host, { childList: true, subtree: true, characterData: true, attributes: true });
    signal.addEventListener('abort', stop, { once: true }); if (signal.aborted) stop();
  });
}
const labels = {
  title: 'Live report', table: 'Report records', chart: 'Report categories', note: 'Personal note', refresh: 'Refresh', cancel: 'Cancel', pin: 'Pin records', unpin: 'Unpin records',
  category: 'Category', value: 'Value', sharedFilter: 'Shared filter', previous: 'Previous page', next: 'Next page', overview: 'Overview', back: 'Back', navigationDenied: 'Detail unavailable',
  detail: row => `Details: ${row.c0}`, page: page => `offset:${page.shownOffset};limit:${page.limit};${page.stale ? 'stale' : 'fresh'}`,
  selection: ids => `Selected: ${ids.join(', ')}`, queue: metrics => `${metrics.items} pending; ${metrics.dropped} dropped`,
  provenance: snapshot => snapshot.result?.sources?.map(source => `${source.label}@${source.updatedAt}`).join(', ') ?? 'Unverified',
  layoutError: code => `Layout: ${code}`, status: snapshot => `${snapshot.status}:${snapshot.stale ? 'stale' : 'fresh'}`,
};

const loadLiveRuntime = async () => {
  const [{ mountLiveDashboard }, { HostQueryRegistry }] = await Promise.all([
    import('../../../../packages/lyra-gen/examples/dashboard.ts'), import('@aceshooting/lyra-gen/live-data.js'),
  ]);
  return { mountLiveDashboard, HostQueryRegistry };
};
const loadSavedRuntime = async () => {
  const [{ DashboardApplication }, { DashboardGridBinding }, { LyraDashboardGrid }, library] = await Promise.all([
    import('@aceshooting/lyra-gen/application.js'), import('@aceshooting/lyra-gen/dashboard-binding.js'),
    import('@aceshooting/lyra-ui/components/lr-dashboard-grid.js'), import('@aceshooting/lyra-gen/catalog.js'),
  ]);
  return { DashboardApplication, DashboardGridBinding, LyraDashboardGrid, library };
};

async function createLiveFixture({ host, measurement, signal, loadRuntime = loadLiveRuntime }) {
  const lifecycle = new AbortController(), queryTasks = new Set();
  const stopLifecycle = () => lifecycle.abort(); signal?.addEventListener('abort', stopLifecycle, { once: true }); if (signal?.aborted) lifecycle.abort();
  let generation, container, app, universe, unregister, echo, layoutSummary, phase, started = false, disposed = false, noteIdentity, beforeGeometry;
  let requestMode, began, lastNative = -Infinity, failure, hostFinished = false;
  const layoutText = panel => `Row ${panel.row}; height ${panel.height}; ${panel.pinned ? 'pinned' : 'unpinned'}`;
  const context = { viewerId: 'profile-viewer', tenantId: 'profile', authorizationRevision: '1' };
  const readOracle = ({ operation, generation: requested } = {}) => {
    const id = operation?.id ?? phase;
    try {
      require(!disposed && requested === generation && started && app, 'Operation has not started.');
      if (failure) throw failure;
      const descriptor = fixtureDefinitions.D.operations.find(item => item.id === id);
      require(descriptor.trigger !== 'host' || hostFinished, 'Host dashboard work is still pending.');
      const expected = JSON.parse(descriptor.expectedFingerprint);
      const tableView = app.binding.panel('table'), chartView = app.binding.panel('chart');
      require(tableView.status === 'ready' && chartView.status === 'ready', 'Panels are not ready.');
      const table = viewNode(tableView, 'records'), chart = viewNode(chartView, 'summary'), note = viewNode(tableView, 'note');
      const rows = table.rows;
      require(rows.length === expected.rows && rows.length <= 100 && table.columns.length === 2 && table.pageSize === 100, 'Wrong retained page.');
      const rendered = [...table.shadowRoot.querySelectorAll('tbody tr')];
      require(expected.rows === 0 ? rows.length === 0 : rendered.length === expected.rows, 'Wrong rendered page.');
      for (let index = 0; index < expected.rows; index++) {
        const ordinal = expected.offset + index, label = `${ordinal < 50 ? 'Focus' : 'Record'}-${String(ordinal).padStart(3, '0')}`;
        require(rows[index].c0 === label && rows[index].c1 === ordinal + 1, 'Page contains stale or incorrect data.');
        const cells = [...rendered[index].querySelectorAll('td')];
        require(cells.length === 2 && cells[0].textContent.trim() === label && cells[1].textContent.trim() === String(ordinal + 1), 'Rendered cells differ from expected records.');
        require(chart.labels[index] === label && chart.datasets[0].data[index] === ordinal + 1, 'Chart and table differ.');
        const provenance = app.valueSources.querySelector(`[data-value-pointer="/${index}/c1"]`);
        require(provenance?.textContent.includes(`${label}: ${ordinal + 1}`) && provenance.querySelector('button')?.textContent === 'Reviewed report', 'Value provenance missing.');
      }
      assertDashboardChartShape(chart, expected.rows, !expected.detail);
      require(app.valueSources.querySelectorAll('[data-value-pointer]').length === expected.rows, 'Stale provenance survived.');
      if (expected.status === 'denied') require(app.provenance.textContent === 'Unverified' && !app.selected.textContent.includes('Focus-'), 'Revoked provenance/selection survived.');
      require(note.value === expected.note && (!noteIdentity || note === noteIdentity), 'Dirty note identity/value changed.');
      require(echo.textContent === expected.note, 'Visible note echo is stale.');
      const panel = app.binding.state.panels.find(item => item.id === 'table');
      require(panel.row === expected.row && panel.height === expected.height && Boolean(panel.pinned) === expected.pinned, 'Wrong persisted grid state.');
      require(layoutSummary.textContent === layoutText(panel), 'Persisted layout summary is not current.');
      if (!expected.detail) {
        const renderedCell = app.grid.shadowRoot.querySelector('[part="cell"][data-cell-id="table"]');
        const rectangle = renderedCell.getBoundingClientRect(); require(rectangle.width > 0 && rectangle.height > 0, 'Grid cell has no layout.');
        require(visible(layoutSummary), 'Persisted layout summary is not visible.');
        const base = app.grid.shadowRoot.querySelector('[part="base"]');
        if (getComputedStyle(base).display === 'flex') {
          require(getComputedStyle(base).flexDirection === 'column' && Math.abs(rectangle.width - app.grid.getBoundingClientRect().width) <= 2, 'Narrow grid is not full-width stacked flow.');
          const order = [...app.grid.shadowRoot.querySelectorAll('[part="cell"]')].map(element => element.dataset.cellId);
          require(encode(order) === encode(panel.row === 0 ? ['table', 'chart'] : ['chart', 'table']), 'Stacked layout lost row-major reading order.');
          if (id === 'resize') require(Math.abs(rectangle.height - beforeGeometry.height) <= 1, 'Stacked layout unexpectedly applied configured grid height.');
        } else {
          require(getComputedStyle(base).display === 'grid', 'Unexpected dashboard layout mode.');
          if (id === 'move') require(rectangle.top > beforeGeometry.top && Math.abs(rectangle.height - beforeGeometry.height) <= 1, 'Keyboard move did not change grid geometry.');
          if (id === 'resize') require(rectangle.height > beforeGeometry.height, 'Keyboard resize did not change grid geometry.');
        }
      }
      assertDashboardPin(app.grid.layout, 'table', expected.pinned);
      const detail = !app.detail.hidden;
      require(detail === expected.detail && app.overview.hidden === detail && app.overview.inert === detail && (detail ? visible(app.detail) : visible(app.overview)), 'Wrong drilldown surface.');
      if (detail) require(app.detail.querySelector('h2').textContent === `Details: ${expected.selection[0]}`, 'Wrong drilldown result.');
      const selection = [...app.shared.snapshot('records').selection]; require(encode(selection) === encode(expected.selection), 'Shared selection differs.');
      if (selection.length) require(app.selected.textContent === `Selected: ${selection.join(', ')}` && chart.description === app.selected.textContent, 'Selection summary missing.');
      const filter = String(app.shared.snapshot('query').filters.category ?? ''), input = container.querySelector('input[name="category"]').value;
      require(filter === expected.filter && input === expected.input && app.status.textContent === `${expected.status}:${['ready', 'empty'].includes(expected.status) ? 'fresh' : 'stale'}`, 'Filter/status not committed.');
      require(app.queue.metrics.items === expected.queue && app.queue.metrics.dropped === expected.dropped && app.queue.metrics.bytes <= 64, 'Queue bounds/drops differ.');
      const offset = expected.rows ? Number(app.overview.querySelector('[data-page]').textContent.match(/offset:(\d+)/)?.[1]) : 0;
      require(offset === expected.offset, 'Wrong visible page offset.');
      const projection = { workload: 'D', phase: id, rows: rows.length, offset, filter, input, note: note.value, selection, detail,
        row: panel.row, height: panel.height, pinned: Boolean(panel.pinned), queue: app.queue.metrics.items, dropped: app.queue.metrics.dropped, status: app.live.snapshot.status };
      return { generation, status: 'committed', fingerprint: encode(projection), connected: container.isConnected, visible: visible(container) };
    } catch (error) { return { generation, status: 'pending', reason: error.message, fingerprint: '', connected: Boolean(container?.isConnected), visible: visible(container) }; }
  };
  const afterRender = async pending => {
    const chart = viewNode(app?.binding.panel('chart'), 'summary');
    if (chart && !app.overview.hidden) await waitForChartGeometry(chart, pending);
  };
  const complete = async work => { await work(); await settle(host); hostFinished = true; announceCommit(host); };
  return {
    async prepare(value) {
      generation = `D:${value.batchIndex}:${value.sampleIndex}`; universe = createLiveUniverse();
      container = document.createElement('section'); container.dataset.dashboardLive = ''; echo = document.createElement('output'); echo.dataset.noteEcho = ''; layoutSummary = document.createElement('output'); layoutSummary.style.display = 'block';
      return { generation, manifest: value.manifest, operations: fixtureDefinitions.D.operations, inputs: await dashboardInputIdentity('D') };
    },
    async runOperation({ operation, generation: requested, signal: operationSignal = signal, onArmed }) {
      require(requested === generation && !disposed, 'Stale dashboard operation.'); phase = operation.id; started = false; failure = undefined; hostFinished = false;
      if (phase === 'background-refresh') await delay(Math.max(0, lastNative + 1000 - performance.now()), operationSignal);
      if (['move', 'resize'].includes(phase)) beforeGeometry = app.grid.shadowRoot.querySelector('[part="cell"][data-cell-id="table"]').getBoundingClientRect();
      const read = () => readOracle({ operation, generation });
      let triggerSignal = operationSignal;
      const work = async () => {
        if (phase === 'mount') {
          const { mountLiveDashboard, HostQueryRegistry } = await loadRuntime();
          require(!disposed && !lifecycle.signal.aborted && !triggerSignal?.aborted, 'Dashboard initialization was aborted.');
          const registry = new HostQueryRegistry();
          unregister = registry.register('records', { maxBytes: 65536, maxRows: 100, authorize: current => current.viewerId === context.viewerId, execute: async parameters => {
            let finished; const pending = new Promise(resolve => { finished = resolve; }); queryTasks.add(pending);
            try {
              const mode = requestMode; requestMode = undefined; began?.(); began = undefined;
              if (mode === 'failure') throw new Error('Fixture query failure.');
              if (mode === 'delayed') await delay(100, lifecycle.signal); else await Promise.resolve();
              const result = liveQueryResult(universe, parameters);
              if (mode === 'delayed') result.data = result.data.map(row => ({ ...row, c1: row.c1 + 10000 }));
              return result;
            } finally { queryTasks.delete(pending); finished(); }
          } });
          host.append(container);
          app = mountLiveDashboard(container, { registry, context, query: 'records', labels, pageSize: 100, totalRows: 1000,
            authorizeDrilldown: () => true, persist: async next => { layoutSummary.textContent = layoutText(next.panels.find(panel => panel.id === 'table')); queueMicrotask(() => announceCommit(host)); return true; },
            sources: { label: 'Value provenance', unverified: 'Unverified', available: () => app?.live.snapshot.status !== 'denied', activate: () => {}, citation: source => source.label } });
          container.append(echo);
          layoutSummary.textContent = layoutText(app.binding.state.panels.find(panel => panel.id === 'table'));
          app.grid.querySelector('[cell-id="table"]').prepend(layoutSummary);
          container.addEventListener('lr-gen-state-change', event => { echo.textContent = event.detail.values.note ?? ''; });
          app.live.subscribe(snapshot => { if (snapshot.status === 'denied') echo.textContent = ''; });
          container.querySelectorAll('button')[2].dataset.profilePin = '';
          await app.ready; await app.refresh(); noteIdentity = viewNode(app.binding.panel('table'), 'note');
        } else if (phase === 'queue-burst') { for (let index = 0; index < 20; index++) app.enqueue(index); }
        else if (phase === 'queue-flush' || phase === 'queue-drain') await app.flush();
        else if (phase.startsWith('delayed-')) {
          let begin; const executing = new Promise(resolve => { begin = resolve; }); began = begin;
          requestMode = 'delayed'; const old = app.refresh(); await executing; require(!disposed && !lifecycle.signal.aborted, 'Delayed dashboard operation aborted.');
          if (phase === 'delayed-cancel') app.live.cancel();
          else {
            if (phase === 'delayed-reconnect') { container.remove(); host.append(container); }
            await app.refresh();
          }
          await old;
        } else if (phase === 'stale-failure') { requestMode = 'failure'; await app.refresh(); }
        else if (phase === 'background-refresh') await app.refresh();
        else if (phase === 'revoke') unregister();
      };
      if (operation.trigger === 'host') return measurement.measureOperation({ operation, generation, signal: operationSignal,
        trigger: ({ signal: timedSignal } = {}) => { triggerSignal = timedSignal ?? operationSignal; started = true; return complete(work); }, waitForCommit: ({ signal: pending }) => waitForResult(host, read, pending, afterRender), readOracle: read });
      let target, type = 'click';
      if (phase === 'edit-note') { target = viewNode(app.binding.panel('table'), 'note').shadowRoot.querySelector('input'); type = 'input'; }
      else if (phase.startsWith('filter')) { target = container.querySelector('input[name="category"]'); type = operation.native.action === 'fill' ? 'input' : 'keydown'; }
      else if (phase === 'table-drilldown') { target = viewNode(app.binding.panel('table'), 'records').shadowRoot.querySelector('tbody tr'); type = 'keydown'; }
      else if (phase === 'chart-drilldown') { target = viewNode(app.binding.panel('chart'), 'summary').shadowRoot.querySelector('[part="bar"][data-index="1"]'); type = 'keydown'; }
      else if (['move', 'resize'].includes(phase)) { target = app.grid.shadowRoot.querySelector('[part="cell"][data-cell-id="table"]'); type = 'keydown'; }
      else target = container.querySelector(phase === 'pin' ? '[data-profile-pin]' : `[data-action="${phase.endsWith('back') ? 'back' : phase}"]`);
      require(target, 'Native dashboard target missing.'); if (operation.native.action === 'press') type = 'keydown';
      const activated = () => { started = true; lastNative = performance.now(); queueMicrotask(() => announceCommit(host)); };
      target.addEventListener(type, activated, { capture: true, once: true });
      try { return await measurement.measureOperation({ operation, generation, signal: operationSignal, event: { target, type }, onArmed,
        waitForCommit: ({ signal: pending }) => waitForResult(host, read, pending, afterRender), readOracle: read }); }
      finally { target.removeEventListener(type, activated, true); }
    },
    readOracle,
    diagnose() {
      const tableView = app?.binding.panel('table'), chartView = app?.binding.panel('chart');
      return { phase, hostFinished, failure: failure?.message ?? null, oracle: readOracle({ generation }),
        tableStatus: tableView?.status ?? null, tableRows: viewNode(tableView, 'records')?.rows?.length ?? 0,
        chartStatus: chartView?.status ?? null, chart: chartDiagnostic(viewNode(chartView, 'summary')),
        selectedText: app?.selected.textContent ?? null, chartDescription: viewNode(chartView, 'summary')?.description ?? null,
        sharedSelection: [...(app?.shared.snapshot('records').selection ?? [])],
        layoutSummary: layoutSummary?.textContent ?? '', liveStatus: app?.live.snapshot.status ?? null };
    },
    async dispose() { disposed = true; lifecycle.abort(); signal?.removeEventListener('abort', stopLifecycle); began?.(); app?.dispose(); unregister?.(); await Promise.allSettled([...queryTasks]); container?.remove(); universe = undefined; app = undefined; noteIdentity = undefined; began = undefined; container = undefined; echo = undefined; layoutSummary = undefined;
      return { connectedNodes: host.childNodes.length, connectedElements: host.querySelectorAll('*').length, retainedSources: universe ? 1 : 0, pendingOperations: measurement.pendingOperations }; },
  };
}

async function createSavedFixture({ host, measurement, signal, services, loadRuntime = loadSavedRuntime }) {
  require(services?.dashboard?.url === '/host/dashboard' && services.dashboard.simulatedSessions === true, 'Saved fixture host service missing.');
  let runtime, catalog, runtimeLoading, activeSignal;
  const requests = new Set(), pendingRequests = new Set();
  let generation, container, toolbar, titleInput, status, metadata, echo, provenance, conflict, mountTarget, application, binding, view;
  let definition, baseRevision = 2, publication = 2, instanceRevision = 1, note = 'Model default', phase, started = false, disposed = false, failure, finishedOperation;
  let serverObservations = [];
  const request = async (operation, values = {}, session = 'viewer', activeSignal = signal) => {
    const controller = new AbortController(), abort = () => controller.abort(); requests.add(controller);
    let finished; const pending = new Promise(resolve => { finished = resolve; }); pendingRequests.add(pending);
    activeSignal?.addEventListener('abort', abort, { once: true }); if (activeSignal?.aborted) controller.abort();
    try {
      const payload = encode({ operation, ...values }); require(new TextEncoder().encode(payload).length <= 262144, 'Saved host request exceeds fixture ceiling.');
      const response = await fetch(services.dashboard.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-fixture-session': session },
        body: payload, signal: controller.signal });
      const text = await response.text(); require(new TextEncoder().encode(text).length <= 262144, 'Saved host response exceeds fixture ceiling.');
      const body = JSON.parse(text);
      require(Array.isArray(body.server) && body.server.every(item => typeof item.operation === 'string' && Number.isFinite(item.durationMs) && item.durationMs >= 0), 'Saved host timing attribution missing.');
      serverObservations.push({ operation, status: response.status, entries: body.server });
      if (!response.ok) { const error = new Error('Saved host refused the request.'); error.code = body.error; error.proposed = body.proposed; throw error; }
      return body.value;
    } finally { activeSignal?.removeEventListener('abort', abort); requests.delete(controller); pendingRequests.delete(pending); finished(); }
  };
  const paintMetadata = () => { metadata.textContent = encode({ baseRevision, publication, instanceRevision }); };
  const setStatus = value => { status.textContent = value; paintMetadata(); };
  const newApplication = () => new runtime.DashboardApplication({
    context: () => ({ actorId: 'viewer', tenantId: 'profile', workspaceId: 'reports' }),
    store: { resolve: () => request('resolve') },
    mount: async ({ dashboard, signal: mountSignal }) => {
      const [data, savedState] = await Promise.all([request('data', {}, 'viewer', mountSignal), request('load-state', {}, 'viewer', mountSignal)]);
      require(!mountSignal.aborted && !disposed, 'Saved mounting was superseded.');
      definition = dashboard.definition; baseRevision = dashboard.metadata.revision; publication = dashboard.selectedRevision;
      instanceRevision = savedState?.revision ?? 0; note = savedState?.state.values.note ?? 'Model default';
      titleInput.value = definition.title;
      const grid = new runtime.LyraDashboardGrid(); grid.accessibleLabel = 'Saved report layout'; grid.rowHeight = 100;
      const currentBinding = new runtime.DashboardGridBinding({ grid, catalog, panels: [{ id: 'report', view: projectSavedDefinition(definition, data) }],
        state: { version: 1, revision: 0, panels: [{ id: 'report', column: 0, row: 0, width: 6, height: 12 }] },
        constraints: { columns: 6, maxRows: 20, maxPanels: 1, collision: 'reject' }, readonly: true });
      const currentView = currentBinding.panel('report'); currentView.dataset.savedView = ''; currentView.enabledActions = [];
      currentView.bindingState = { note }; currentView.addEventListener('lr-gen-state-change', event => { note = event.detail.values.note; echo.textContent = note; setStatus('edited'); if (phase === 'edit-note') finishedOperation = phase; });
      binding = currentBinding; view = currentView; echo.textContent = note; provenance.textContent = `${data.source.label}@${data.source.updatedAt}`;
      mountTarget.append(grid);
      const cleanup = () => { currentBinding.dispose(); grid.remove(); if (binding === currentBinding) { binding = undefined; view = undefined; provenance.textContent = ''; } };
      try {
        await waitForDashboardView(currentView, mountSignal); await settle(host);
        await waitForChartGeometry(viewNode(currentView, 'chart'), mountSignal);
        require(!mountSignal.aborted && !disposed, 'Saved mounting was superseded.'); return cleanup;
      }
      catch (error) { cleanup(); throw error; }
    },
  });
  const initialize = async () => {
    require(!disposed && !signal?.aborted && !activeSignal?.aborted, 'Saved initialization was aborted.');
    if (runtime) return;
    runtimeLoading ??= loadRuntime();
    const loaded = await runtimeLoading;
    require(!disposed && !signal?.aborted && !activeSignal?.aborted, 'Saved initialization was aborted.');
    catalog = createSavedCatalog(loaded.library); runtime = loaded;
  };
  const open = async () => { await initialize(); application ??= newApplication(); require(await application.navigate({ documentId: services.dashboard.documentId, policy: { mode: 'follow' } }) === 'mounted', 'Saved navigation did not mount.'); setStatus('opened'); };
  const close = () => { application?.dispose(); application = undefined; setStatus('closed'); };
  const actions = {
    open,
    close,
    'save-instance': async () => { const savedState = await request('save-state', { expectedRevision: instanceRevision, state: { version: 1, values: { note } } }); instanceRevision = savedState.revision; setStatus('saved-state'); },
    'save-draft': async () => { const proposal = { ...structuredClone(definition), title: titleInput.value }; const savedDraft = await request('update', { expectedRevision: baseRevision, definition: proposal }, 'editor'); definition = savedDraft.definition; baseRevision = savedDraft.metadata.revision; setStatus('saved-draft'); },
    publish: async () => { const publishedDraft = await request('publish', { expectedRevision: baseRevision }, 'author'); baseRevision = publishedDraft.metadata.revision; publication = publishedDraft.metadata.publishedRevision; setStatus('published'); },
    conflict: async () => {
      await request('update', { expectedRevision: baseRevision, definition: { ...structuredClone(definition), title: 'Other edit' } }, 'editor');
      const proposal = { ...structuredClone(definition), title: 'Unsaved proposal' };
      try { await request('update', { expectedRevision: baseRevision, definition: proposal }, 'editor'); throw new Error('Stale draft unexpectedly committed.'); }
      catch (error) { require(error.code === 'conflict' && encode(error.proposed) === encode(proposal), 'Exact conflict proposal was not retained.'); conflict.textContent = error.proposed.title; setStatus('conflict'); }
    },
    'viewer-denied': async () => {
      try { await request('update', { expectedRevision: baseRevision, definition }, 'viewer'); throw new Error('Viewer write unexpectedly committed.'); }
      catch (error) { require(error.code === 'denied', 'Viewer write was not denied.'); setStatus('denied'); }
    },
    'tenant-denied': async () => {
      try { await request('resolve', {}, 'other-tenant'); throw new Error('Other tenant read unexpectedly succeeded.'); }
      catch (error) { require(error.code === 'denied', 'Tenant isolation was not enforced.'); setStatus('denied'); }
    },
    revoke: async () => {
      await request('revoke', {}, 'author'); application?.revoke();
      try { await request('resolve'); throw new Error('Revoked viewer read unexpectedly succeeded.'); }
      catch (error) { require(error.code === 'denied', 'Viewer revocation was not enforced.'); setStatus('denied'); }
    },
  };
  const readOracle = ({ operation, generation: requested } = {}) => {
    const id = operation?.id ?? phase;
    try {
      require(!disposed && requested === generation && started && finishedOperation === id, 'Saved operation has not completed.'); if (failure) throw failure;
      const expected = JSON.parse(fixtureDefinitions.S.operations.find(item => item.id === id).expectedFingerprint);
      let result = { rows: 0, columns: 0, series: 0, categories: 0 };
      if (view) {
        result = assertViewSemantics(view, { workload: 'V', revision: 0, surfaceId: 'saved-report', note: expected.note });
        require(application.current?.selectedRevision === (['open', 'edit-note', 'save-instance', 'edit-title', 'save-draft', 'publish'].includes(id) ? 2 : 4), 'Saved mounted publication is stale.');
        require(view.enabledActions.length === 0 && provenance.textContent === 'Reviewed report@1700000000000', 'Saved source/authority projection differs.');
        require(container.querySelectorAll('lr-dashboard-grid').length === 1 && view.isConnected, 'Saved grid/view is missing.');
      } else require(mountTarget.children.length === 0 && provenance.textContent === '', 'Closed or revoked content survived.');
      const revisions = JSON.parse(metadata.textContent);
      const projection = { workload: 'S', phase: id, mounted: Boolean(view), rows: result.rows, columns: result.columns, series: result.series, categories: result.categories,
        note: echo.textContent, title: titleInput.value, ...revisions, status: status.textContent, conflict: conflict.textContent };
      require(encode(projection) === encode(expected), 'Saved visible state differs from the fixed operation result.');
      return { generation, status: 'committed', fingerprint: encode(projection), connected: container.isConnected, visible: visible(container) };
    } catch (error) { return { generation, status: 'pending', reason: error.message, fingerprint: '', connected: Boolean(container?.isConnected), visible: visible(container) }; }
  };
  return {
    async prepare(value) {
      generation = `S:${value.batchIndex}:${value.sampleIndex}`; await request('reset', {}, 'author'); serverObservations = [];
      container = document.createElement('section'); container.dataset.dashboardSaved = ''; toolbar = document.createElement('nav'); toolbar.setAttribute('aria-label', 'Saved dashboard fixture actions');
      titleInput = document.createElement('input'); titleInput.dataset.savedTitle = ''; titleInput.setAttribute('aria-label', 'Draft title'); titleInput.value = 'Saved report';
      titleInput.addEventListener('input', () => { setStatus('edited-title'); if (phase === 'edit-title') finishedOperation = phase; announceCommit(host); });
      status = document.createElement('output'); status.dataset.savedStatus = ''; metadata = document.createElement('output'); metadata.dataset.savedRevisions = '';
      echo = document.createElement('output'); echo.textContent = note; provenance = document.createElement('p'); conflict = document.createElement('output'); mountTarget = document.createElement('section');
      for (const [name, work] of Object.entries(actions)) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.savedAction = name; button.textContent = name;
        button.addEventListener('click', () => { const requestedPhase = phase; void Promise.resolve().then(work).then(async () => {
          await settle(host); if (!disposed && phase === requestedPhase) { finishedOperation = requestedPhase; announceCommit(host); }
        }).catch(error => { failure = error; announceCommit(host); }); });
        toolbar.append(button);
      }
      container.append(toolbar, titleInput, status, metadata, echo, provenance, conflict, mountTarget); setStatus('closed');
      return { generation, manifest: value.manifest, operations: fixtureDefinitions.S.operations, inputs: await dashboardInputIdentity('S') };
    },
    async runOperation({ operation, generation: requested, signal: operationSignal = signal, onArmed }) {
      require(requested === generation && !disposed, 'Stale saved operation.'); phase = operation.id; started = false; failure = undefined; finishedOperation = undefined; activeSignal = operationSignal;
      const serverStart = serverObservations.length, read = () => readOracle({ operation, generation });
      if (operation.trigger === 'host') return measurement.measureOperation({ operation, generation, signal: operationSignal, trigger: async () => {
        started = true; host.append(container); await settle(host); finishedOperation = phase; announceCommit(host);
      }, waitForCommit: ({ signal: pending }) => waitForResult(host, read, pending), readOracle: read });
      const target = phase === 'edit-note' ? viewNode(view, 'note').shadowRoot.querySelector('input') : phase === 'edit-title' ? titleInput
        : container.querySelector(`[data-saved-action="${['follow', 'reopen'].includes(phase) ? 'open' : phase}"]`);
      require(target, 'Native saved dashboard target missing.'); const type = phase.startsWith('edit-') ? 'input' : 'click';
      const activated = () => { started = true; queueMicrotask(() => announceCommit(host)); };
      target.addEventListener(type, activated, { capture: true, once: true });
      try {
        const result = await measurement.measureOperation({ operation, generation, signal: operationSignal, event: { target, type }, onArmed,
          waitForCommit: ({ signal: pending }) => { activeSignal = pending; return waitForResult(host, read, pending); }, readOracle: read });
        return { ...result, server: serverObservations.slice(serverStart) };
      } finally { target.removeEventListener(type, activated, true); }
    },
    readOracle,
    diagnose() { return { phase, finishedOperation: finishedOperation ?? null, failure: failure?.message ?? null, oracle: readOracle({ generation }),
      viewStatus: view?.status ?? null, chart: chartDiagnostic(viewNode(view, 'chart')), selectedRevision: application?.current?.selectedRevision ?? null }; },
    async dispose() {
      disposed = true; for (const controller of requests) controller.abort(); await Promise.allSettled([...pendingRequests]); application?.dispose(); application = undefined; binding?.dispose(); binding = undefined;
      container?.remove(); view = undefined; definition = undefined; serverObservations = [];
      return { connectedNodes: host.childNodes.length, connectedElements: host.querySelectorAll('*').length, retainedSources: definition ? 1 : 0, pendingOperations: measurement.pendingOperations + requests.size };
    },
  };
}

export async function createFixture(options) {
  if (options.workload === 'D') return createLiveFixture(options);
  if (options.workload === 'S') return createSavedFixture(options);
  throw new Error('Unknown dashboard fixture.');
}
