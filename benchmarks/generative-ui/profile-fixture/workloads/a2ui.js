import { announceCommit, deep, delay, settle, visible } from './text.js';
import { waitForChartGeometry } from './views.js';

const encode = value => JSON.stringify(value);
const require = (condition, message) => { if (!condition) throw new Error(message); };
export const reportIdentity = Object.freeze({ surfaceId: 'extended-report', ownerId: 'report-agent',
  catalogId: 'https://github.com/aceshooting/lyra-ui/a2ui/v0.9.1/lyra-report-fixture/1',
  sourceId: 'quarterly-report', sourceLabel: 'Viewer-approved quarterly report', timestamp: '2026-10-26T12:00:00.000Z' });
const projection = (phase, revision, tick, actions, source, staleRejected = false) => ({ phase, revision, tick,
  rows: 100, columns: 2, series: 1, categories: 100, actions, source, staleRejected });
const operation = (id, trigger, expected, native) => ({ id, kind: trigger === 'event' ? 'interaction' : 'ready', trigger,
  expectedFingerprint: encode(expected), ...(native ? { native } : {}) });
export const fixtureDefinitions = Object.freeze({ A: {
  workload: 'A', sizes: { rows: 100, columns: 2, series: 1, categories: 100, sources: 1, initialMessages: 3,
    dataUpdates: 100, updateIntervalMs: 16, generatedNodes: 5 }, identity: reportIdentity,
  oracleIds: ['full-report-data-and-dom', 'owner-revision-action-envelope', 'retained-protocol-state', 'source-revocation', 'retired-action-refusal', 'empty-default-advertising'],
  operations: [
    operation('mount', 'host', projection('mount', 2, 0, 0, true)),
    operation('data-updates', 'host', projection('data-updates', 102, 100, 0, true)),
    operation('source-action', 'event', projection('source-action', 102, 100, 1, true), { action: 'click', selector: '[data-a2ui-view] lr-citation-badge button' }),
    operation('revoke-source', 'event', projection('revoke-source', 102, 100, 1, false), { action: 'click', selector: '[data-a2ui-revoke]' }),
    operation('delete-recreate', 'host', projection('delete-recreate', 106, 0, 1, true, true)),
  ],
} });

/** The owned report recipe uses complete, matched domains at every update. */
export function reportData(tick = 0) {
  require(Number.isInteger(tick) && tick >= 0 && tick <= 100, 'Invalid report tick.');
  return { total: String(5050 + tick * 100), source: reportIdentity.sourceId,
    rows: Array.from({ length: 100 }, (_, index) => ({ c0: `Period ${index + 1}`, c1: index + 1 + tick })),
    series: [{ label: 'Orders', data: Array.from({ length: 100 }, (_, index) => index + 1 + tick) }] };
}
export function reportMessages() {
  const surfaceId = reportIdentity.surfaceId;
  return [
    { version: 'v0.9.1', createSurface: { surfaceId, catalogId: reportIdentity.catalogId, sendDataModel: true } },
    reportUpdate(0),
    { version: 'v0.9.1', updateComponents: { surfaceId, components: [
      { id: 'root', component: 'stack', children: ['chart', 'table', 'total', 'source'] },
      { id: 'chart', component: 'chart', type: 'bar', label: 'Orders by period', labels: Array.from({ length: 100 }, (_, index) => `Period ${index + 1}`), datasets: { path: '/series' }, withDataTable: true },
      { id: 'table', component: 'table', caption: 'Reviewed period totals', columns: [{ key: 'c0', label: 'Period' }, { key: 'c1', label: 'Orders' }], rows: { path: '/rows' }, pageSize: 100 },
      { id: 'total', component: 'stat', label: 'Reviewed orders', value: { path: '/total' } },
      { id: 'source', component: 'citation', sourceId: { path: '/source' }, label: 'Untrusted generated source label', index: 1,
        action: { event: { name: 'inspect-source', context: { sourceId: { path: '/source' } } } } },
    ] } },
  ];
}
export const reportUpdate = tick => ({ version: 'v0.9.1', updateDataModel: { surfaceId: reportIdentity.surfaceId, value: reportData(tick) } });

