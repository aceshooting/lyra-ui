import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { createLiveUniverse, liveQueryResult, createSavedDefinition, createSavedSource, projectSavedDefinition, dashboardInputIdentity, serializeDashboardDefinition, describeDashboardDefinition, fixtureDefinitions, createFixture, assertDashboardPin, waitForDashboardView, assertDashboardChartShape } from './dashboards.js';
import { createHostServices } from './dashboards-host.mjs';

const require = createRequire(new URL('../../../../packages/lyra-gen/package.json', import.meta.url));
const loadLibrary = specifier => import(pathToFileURL(require.resolve(specifier)).href);
const find = (view, id) => { const visit = node => node.id === id ? node : node.children?.map(visit).find(Boolean); return visit(view.root); };

test('live fixture has exact page/filter universe and lineage without retaining all rows in a result', () => {
  const universe = createLiveUniverse(); assert.equal(universe.length, 1000);
  const first = liveQueryResult(universe), next = liveQueryResult(universe, { offset: 100 }), filtered = liveQueryResult(universe, { category: 'Focus' });
  assert.equal(first.data.length, 100); assert.deepEqual(next.data[0], { c0: 'Record-100', c1: 101 });
  assert.equal(filtered.data.length, 50); assert.equal(filtered.data.at(-1).c0, 'Focus-049');
  assert.equal(Object.keys(first.lineage).length, 200); assert.equal(first.lineage['/99/c1'], first.sources[0].id);
  assert.notEqual(first.data[0], universe[0]);
  assert.throws(() => liveQueryResult(universe, { limit: 101 }));
  const operations = fixtureDefinitions.D.operations;
  for (const id of ['delayed-cancel', 'delayed-supersede', 'delayed-reconnect']) assert.equal(operations.find(item => item.id === id).kind, 'delayed');
  assert.equal(JSON.parse(operations.find(item => item.id === 'queue-burst').expectedFingerprint).dropped, 16);
  assert.equal(JSON.parse(operations.at(-1).expectedFingerprint).rows, 0);
});

test('saved definition stores one source and no datasets; independent projection restores exact V bounds', () => {
  const definition = createSavedDefinition(), source = createSavedSource();
  assert.equal(definition.dataSources.length, 1); assert.equal(find(definition.view, 'table').props.rows.length, 0);
  assert.deepEqual(find(definition.view, 'chart').props.datasets, []);
  const projected = projectSavedDefinition(definition, source);
  assert.equal(find(projected, 'table').props.rows.length, 100); assert.equal(find(projected, 'table').props.columns.length, 8);
  assert.equal(find(projected, 'chart').props.datasets.length, 4); assert.equal(find(projected, 'chart').props.labels.length, 100);
  assert.equal(find(projected, 'chart').props.datasets[0].data.filter(value => value === null).length, 10);
  assert.equal(find(definition.view, 'table').props.rows.length, 0);
  assert.throws(() => projectSavedDefinition(definition, { ...source, rows: source.rows.slice(1) }));
  assert.throws(() => projectSavedDefinition({ ...definition, dataSources: [{ id: 'untrusted', source: 'other' }] }, source));
});

async function hostFixture(t) {
  const scratchDirectory = await mkdtemp(path.join(os.tmpdir(), 'lyra-profile-saved-'));
  t.after(() => rm(scratchDirectory, { recursive: true, force: true }));
  const service = await createHostServices({ loadLibrary, scratchDirectory });
  t.after(() => service.dispose());
  const route = service.routes[0];
  assert.equal(service.routes.length, 1); assert.equal(route.path, '/host/dashboard'); assert.deepEqual(route.methods, ['POST']);
  const request = async (operation, values = {}, session = 'viewer') => {
    const response = await route.handle({ method: 'POST', headers: { 'x-fixture-session': session }, body: new TextEncoder().encode(JSON.stringify({ operation, ...values })) });
    assert.ok(new TextEncoder().encode(response.body).byteLength <= 262144);
    return { status: response.status, ...JSON.parse(response.body) };
  };
  return { request, service, scratchDirectory };
}

