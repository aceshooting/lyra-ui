import { createReportCatalog, reportData, reportMessages, reportIdentity } from '../profile-fixture/workloads/a2ui.js';
import { sdkPayloads, sdkProseChunks, sdkToolChunks, sdkIdentity } from '../profile-fixture/workloads/ai-sdk.js';
import { createViewCatalog, assertViewSemantics, waitForChartGeometry } from '../profile-fixture/workloads/views.js';
import { deep, settle } from '../profile-fixture/workloads/text.js';

const require = (condition, message) => { if (!condition) throw new Error(message); };
const encode = value => JSON.stringify(value);
const accepted = result => { require(result.ok, 'Memory protocol admission failed.'); return result.value; };

/** Independently authored direct projection of the owned report's initial accepted cohort. */
export function directReportDefinition() {
  const data = reportData();
  return { version: '1', catalog: { id: 'lyra-report-fixture', version: '1' }, surfaceId: reportIdentity.surfaceId, revision: 2,
    root: { id: 'a2ui:0:4', type: 'stack', props: {}, children: [
      { id: 'a2ui:0:0', type: 'chart', props: { label: 'Orders by period', type: 'bar', labels: data.rows.map(row => row.c0), datasets: data.series, withDataTable: true } },
      { id: 'a2ui:0:1', type: 'table', props: { caption: 'Reviewed period totals', columns: [{ key: 'c0', label: 'Period' }, { key: 'c1', label: 'Orders' }], rows: data.rows, pageSize: 100 } },
      { id: 'a2ui:0:2', type: 'stat', props: { label: 'Reviewed orders', value: data.total } },
      { id: 'a2ui:0:3', type: 'citation', props: { sourceId: reportIdentity.sourceId, index: 1, label: reportIdentity.sourceLabel },
        action: { name: 'inspect-source', payload: { sourceId: reportIdentity.sourceId } } },
    ] } };
}
export function expectedMemoryProtocols(phase, { admission }) {
  const live = !phase.includes('disposed');
  return { phase, views: live ? 3 : 0, nodes: live ? 45 : 0, tableCells: live ? 1800 : 0,
    chartValues: live ? 900 : 0, proseCharacters: live ? 3200 : 0, owners: live && admission === 'adapters' ? 2 : 0 };
}
const loadRuntime = () => Promise.all([
  import('@aceshooting/lyra-gen/gen-view.js'), import('@aceshooting/lyra-gen/catalog.js'), import('@aceshooting/lyra-gen/runtime.js'),
  import('@aceshooting/lyra-gen/adapters/a2ui.js'), import('@aceshooting/lyra-gen/ai-sdk.js'), import('@aceshooting/lyra-ui/ai'), import('ai'),
]);