export function createReportCatalog({ createCatalog, initialCatalog, createA2uiCatalog }, sources) {
  const viewCatalog = createCatalog({ id: 'lyra-report-fixture', version: '1',
    components: Object.fromEntries(['stack', 'text', 'chart', 'table', 'stat', 'citation'].map(role => [role, initialCatalog.components[role]])),
    actions: { 'inspect-source': { payload: { type: 'object', properties: { sourceId: { type: 'string' } }, required: ['sourceId'], additionalProperties: false } } } });
  const declared = createA2uiCatalog(viewCatalog);
  require(declared.id === reportIdentity.catalogId, 'Owned report catalog identity changed.');
  const catalog = { ...declared, components: { ...declared.components, citation: { ...declared.components.citation,
    toNode(node, children) {
      const label = sources.get(String(node.props.sourceId));
      return label ? declared.components.citation.toNode({ ...node, props: { ...node.props, label } }, children)
        : { id: node.id, type: 'text', text: 'Source unavailable' };
    },
  } } };
  return { catalog, viewCatalog };
}

const accepted = result => { require(result.ok, `A2UI fixture rejected: ${result.diagnostics?.map(item => item.code).join(', ')}`); return result.value; };
/** Viewer authority changes own a fresh renderer, independently of the protocol revision. */
export function createReportRenderer({ View, catalog, onAction, signal }) {
  const view = new View(); view.dataset.a2uiView = ''; view.catalog = catalog;
  view.addEventListener('lr-gen-action', onAction, { signal });
  let disposed = false;
  return { view, dispose() {
    if (disposed) return;
    disposed = true; view.removeEventListener('lr-gen-action', onAction); view.remove(); view.document = undefined;
  } };
}
function waitCommit(host, readOracle, signal) {
  return new Promise((resolve, reject) => {
    const clear = () => { host.removeEventListener('fixture-commit', changed); signal.removeEventListener('abort', stop); };
    const stop = () => { clear(); reject(new Error('A2UI fixture aborted.')); };
    const changed = () => { try { if (readOracle().status === 'committed') { clear(); resolve(); } } catch (error) { clear(); reject(error); } };
    host.addEventListener('fixture-commit', changed); signal.addEventListener('abort', stop, { once: true }); if (signal.aborted) stop();
  });
}
function assignView(view, document, signal) {
  return new Promise((resolve, reject) => {
    const clear = () => { view.removeEventListener('lr-gen-ready', ready); view.removeEventListener('lr-gen-error', failed); signal.removeEventListener('abort', stopped); };
    const failed = () => { clear(); reject(new Error('Owned report rendering failed.')); };
    const stopped = () => { clear(); reject(new Error('Owned report rendering aborted.')); };
    const ready = event => {
      if (event.detail.surfaceId !== document.surfaceId || event.detail.revision !== document.revision) return;
      clear(); void settle(view).then(async () => {
        await waitForChartGeometry(deep(view.shadowRoot, 'lr-lite-chart'), signal);
        await settle(view);
      }).then(resolve, reject);
    };
    view.addEventListener('lr-gen-ready', ready); view.addEventListener('lr-gen-error', failed);
    signal.addEventListener('abort', stopped, { once: true }); if (signal.aborted) { stopped(); return; }
    view.document = document;
  });
}

const loadReportRuntime = () => Promise.all([
  import('@aceshooting/lyra-gen/adapters/a2ui.js'), import('@aceshooting/lyra-gen/catalog.js'), import('@aceshooting/lyra-gen/gen-view.js'),
]);

