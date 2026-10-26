import '@aceshooting/lyra-ui/theme.css';
import { createMemoryProtocols, expectedMemoryProtocols } from './protocols.js';
import { settle } from '../profile-fixture/workloads/text.js';
import { createSemanticHostExecutor, xOwnershipMetrics, validateXDisposal } from './semantic.js';

const loaders = { 'full-chat': () => import('./chat.js'), 'full-dashboard': () => import('./dashboards.js') };
const require = (condition, message) => { if (!condition) throw new Error(message); };
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const digest = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(value => value.toString(16).padStart(2, '0')).join('');
const host = document.querySelector('#host');
let application, protocols, expectedApplication, controller, context, appHost, protocolHost, archiveReceipt, xFixture, xPrepared, xExecutor;
const connected = root => {
  let nodes = 0, elements = 0;
  for (const node of root.childNodes) {
    if (!node.isConnected) continue;
    nodes++; if (node.nodeType === Node.ELEMENT_NODE) elements++;
    for (const child of [node, ...(node.shadowRoot ? [node.shadowRoot] : [])]) { const count = connected(child); nodes += count.nodes; elements += count.elements; }
  }
  return { nodes, elements };
};
const abortCheck = () => require(controller && !controller.signal.aborted, 'Memory lifecycle is aborted or absent.');
const attach = () => { host.append(appHost, protocolHost); };

