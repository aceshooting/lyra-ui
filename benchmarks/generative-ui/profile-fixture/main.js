import '@aceshooting/lyra-ui/theme.css';
import { createMeasurement, createObserverWindow, copyDiagnostic, createFirstMountRecorder } from './measurement.js';

const modules = {
  T: () => import('./workloads/text.js'), C: () => import('./workloads/chat.js'), L: () => import('./workloads/chat.js'),
  V: () => import('./workloads/views.js'), X: () => import('./workloads/views.js'), R: () => import('./workloads/views.js'),
  D: () => import('./workloads/dashboards.js'), S: () => import('./workloads/dashboards.js'),
  A: () => import('./workloads/a2ui.js'), K: () => import('./workloads/ai-sdk.js'),
};
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const host = document.querySelector('#host');
const measurement = createMeasurement();
let fixture, controller, observation, generation, recordFirstMount;
function require(condition, message) { if (!condition) throw new Error(message); }
function connectedCounts(root) {
  let nodes = 0, elements = 0;
  for (const child of root.childNodes) {
    if (!child.isConnected) continue;
    nodes++; if (child.nodeType === Node.ELEMENT_NODE) elements++;
    const inner = connectedCounts(child); nodes += inner.nodes; elements += inner.elements;
    if (child.shadowRoot) { const shadow = connectedCounts(child.shadowRoot); nodes += shadow.nodes; elements += shadow.elements; }
  }
  return { nodes, elements };
}
function browserServices(values) {
  return { ...values,
    async loadChatRecording() {
      const location = values.chatRecording;
      require(location?.url && location.sha256, 'Recording identity is required.');
      const response = await fetch(location.url, { signal: controller.signal });
      require(response.ok, 'Recording request failed.');
      const bytes = await response.arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
      require(digest === location.sha256, 'Recording bytes changed.');
      return JSON.parse(new TextDecoder().decode(bytes));
    },
    saveChatArchive: value => window.__genProfileArchive({ action: 'save', value }),
    loadChatArchive: token => window.__genProfileArchive({ action: 'load', token }),
    releaseChatArchive: token => window.__genProfileArchive({ action: 'release', token }),
  };
}
window.__genProfile = {
  async describe(workload) {
    require(Object.hasOwn(modules, workload), 'Unknown workload.');
    return (await modules[workload]()).fixtureDefinitions[workload];
  },
  async prepare(context) {
    require(!fixture && host.childNodes.length === 0 && measurement.pendingOperations === 0, 'Previous application was not disposed.');
    const module = await modules[context.cell.workload]();
    require(stable(module.fixtureDefinitions[context.cell.workload]) === stable(context.definition), 'Frozen definition changed.');
    controller = new AbortController();
    fixture = await module.createFixture({ workload: context.cell.workload, host, measurement, signal: controller.signal, services: browserServices(context.services) });
    for (const key of ['prepare', 'runOperation', 'readOracle', 'dispose']) require(typeof fixture[key] === 'function', `Fixture lacks ${key}.`);
    const prepared = await fixture.prepare({ ...context, signal: controller.signal });
    generation = prepared.generation;
    const currentFixture = fixture, currentController = controller;
    recordFirstMount = createFirstMountRecorder({ generation, isCurrent: () => fixture === currentFixture && controller === currentController && !currentController.signal.aborted });
    return prepared;
  },
  runOperation(args) {
    require(fixture && args.generation === generation, 'Operation generation changed.');
    return recordFirstMount(args.operation, () => fixture.runOperation({ ...args, signal: controller.signal, onArmed: notice => window.__genProfileArmed(notice) }));
  },
  readOracle(args) { require(fixture && args.generation === generation, 'Oracle generation changed.'); return fixture.readOracle(args); },
  async diagnose(args) {
    const result = { phase: args?.operation?.id ?? 'prepare', generation: generation ?? null };
    if (!fixture) return { ...result, unavailable: 'fixture-not-created' };
    try { result.oracle = copyDiagnostic(fixture.readOracle(args)); }
    catch { result.oracle = { unavailable: 'oracle-rejected' }; }
    if (typeof fixture.diagnose === 'function') {
      let timer;
      try {
        const extra = await Promise.race([
          Promise.resolve(fixture.diagnose({ ...args, signal: controller.signal })),
          new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Diagnostic timeout.')), 2000); }),
        ]);
        result.fixture = copyDiagnostic(extra);
      } catch { result.fixture = { unavailable: 'diagnostic-rejected-or-timed-out' }; }
      finally { clearTimeout(timer); }
    }
    return result;
  },
  startObservation() { require(!observation, 'Observation already exists.'); observation = createObserverWindow(); observation.start(); return observation.supported; },
  phase(name) { observation.phase(name); },
  finishObservation() { const result = observation.finish(); observation = undefined; return result; },
  async dispose() {
    controller?.abort(); observation?.dispose(); observation = undefined;
    const result = fixture ? await fixture.dispose() : { retainedSources: 0, pendingOperations: 0 };
    fixture = undefined; controller = undefined; generation = undefined; recordFirstMount = undefined;
    const counts = connectedCounts(host);
    return { ...result, connectedNodes: counts.nodes, connectedElements: counts.elements, pendingOperations: Math.max(result.pendingOperations ?? NaN, measurement.pendingOperations) };
  },
};