test('real saved host seeds bounded file state and returns populated source only after viewer authorization', async t => {
  const { request, scratchDirectory } = await hostFixture(t);
  const reset = await request('reset', {}, 'author'); assert.equal(reset.status, 200);
  const opened = await request('resolve'); assert.equal(opened.value.selectedRevision, 2);
  assert.equal(find(opened.value.definition.view, 'table').props.rows.length, 0);
  const data = await request('data'); assert.equal(data.value.rows.length, 100);
  const state = await request('load-state'); assert.deepEqual(state.value, { revision: 1, state: { version: 1, values: { note: 'Model default' } } });
  assert.ok(opened.server.some(entry => entry.operation === 'read' && entry.durationMs >= 0));
  const directories = await readdir(scratchDirectory); assert.equal(directories.length, 1);
  const disk = JSON.parse(await readFile(path.join(scratchDirectory, directories[0], 'dashboards.json'), 'utf8'));
  assert.equal(Object.keys(disk.records).length, 1); assert.equal(disk.records['saved-profile'].history.length, 2);
  assert.equal(Object.keys(disk.instances).length, 1);
  assert.equal((await request('resolve', {}, 'other-tenant')).status, 403);
  assert.equal((await request('update', { expectedRevision: 2, definition: createSavedDefinition('Forbidden') })).status, 403);
});

test('saved host commits exact CAS, retains conflict proposal, follows publication and persists scoped instance state', async t => {
  const { request } = await hostFixture(t); await request('reset', {}, 'author');
  const proposal = createSavedDefinition('Edited report');
  const written = await request('update', { expectedRevision: 2, definition: proposal }, 'editor');
  assert.equal(written.value.metadata.revision, 3); assert.ok(written.server.some(entry => entry.operation === 'cas'));
  const stale = await request('update', { expectedRevision: 2, definition: createSavedDefinition('Unsaved proposal') }, 'editor');
  assert.equal(stale.status, 409); assert.equal(stale.proposed.title, 'Unsaved proposal');
  assert.equal((await request('resolve')).value.definition.title, 'Saved report');
  assert.equal((await request('publish', { expectedRevision: 3 }, 'editor')).status, 403);
  assert.equal((await request('publish', { expectedRevision: 3 }, 'author')).value.metadata.revision, 4);
  assert.equal((await request('resolve')).value.definition.title, 'Edited report');
  const saved = await request('save-state', { expectedRevision: 1, state: { version: 1, values: { note: 'Personal saved note' } } });
  assert.equal(saved.value.revision, 2); assert.equal((await request('load-state')).value.state.values.note, 'Personal saved note');
  assert.equal((await request('save-state', { expectedRevision: 1, state: { version: 1, values: { note: 'Stale' } } })).status, 409);
  assert.equal((await request('load-state', {}, 'editor')).value, null);
  assert.equal((await request('revoke', {}, 'author')).status, 200);
  assert.equal((await request('data')).status, 403); assert.equal((await request('load-state')).status, 403);
});

test('saved service refuses missing sessions, unknown operations/fields and cleans only its owned directory', async t => {
  const { request, service, scratchDirectory } = await hostFixture(t);
  assert.equal((await request('reset', {}, 'missing')).status, 403);
  assert.equal((await request('outside', {}, 'author')).status, 400);
  assert.equal((await request('resolve', { path: '/outside' }, 'author')).status, 400);
  await service.dispose(); await service.dispose();
  assert.deepEqual(await readdir(scratchDirectory), []);
});

test('concurrent saved proposals against one storage revision permit exactly one file CAS', async t => {
  const { request } = await hostFixture(t); await request('reset', {}, 'author');
  const results = await Promise.all(['First proposal', 'Second proposal'].map(title => request('update', { expectedRevision: 2, definition: createSavedDefinition(title) }, 'editor')));
  assert.deepEqual(results.map(result => result.status), [200, 409]);
  assert.equal(results[1].proposed.title, 'Second proposal');
  const current = await request('read', {}, 'editor'); assert.equal(current.value.metadata.revision, 3); assert.equal(current.value.definition.title, 'First proposal');
});