window.__memoryProfile = {
  async prepare(value) {
    require(!application && !protocols && !xFixture && host.childNodes.length === 0 && !archiveReceipt, 'Previous memory lifecycle was not closed.');
    require(Object.hasOwn(loaders, value.lifecycle) && Number.isSafeInteger(value.cycle) && value.cycle >= 1 && value.cycle <= 40
      && value.admission === (value.cycle % 2 ? 'direct' : 'adapters'), 'Memory cycle identity changed.');
    context = value; controller = new AbortController();
    appHost = document.createElement('section'); appHost.dataset.memoryApplication = '';
    protocolHost = document.createElement('section'); protocolHost.dataset.memoryProtocolRegion = '';
    const module = await loaders[value.lifecycle](); abortCheck(); expectedApplication = module.expectedMemoryApplication;
    require(typeof expectedApplication === 'function', 'Independent application projection is missing.');
    application = await module.createMemoryApplication({ host: appHost, signal: controller.signal, services: value.services, cycle: value.cycle });
    abortCheck(); protocols = await createMemoryProtocols({ host: protocolHost, signal: controller.signal, admission: value.admission }); abortCheck();
  },
  async mount() { abortCheck(); attach(); await application.mount(); await protocols.mount(); abortCheck(); },
  nativeActions(stage) { abortCheck(); return application.nativeActions(stage); },
  armNative(id) { abortCheck(); return application.armNative(id); },
  async completeNative(id) { await application.completeNative(id); abortCheck(); },
  async completeMount() { await application.completeMount(); abortCheck(); },
  async save() {
    abortCheck(); require(!archiveReceipt, 'Only one external archive slot is permitted.');
    const saved = { version: 1, lifecycle: context.lifecycle, cycle: context.cycle, admission: context.admission,
      application: await application.save(), protocols: protocols.save() };
    const text = JSON.stringify(saved), bytes = new TextEncoder().encode(text).byteLength;
    require(bytes > 0 && bytes <= 524288, 'Complete memory archive exceeds512KiB.');
    const sha256 = await digest(text), receipt = await window.__memoryArchive({ action: 'save', text });
    abortCheck(); require(receipt.bytes === bytes && receipt.sha256 === sha256, 'External archive receipt changed.');
    archiveReceipt = { bytes, sha256 }; return archiveReceipt;
  },
  async releaseSources() {
    await application.releaseSources(); await protocols.releaseSources(); abortCheck();
    require(application.metrics().sourceCharacters === 0 && protocols.metrics().sourceCharacters === 0, 'Source release retained transport.');
  },
  async disposePresentation() { await application.disposePresentation(); await protocols.disposePresentation(); host.replaceChildren(); },
  async restore() {
    abortCheck(); require(archiveReceipt && host.childNodes.length === 0, 'Restore needs one external archive and a disposed presentation.');
    const text = await window.__memoryArchive({ action: 'load' });
    require(typeof text === 'string' && new TextEncoder().encode(text).byteLength === archiveReceipt.bytes && await digest(text) === archiveReceipt.sha256, 'Stored archive changed.');
    const saved = JSON.parse(text);
    require(saved.version === 1 && saved.lifecycle === context.lifecycle && saved.cycle === context.cycle && saved.admission === context.admission, 'Stored archive ownership changed.');
    abortCheck(); attach(); await application.restore(saved.application); await protocols.restore(saved.protocols); abortCheck();
  },
  async applyHigherRevision() { await application.applyHigherRevision(); abortCheck(); },
  async releaseArchive() { if (archiveReceipt) { await window.__memoryArchive({ action: 'release' }); archiveReceipt = undefined; } },
  readOracle(phase) {
    abortCheck();
    const actual = { application: application.readOracle(phase), protocols: protocols.readOracle(phase) };
    const expected = { application: expectedApplication(phase, { cycle: context.cycle }), protocols: expectedMemoryProtocols(phase, context) };
    require(stable(actual) === stable(expected), 'Memory application or protocol semantic projection changed.');
    if (phase.includes('disposed')) require(connected(host).nodes === 0, 'Disposed memory presentation still has connected nodes.');
    return { semanticAssertionsPassed: true, fingerprint: stable(actual) };
  },
  metrics() {
    const count = connected(host), base = xFixture ? xOwnershipMetrics(xPrepared, xExecutor, [...host.querySelectorAll('lr-gen-view')]) : application?.metrics(), protocol = protocols?.metrics();
    return { connectedFixtureNodes: count.nodes, connectedFixtureElements: count.elements,
      sourceCharacters: (base?.sourceCharacters ?? 0) + (protocol?.sourceCharacters ?? 0),
      controllerParts: (base?.controllerParts ?? 0) + (protocol?.controllerParts ?? 0),
      controllerIslands: (base?.controllerIslands ?? 0) + (protocol?.controllerIslands ?? 0),
      pendingOperations: (base?.pendingOperations ?? 0) + (protocol?.pendingOperations ?? 0), actions: base?.actions ?? 0,
      protocolOwners: protocol?.protocolOwners ?? 0, protocolSurfaces: protocol?.protocolSurfaces ?? 0,
      externalArchiveBytes: archiveReceipt?.bytes ?? 0 };
  },
  async settle() {
    await settle(host); require(document.fonts && document.visibilityState === 'visible', 'Memory page font/foreground precondition failed.'); await document.fonts.ready;
    for (let frame = 0; frame < 2; frame++) await new Promise(resolve => requestAnimationFrame(resolve));
    require(document.visibilityState === 'visible', 'Memory page became hidden.');
  },
  async mountX(value) {
    require(!application && !protocols && !xFixture && host.childNodes.length === 0, 'X requires a separate empty page.');
    context = value; controller = new AbortController();
    const { createFixture, fixtureDefinitions } = await import('../profile-fixture/workloads/views.js');
    xExecutor = createSemanticHostExecutor();
    xFixture = await createFixture({ workload: 'X', host, signal: controller.signal, services: value.services, measurement: xExecutor });
    xPrepared = await xFixture.prepare({ definition: fixtureDefinitions.X, manifest: { workload: 'X', sha256: value.fixtureSha256 } });
    const operation = xPrepared.operations[0]; await xFixture.runOperation({ operation, generation: xPrepared.generation, signal: controller.signal });
    const oracle = xFixture.readOracle({ operation, generation: xPrepared.generation });
    require(oracle.status === 'committed' && oracle.fingerprint === operation.expectedFingerprint && oracle.connected && oracle.visible, 'X full retained-data and geometry oracle failed.');
    return { semanticAssertionsPassed: true, fingerprint: oracle.fingerprint };
  },
  async disposeX() {
    const receipt = validateXDisposal(await xFixture.dispose(), connected(host), xExecutor);
    xFixture = undefined; xPrepared = undefined; xExecutor = undefined;
    return { ...this.metrics(), fixtureDisposal: receipt };
  },
  readXOracle() {
    require(xFixture && xPrepared, 'X is not mounted.');
    const operation = xPrepared.operations[0], oracle = xFixture.readOracle({ operation, generation: xPrepared.generation });
    require(oracle.status === 'committed' && oracle.fingerprint === operation.expectedFingerprint && oracle.connected && oracle.visible, 'X changed after its live observation.');
    return { semanticAssertionsPassed: true, fingerprint: oracle.fingerprint };
  },
  async close() {
    controller?.abort();
    try { await application?.close(); } finally { try { await protocols?.close(); } finally { await xFixture?.dispose(); } }
    await this.releaseArchive(); host.replaceChildren();
    application = undefined; protocols = undefined; expectedApplication = undefined; controller = undefined; context = undefined;
    appHost = undefined; protocolHost = undefined; xFixture = undefined; xPrepared = undefined; xExecutor = undefined;
  },
};