export async function createMemoryProtocols({ host, signal, admission, load = loadRuntime }) {
  require(['direct', 'adapters'].includes(admission), 'Unknown memory admission path.');
  const modules = await load(); require(!signal.aborted, 'Memory protocol initialization aborted.');
  const [{ LyraGenViewElement }, catalogLibrary, runtime, a2ui, { LyraGenAiSdkBridge }, { adaptAiSdkMessage }, { readUIMessageStream }] = modules;
  let root, prose, processor, bridge, closed = false;
  let views = [], sources = new Map();
  const catalogs = () => {
    sources.set(reportIdentity.sourceId, reportIdentity.sourceLabel);
    return { report: createReportCatalog({ ...catalogLibrary, createA2uiCatalog: a2ui.createA2uiCatalog }, sources), sdk: createViewCatalog(catalogLibrary) };
  };
  const resolveDocuments = async current => {
    const expected = directReportDefinition(), payload = sdkPayloads();
    if (admission === 'direct') return [expected, payload.data, payload.tool];
    processor = new a2ui.A2uiProcessor({ catalogs: [current.report.catalog] });
    for (const message of reportMessages()) accepted(processor.process(message, { ownerId: reportIdentity.ownerId }));
    const report = accepted(processor.toView(reportIdentity.surfaceId));
    require(encode(report) === encode(expected), 'Direct and actual A2UI report projections differ.');
    bridge = new LyraGenAiSdkBridge({ messageId: sdkIdentity.messageId, catalog: current.sdk, dataNames: ['view'], toolNames: ['show_view'] });
    let data, tool, streaming = 0, assembledProse;
    const chunks = [...sdkProseChunks(), { type: 'data-view', id: sdkIdentity.dataId, data: payload.data }, ...sdkToolChunks(payload.tool),
      { type: 'tool-input-available', toolCallId: sdkIdentity.toolId, toolName: 'show_view', input: payload.tool }, { type: 'finish', finishReason: 'stop' }];
    const stream = new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } });
    for await (const message of readUIMessageStream({ stream, terminateOnError: true })) {
      require(!signal.aborted && !closed, 'Memory SDK admission aborted.');
      const adapted = adaptAiSdkMessage(message); require(adapted, 'Actual memory SDK message failed adaptation.');
      const text = adapted.parts?.filter(part => part.type === 'text');
      if (text?.length === 1 && text[0].state === 'complete') assembledProse = text[0].text;
      for (const part of adapted.parts ?? []) {
        const result = bridge.resolve(part); if (!result) continue;
        require(result.status !== 'error', 'Memory SDK bridge rejected input.');
        if (part.id === sdkIdentity.dataId && result.document) data = result.document;
        if (part.id === sdkIdentity.toolPartId) {
          if (part.metadata?.aiSdkInputState === 'input-streaming') { streaming++; require(result.status === 'loading' && !result.document, 'Incomplete tool input became executable.'); }
          if (result.document) tool = result.document;
        }
      }
    }
    require(streaming > 0 && assembledProse === payload.prose && encode(data) === encode(payload.data) && encode(tool) === encode(payload.tool), 'Actual SDK views or prose differ from direct admission.');
    return [report, data, tool];
  };
  const ready = (view, document, snapshot) => new Promise((resolve, reject) => {
    const clear = () => { view.removeEventListener('lr-gen-ready', rendered); view.removeEventListener('lr-gen-error', failed); signal.removeEventListener('abort', stopped); };
    const stopped = () => { clear(); reject(new Error('Memory protocol render aborted.')); };
    const failed = () => { clear(); reject(new Error('Memory protocol render failed.')); };
    const rendered = event => {
      if (event.detail.surfaceId !== document.surfaceId || event.detail.revision !== document.revision) return;
      clear(); void settle(view).then(async () => { await waitForChartGeometry(deep(view.shadowRoot, 'lr-lite-chart'), signal); await settle(view); }).then(resolve, reject);
    };
    view.addEventListener('lr-gen-ready', rendered); view.addEventListener('lr-gen-error', failed); signal.addEventListener('abort', stopped, { once: true });
    if (signal.aborted) { stopped(); return; }
    if (snapshot) { try { accepted(view.restoreSnapshot(snapshot)); } catch (error) { clear(); reject(error); return; } }
    else view.document = document;
  });
  const mount = async archive => {
    require(!closed && !root && views.length === 0 && !signal.aborted, 'Dispose protocol views before mounting.');
    const current = catalogs(), documents = await resolveDocuments(current);
    require(!closed && !signal.aborted, 'Memory protocol mount aborted.');
    if (archive) require(archive.version === 1 && archive.snapshots?.length === 3 && encode(archive.snapshots.map(item => item.view)) === encode(documents), 'Saved protocol presentation changed.');
    root = host.ownerDocument.createElement('section'); root.dataset.memoryProtocols = '';
    prose = host.ownerDocument.createElement('p'); prose.textContent = sdkPayloads().prose; root.append(prose); host.append(root);
    for (let index = 0; index < documents.length; index++) {
      const view = new LyraGenViewElement(); view.catalog = index === 0 ? current.report.viewCatalog : current.sdk; view.enabledActions = [];
      views.push(view); const complete = ready(view, documents[index], archive?.snapshots[index]); root.append(view); await complete;
    }
  };
  const disposePresentation = async () => {
    for (const view of views) { view.remove(); view.document = undefined; }
    views = []; root?.remove(); root = undefined; prose = undefined;
    if (processor) {
      accepted(processor.process({ version: 'v0.9.1', deleteSurface: { surfaceId: reportIdentity.surfaceId } }, { ownerId: reportIdentity.ownerId }));
      require(!processor.getSurface(reportIdentity.surfaceId), 'Disposed A2UI owner retained its surface.');
    }
    processor = undefined; bridge?.reset(); bridge = undefined; sources.clear(); await Promise.resolve();
  };
  return {
    mount: () => mount(), restore: archive => mount(archive),
    save() { require(views.length === 3, 'Protocol presentation is missing.'); return { version: 1, snapshots: views.map(view => runtime.createSnapshot(view.document, runtime.createSurfaceState(view.document))) }; },
    releaseSources() { /* Actual transport arrays live only in the completed admission call. */ },
    disposePresentation,
    readOracle(phase) {
      if (phase.includes('disposed')) require(!root && views.length === 0 && !processor && !bridge && sources.size === 0, 'Disposed protocol owners survived.');
      else {
        require(root?.isConnected && views.length === 3 && prose.textContent === sdkPayloads().prose, 'Full protocol presentation is missing.');
        const [report, data, tool] = views, expected = directReportDefinition();
        require(encode(report.document) === encode(expected) && report.status === 'ready' && report.shadowRoot.querySelectorAll('[data-gen-id]').length === 5, 'Report accepted data or nodes changed.');
        const chart = deep(report.shadowRoot, 'lr-lite-chart'), table = deep(report.shadowRoot, 'lr-table');
        require(encode(table.rows) === encode(reportData().rows) && encode(chart.datasets) === encode(reportData().series), 'Report retained data changed.');
        require(encode([...table.shadowRoot.querySelectorAll('tbody [part="cell"]')].map(cell => cell.textContent.trim())) === encode(reportData().rows.flatMap(row => [row.c0, String(row.c1)])), 'Report rendered table changed.');
        const chartItems = [...chart.shadowRoot.querySelectorAll('[part="data-list"] li')];
        require(chart.shadowRoot.querySelectorAll('[part="bar"]').length === 100 && chartItems.length === 100
          && encode(chart.labels) === encode(reportData().rows.map(row => row.c0)), 'Report chart marks or labels changed.');
        chartItems.forEach((item, index) => require(item.textContent.replace(/[\u2066-\u2069]/gu, '').trim()
          === `Orders, Period ${index + 1}: ${index + 1} (${index + 1} of 100)`, 'Rendered report chart values changed.'));
        require(deep(report.shadowRoot, 'lr-stat').shadowRoot.querySelector('[part="value"]').textContent.trim() === '5050'
          && deep(report.shadowRoot, 'lr-citation-badge').shadowRoot.querySelector('button').getAttribute('aria-label').includes(reportIdentity.sourceLabel), 'Report source or total changed.');
        assertViewSemantics(data, { surfaceId: sdkIdentity.dataSurface }); assertViewSemantics(tool, { surfaceId: sdkIdentity.toolSurface });
        require(admission === 'direct' ? !processor && !bridge : processor?.getSurface(reportIdentity.surfaceId)?.ownerId === reportIdentity.ownerId && Boolean(bridge), 'Protocol owner parity changed.');
      }
      return expectedMemoryProtocols(phase, { admission });
    },
    metrics() { return { sourceCharacters: 0, controllerParts: 0, controllerIslands: views.length, pendingOperations: 0,
      protocolOwners: Number(Boolean(processor)) + Number(Boolean(bridge)), protocolSurfaces: views.length }; },
    async close() { if (closed) return; closed = true; await disposePresentation(); },
  };
}