test('descriptor manifests count the actual serialized fixed data and retain frozen negative-path operations', () => {
  for (const workload of ['D', 'S']) {
    const text = serializeDashboardDefinition(workload), manifest = describeDashboardDefinition(workload), definition = fixtureDefinitions[workload];
    assert.equal(manifest.jsonUtf8Bytes, new TextEncoder().encode(text).length);
    assert.equal(manifest.jsonUtf16Units, text.length);
    assert.equal(manifest.generatedNodes, workload === 'D' ? 4 : 20);
    assert.deepEqual(definition.serialized, manifest);
    assert.ok(Object.isFrozen(definition.operations) && Object.isFrozen(definition.operations[0]));
    assert.equal(new Set(definition.operations.map(operation => operation.id)).size, definition.operations.length);
    assert.ok(definition.operations.every(operation => JSON.parse(operation.expectedFingerprint).phase === operation.id));
    assert.ok(definition.operations.filter(operation => operation.trigger === 'event').every(operation => operation.native.selector && ['click', 'fill', 'press'].includes(operation.native.action)));
  }
  for (const id of ['conflict', 'viewer-denied', 'tenant-denied', 'revoke']) assert.ok(fixtureDefinitions.S.operations.some(operation => operation.id === id));
});


test('prepare input identity hashes exact D/S serialization independently of descriptor metadata', async () => {
  for (const workload of ['D', 'S']) {
    const text = serializeDashboardDefinition(workload), identity = await dashboardInputIdentity(workload);
    assert.deepEqual(identity, { json: { sha256: createHash('sha256').update(text).digest('hex'), utf8Bytes: Buffer.byteLength(text), utf16Units: text.length } });
  }
});

for (const workload of ['D', 'S']) {
  test(`${workload} fixture creation and disposal leave production imports and controllers uninitialized`, async () => {
    let loads = 0;
    const fixture = await createFixture({ workload, host: { childNodes: [], querySelectorAll: () => [] }, measurement: { pendingOperations: 0 },
      signal: new AbortController().signal, services: { dashboard: { url: '/host/dashboard', simulatedSessions: true } },
      loadRuntime: async () => { loads++; throw new Error('Runtime must load inside a timed operation.'); } });
    assert.equal(loads, 0);
    assert.deepEqual(await fixture.dispose(), { connectedNodes: 0, connectedElements: 0, retainedSources: 0, pendingOperations: 0 });
    assert.equal(loads, 0);
  });
}

class InertElement extends EventTarget {
  dataset = {}; style = {}; childNodes = []; children = []; isConnected = false;
  append(...elements) { this.childNodes.push(...elements); this.children.push(...elements); }
  setAttribute() {}
  remove() {}
  querySelectorAll(selector) { return selector === '*' ? this.children.flatMap(child => [child, ...child.querySelectorAll('*')]) : []; }
  querySelector(selector) { return this.querySelectorAll('*').find(child => selector === `[data-saved-action="${child.dataset.savedAction}"]`); }
}