export async function createFixture({ workload, host, measurement, signal, loadRuntime = loadReportRuntime }) {
  require(workload === 'A', 'Unknown owned A2UI fixture.');
  let a2uiClientCapabilities;
  const lifetime = new AbortController();
  let sources = new Map(), processor, view, shell, status, revoke, generation, phase, committed, tick = 0, staleRejected = false, retired, disposed = false, failure, retainedChart, retainedTable;
  let outbound = [];
  let renderer, createRenderer;
  const owner = { ownerId: reportIdentity.ownerId };
  const initialize = async activeSignal => {
    require(!processor && !disposed && !activeSignal.aborted && !signal?.aborted, 'Owned A2UI initialization aborted.');
    const loaded = await loadRuntime();
    require(!disposed && !activeSignal.aborted && !signal?.aborted && !lifetime.signal.aborted, 'Owned A2UI initialization aborted.');
    const [{ A2uiProcessor, createA2uiCatalog, A2UI_STABLE_REVISION }, { createCatalog, initialCatalog }, { LyraGenViewElement }] = loaded;
    a2uiClientCapabilities = loaded[0].a2uiClientCapabilities;
    require(A2UI_STABLE_REVISION === '409ded29ccac3eebc541979ae5320771703248e8', 'Owned A2UI pin changed.');
    const { catalog, viewCatalog } = createReportCatalog({ createCatalog, initialCatalog, createA2uiCatalog }, sources);
    processor = new A2uiProcessor({ catalogs: [catalog] });
    shell = document.createElement('section'); shell.dataset.a2uiFixture = '';
    const onAction = event => {
      const action = event.detail; if (!sources.has(action.payload.sourceId)) return;
      const result = processor.createAction(action.surfaceId, action.nodeId, { ...owner, expectedRevision: action.revision }, reportIdentity.timestamp);
      if (result.ok) { outbound.push(result.value); status.textContent = `Source opened: ${action.payload.sourceId}`; }
    };
    createRenderer = () => createReportRenderer({ View: LyraGenViewElement, catalog: viewCatalog, onAction, signal: lifetime.signal });
    renderer = createRenderer(); view = renderer.view;
    status = document.createElement('output'); status.textContent = 'No source action';
    revoke = document.createElement('button'); revoke.type = 'button'; revoke.dataset.a2uiRevoke = ''; revoke.textContent = 'Revoke source';
    shell.append(view, status, revoke);
  };
  const snapshot = () => processor?.getSurface(reportIdentity.surfaceId);
  const readOracle = ({ operation: current, generation: requested } = {}) => {
    if (failure) throw failure;
    const id = current?.id ?? phase;
    const base = { generation, status: 'pending', fingerprint: '', connected: Boolean(shell?.isConnected), visible: visible(shell) };
    if (disposed || requested !== generation || committed !== id) return base;
    const surface = snapshot(); const source = sources.has(reportIdentity.sourceId);
    const chart = deep(view.shadowRoot, 'lr-lite-chart'), table = deep(view.shadowRoot, 'lr-table');
    if (id === 'data-updates' || id === 'source-action') require(chart === retainedChart && table === retainedTable, 'Unchanged protocol IDs lost their rendered nodes.');
    require(view.status === 'ready' && view.document.revision === surface.revision && surface.ownerId === owner.ownerId, 'Report ownership/readiness changed.');
    require(surface.catalogId === reportIdentity.catalogId && surface.surfaceId === reportIdentity.surfaceId && surface.dataRevision === (phase === 'delete-recreate' ? 1 : tick + 1), 'Report protocol state changed.');
    const expectedRows = Array.from({ length: 100 }, (_, index) => ({ c0: `Period ${index + 1}`, c1: index + 1 + tick }));
    const expectedSeries = [{ label: 'Orders', data: Array.from({ length: 100 }, (_, index) => index + 1 + tick) }];
    require(encode(surface.data.rows) === encode(expectedRows) && encode(table.rows) === encode(expectedRows), 'Report rows were lost.');
    require(encode(surface.data.series) === encode(expectedSeries) && encode(chart.datasets) === encode(expectedSeries), 'Report series were lost.');
    require(encode(chart.labels) === encode(expectedRows.map(row => row.c0)), 'Report category domain changed.');
    require(encode([...table.shadowRoot.querySelectorAll('tbody [part="cell"]')].map(cell => cell.textContent.trim())) === encode(expectedRows.flatMap(row => [row.c0, String(row.c1)])), 'Report table DOM is incomplete.');
    const chartItems = [...chart.shadowRoot.querySelectorAll('[part="data-list"] li')];
    require(chart.shadowRoot.querySelectorAll('[part="bar"]').length === 100 && chartItems.length === 100, 'Report chart DOM is sampled or missing.');
    chartItems.forEach((item, index) => require(item.textContent.replace(/[\u2066-\u2069]/gu, '').trim()
      === `Orders, Period ${index + 1}: ${index + 1 + tick} (${index + 1} of 100)`, 'Rendered chart value differs from its source.'));
    require(deep(view.shadowRoot, 'lr-stat').shadowRoot.querySelector('[part="value"]').textContent.trim() === String(5050 + tick * 100), 'Report total is wrong.');
    const citation = deep(view.shadowRoot, 'lr-citation-badge');
    require(source ? citation?.shadowRoot.querySelector('button').getAttribute('aria-label').includes(reportIdentity.sourceLabel)
      : !citation && view.shadowRoot.textContent.includes('Source unavailable'), 'Viewer source projection is wrong.');
    require(encode(a2uiClientCapabilities(processor)) === encode({ 'v0.9': { supportedCatalogIds: [] } }), 'Default catalog advertising changed.');
    if (outbound.length) {
      const action = outbound[0];
      require(action.ownerId === owner.ownerId && action.revision === 102 && action.message.version === 'v0.9.1'
        && encode(action.message.action) === encode({ name: 'inspect-source', surfaceId: reportIdentity.surfaceId, sourceComponentId: 'source', timestamp: reportIdentity.timestamp, context: { sourceId: reportIdentity.sourceId } })
        && encode(action.dataModel.surfaces[reportIdentity.surfaceId].rows) === encode(Array.from({ length: 100 }, (_, index) => ({ c0: `Period ${index + 1}`, c1: index + 101 }))), 'Native source action envelope changed.');
      require(status.textContent === 'Source opened: quarterly-report', 'Native source action has no visible result.');
    }
    return { ...base, status: 'committed', fingerprint: encode(projection(id, surface.revision, tick, outbound.length, source, staleRejected)) };
  };
  return {
    prepare(context) {
      require(!generation && !disposed, 'Owned A2UI prepare must run once.');
      generation = `A:${context.batchIndex}:${context.sampleIndex}`;
      sources.set(reportIdentity.sourceId, reportIdentity.sourceLabel);
      return { generation, manifest: context.manifest, operations: fixtureDefinitions.A.operations };
    },
    async runOperation({ operation: current, generation: requested, signal: operationSignal = signal, onArmed }) {
      require(requested === generation && !disposed, 'Stale owned A2UI operation.'); phase = current.id; committed = undefined;
      let activeSignal = operationSignal ?? lifetime.signal;
      const complete = async () => { await settle(shell); committed = phase; announceCommit(host); };
      const render = () => assignView(view, accepted(processor.toView(reportIdentity.surfaceId)), activeSignal);
      let streamStart, lastRequiredInput; const arrivals = [];
      if (phase === 'data-updates') {
        streamStart = performance.now();
        for (let index = 1; index < 100; index++) {
          await delay(streamStart + (index - 1) * 16 - performance.now(), operationSignal);
          arrivals.push({ tick: index, targetOffsetMs: (index - 1) * 16, receivedAt: performance.now() });
          accepted(processor.process(reportUpdate(index), owner)); tick = index; view.document = accepted(processor.toView(reportIdentity.surfaceId));
        }
        await delay(streamStart + 99 * 16 - performance.now(), operationSignal);
      }
      const trigger = async () => {
        if (phase === 'mount') { await initialize(activeSignal); host.append(shell); for (const message of reportMessages()) accepted(processor.process(message, owner)); await render(); retainedChart = deep(view.shadowRoot, 'lr-lite-chart'); retainedTable = deep(view.shadowRoot, 'lr-table'); }
        else if (phase === 'data-updates') { lastRequiredInput = performance.now(); arrivals.push({ tick: 100, targetOffsetMs: 99 * 16, receivedAt: lastRequiredInput }); accepted(processor.process(reportUpdate(100), owner)); tick = 100; await render(); }
        else if (phase === 'delete-recreate') {
          const oldDocument = view.document;
          accepted(processor.process({ version: 'v0.9.1', deleteSurface: { surfaceId: reportIdentity.surfaceId } }, owner));
          require(!processor.toView(reportIdentity.surfaceId).ok, 'Deleted protocol state survived.');
          view.document = undefined; await view.updateComplete; sources.set(reportIdentity.sourceId, reportIdentity.sourceLabel);
          for (const message of reportMessages()) accepted(processor.process(message, owner)); tick = 0;
          const stale = processor.createAction(reportIdentity.surfaceId, oldDocument.root.children.at(-1).id, { ...owner, expectedRevision: oldDocument.revision }, reportIdentity.timestamp);
          require(!stale.ok && stale.diagnostics[0]?.code === 'a2ui-revision', 'Retired protocol action was accepted.');
          const count = outbound.length;
          retired.dispatchEvent(new CustomEvent('lr-citation-activate', { bubbles: true, composed: true, detail: { sourceId: reportIdentity.sourceId } }));
          require(outbound.length === count, 'Retired rendered callback dispatched.'); staleRejected = true; retired = undefined; await render();
        } else throw new Error('Unexpected owned A2UI host operation.');
        await complete();
      };
      const measured = { operation: current, generation, signal: operationSignal,
        waitForCommit: ({ signal: pending }) => { activeSignal = pending; return waitCommit(host, () => readOracle({ operation: current, generation }), pending); },
        readOracle: () => readOracle({ operation: current, generation }) };
      if (current.trigger === 'host') {
        const result = await measurement.measureOperation({ ...measured, trigger });
        return streamStart === undefined ? result : { ...result, streamStart, lastRequiredInput, streamEnd: lastRequiredInput, arrivals };
      }
      const target = phase === 'source-action' ? deep(view.shadowRoot, 'lr-citation-badge').shadowRoot.querySelector('button') : revoke;
      const finish = () => { void (async () => {
        if (phase === 'revoke-source') {
          retired = deep(view.shadowRoot, 'lr-citation-badge'); retainedChart = undefined; retainedTable = undefined; sources.clear();
          const next = createRenderer(); view.replaceWith(next.view); renderer.dispose(); renderer = next; view = next.view;
          await render();
        }
        await complete();
      })().catch(error => { failure = error; announceCommit(host); }); };
      target.addEventListener('click', finish, { once: true });
      try { return await measurement.measureOperation({ ...measured, event: { target, type: 'click' }, onArmed }); }
      finally { target.removeEventListener('click', finish); }
    },
    readOracle,
    diagnose() {
      const chart = view?.shadowRoot && deep(view.shadowRoot, 'lr-lite-chart');
      const svg = chart?.shadowRoot?.querySelector('svg');
      const rect = svg?.getBoundingClientRect();
      return { phase: phase ?? null, viewStatus: view?.status ?? null, chart: chart ? {
        layout: chart.layout, categories: chart.labels.length, datasets: chart.datasets.length,
        bars: chart.shadowRoot.querySelectorAll('[part="bar"]').length,
        accessibleEntries: chart.shadowRoot.querySelectorAll('[part="data-list"] li').length,
        svgWidth: rect?.width ?? null, svgHeight: rect?.height ?? null,
      } : null };
    },
    async dispose() {
      if (!disposed) { disposed = true; lifetime.abort(); renderer?.dispose(); renderer = undefined; createRenderer = undefined; shell?.remove(); sources.clear(); outbound = []; retired = undefined; retainedChart = undefined; retainedTable = undefined; view = undefined; processor = undefined; shell = undefined; status = undefined; revoke = undefined; }
      return { connectedNodes: host.childNodes.length, connectedElements: host.querySelectorAll('*').length, retainedSources: sources.size + outbound.length, pendingOperations: measurement.pendingOperations };
    },
  };
}