for (const workload of ['D', 'S']) for (const interruption of ['dispose', 'abort']) {
  test(`${workload} prepares inertly and cannot construct after ${interruption} during its first timed import`, async t => {
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => new InertElement() } });
    t.after(() => { if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else delete globalThis.document; });
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ value: {}, server: [] }), { status: 200 }));
    const host = new InertElement();
    let release, imports = 0, constructions = 0, released = false;
    const loading = new Promise(resolve => { release = resolve; });
    const measurement = { pendingOperations: 0, async measureOperation({ trigger, event }) {
      if (trigger) return trigger();
      const completed = new Promise(resolve => host.addEventListener('fixture-commit', () => { if (released) resolve(); }));
      event.target.dispatchEvent(new Event(event.type));
      return completed;
    } };
    const controller = new AbortController();
    const fixture = await createFixture({ workload, host, measurement, signal: controller.signal,
      services: { dashboard: { url: '/host/dashboard', simulatedSessions: true } }, loadRuntime: () => { imports++; return loading; } });
    const prepared = await fixture.prepare({ batchIndex: 0, sampleIndex: 0, manifest: {} });
    assert.equal(imports, 0); assert.equal(host.childNodes.length, 0);
    const operations = fixtureDefinitions[workload].operations;
    if (workload === 'S') await fixture.runOperation({ operation: operations[0], generation: prepared.generation });
    const pending = fixture.runOperation({ operation: operations[workload === 'D' ? 0 : 1], generation: prepared.generation });
    void pending.catch(() => {});
    await Promise.resolve(); await Promise.resolve();
    assert.equal(imports, 1);
    if (interruption === 'dispose') await fixture.dispose(); else controller.abort();
    class UnexpectedRuntime { constructor() { constructions++; throw new Error('Disposed fixture constructed runtime.'); } }
    released = true;
    release({ HostQueryRegistry: UnexpectedRuntime, DashboardApplication: UnexpectedRuntime,
      LyraDashboardGrid: UnexpectedRuntime, DashboardGridBinding: UnexpectedRuntime,
      library: { createCatalog: () => { constructions++; throw new Error('Disposed fixture constructed catalog.'); }, initialCatalog: {} } });
    if (workload === 'D') await assert.rejects(pending, /initialization was aborted/); else await pending;
    assert.equal(constructions, 0);
    await fixture.dispose();
  });
}


test('pin oracle accepts normalized unlocked cells but rejects missing cells and mismatched locks', async () => {
  const { resolveLyraDashboardPlacement } = await loadLibrary('@aceshooting/lyra-ui/components/lr-dashboard-grid.js');
  const original = [{ cellId: 'table', x: 0, y: 0, w: 3, h: 4, locked: false }];
  const normalized = resolveLyraDashboardPlacement(original, 'table', { x: 0, y: 1, w: 3, h: 4 }, 6, 'reject').layout;
  assert.equal(normalized[0].locked, undefined);
  assert.doesNotThrow(() => assertDashboardPin(normalized, 'table', false));
  assert.doesNotThrow(() => assertDashboardPin([{ ...normalized[0], locked: true }], 'table', true));
  assert.throws(() => assertDashboardPin(normalized, 'table', true), /Pin is not applied/);
  assert.throws(() => assertDashboardPin([{ ...normalized[0], locked: true }], 'table', false), /Pin is not applied/);
  assert.throws(() => assertDashboardPin([], 'table', false), /Pin is not applied/);
});

test('saved view readiness waits for current rendering, rejects failure/abort and accepts already-ready views', async () => {
  const view = new EventTarget(); view.status = 'loading';
  const controller = new AbortController(); let ready = false;
  const waiting = waitForDashboardView(view, controller.signal).then(() => { ready = true; });
  view.dispatchEvent(new Event('lr-gen-ready')); await Promise.resolve(); assert.equal(ready, false);
  view.status = 'ready'; view.dispatchEvent(new Event('lr-gen-ready')); await waiting;
  await waitForDashboardView(view, controller.signal);
  view.status = 'loading'; const interrupted = waitForDashboardView(view, controller.signal); controller.abort();
  await assert.rejects(interrupted, /readiness aborted/);
  view.status = 'error'; await assert.rejects(waitForDashboardView(view, new AbortController().signal), /failed to render/);
});


test('drilldown may hide coordinate marks while retaining full data; returning to overview requires all marks', () => {
  let marks = 0;
  const chart = { labels: Array.from({ length: 100 }, (_, index) => `Category ${index}`), datasets: [{ data: Array.from({ length: 100 }, (_, index) => index + 1) }], shadowRoot: { querySelectorAll: () => ({ length: marks }) } };
  assert.doesNotThrow(() => assertDashboardChartShape(chart, 100, false));
  assert.throws(() => assertDashboardChartShape(chart, 100, true), /observations were truncated/);
  marks = 100; assert.doesNotThrow(() => assertDashboardChartShape(chart, 100, true));
  chart.datasets[0].data.pop();
  assert.throws(() => assertDashboardChartShape(chart, 100, false), /Wrong chart bounds/);
});
