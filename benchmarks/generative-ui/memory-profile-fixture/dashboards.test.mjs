import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { createMemoryApplication, dashboardMemoryNotes, expectedMemoryApplication, validateMemoryDashboardArchive, waitForMemoryDashboardView, validateMemoryDashboardAction } from './dashboards.js';
import { createLiveUniverse, liveQueryResult, createSavedCatalog, createSavedDefinition, createSavedSource, projectSavedDefinition } from '../profile-fixture/workloads/dashboards.js';

const require = createRequire(new URL('../../../packages/lyra-gen/package.json', import.meta.url));
const loadLibrary = name => import(pathToFileURL(require.resolve(name)).href);
const host = () => ({ childNodes: [] });
const services = { dashboard: { url: '/host/dashboard', documentId: 'saved-profile', simulatedSessions: true } };
async function archiveFixture(cycle = 1) {
  const runtime = await loadLibrary('@aceshooting/lyra-gen/runtime.js');
  const catalogLibrary = await loadLibrary('@aceshooting/lyra-gen/catalog.js');
  const catalog = createSavedCatalog(catalogLibrary), notes = dashboardMemoryNotes(cycle);
  const page = liveQueryResult(createLiveUniverse()).data;
  const live = [
    { version: '1', surfaceId: 'table', revision: 2, catalog: { id: catalogLibrary.initialCatalog.id, version: '1' }, root: { id: 'table-root', type: 'stack', children: [
      { id: 'note', type: 'input', props: { label: 'Personal note', value: '', name: 'note' }, bindings: { value: '/note' } },
      { id: 'records', type: 'table', props: { caption: 'Report records', columns: [{ key: 'c0', label: 'Category' }, { key: 'c1', label: 'Value' }], rows: page, pageSize: 100 } },
    ] } },
    { version: '1', surfaceId: 'chart', revision: 2, catalog: { id: catalogLibrary.initialCatalog.id, version: '1' }, root: { id: 'summary', type: 'chart', props: {
      label: 'Report categories', type: 'bar', labels: page.map(row => row.c0), datasets: [{ label: 'Value', data: page.map(row => row.c1) }], withDataTable: true,
    } } },
  ];
  const saved = projectSavedDefinition(createSavedDefinition(), createSavedSource());
  const snapshot = (view, note) => {
    let state = runtime.createSurfaceState(view);
    if (note) { const edited = runtime.setSurfaceState(state, '/note', note); assert.equal(edited.ok, true); state = edited.value; }
    return runtime.createSnapshot(view, state);
  };
  return { runtime, catalog, initialCatalog: catalogLibrary.initialCatalog, archive: { version: 1, cycle, instanceRevision: 2,
    layout: { version: 1, revision: 0, panels: [{ id: 'table', column: 0, row: 0, width: 3, height: 4 }, { id: 'chart', column: 3, row: 0, width: 3, height: 4 }] },
    live: live.map((view, index) => snapshot(view, index === 0 ? notes.live : undefined)), saved: snapshot(saved, notes.saved) } };
}

test('memory phases retain the full D plus V dimensions and exactly two native actions', () => {
  for (const phase of ['mounted', 'released', 'restored']) {
    const expected = expectedMemoryApplication(phase, { cycle: 3 });
    assert.deepEqual([expected.livePanels, expected.liveRows, expected.liveColumns, expected.liveSeries], [2, 100, 2, 1]);
    assert.deepEqual([expected.savedPanels, expected.savedRows, expected.savedColumns, expected.savedSeries, expected.categories], [1, 100, 8, 4, 100]);
    assert.equal(expected.actions, 1); assert.equal(expected.higherDefault, phase === 'restored');
  }
  for (const phase of ['disposed', 'restored-disposed']) {
    const expected = expectedMemoryApplication(phase, { cycle: 3 });
    for (const key of ['livePanels', 'liveRows', 'liveColumns', 'liveSeries', 'savedPanels', 'savedRows', 'savedColumns', 'savedSeries', 'categories']) assert.equal(expected[key], 0);
    assert.equal(expected.actions, phase === 'disposed' ? 1 : 2);
  }
  assert.throws(() => dashboardMemoryNotes(0)); assert.throws(() => expectedMemoryApplication('unknown', { cycle: 1 }));
});

test('accepted full dashboard archive uses public snapshots and preserves dirty ownership through higher defaults', async () => {
  const { archive, runtime, catalog, initialCatalog } = await archiveFixture(7);
  assert.equal(validateMemoryDashboardArchive(archive, 7), archive);
  assert.ok(Buffer.byteLength(JSON.stringify(archive)) < 512 * 1024);
  assert.equal(archive.live[0].view.root.children[1].props.rows.length, 100);
  assert.equal(archive.saved.view.root.children.find(node => node.id === 'table').props.rows.length, 100);
  for (const [snapshot, selectedCatalog] of [[archive.live[0], initialCatalog], [archive.live[1], initialCatalog], [archive.saved, catalog]]) {
    const restored = runtime.restoreSnapshot(snapshot, selectedCatalog); assert.equal(restored.ok, true);
    if (snapshot.state.dirty.includes('/note')) {
      const next = structuredClone(snapshot.view); next.revision++;
      const find = node => node.id === 'note' ? node : node.children?.map(find).find(Boolean);
      find(next.root).props.value = 'A newer generated default';
      const reconciled = runtime.reconcileSurfaceState(restored.value.state, restored.value.view, next);
      assert.equal(reconciled.ok, true); assert.equal(reconciled.value.values.note, snapshot.state.values.note); assert.deepEqual(reconciled.value.dirty, ['/note']);
    }
  }
});

test('dashboard archive rejects missing dirty state, cross-cycle identities, mismatched revisions and overflow', async () => {
  const { archive } = await archiveFixture();
  for (const mutate of [value => { value.saved.state.dirty = []; }, value => { value.live[0].state.values.note = 'Model default'; },
    value => { value.saved.state.revision++; }, value => { value.live.pop(); }, value => { value.instanceRevision = 0; },
    value => { value.saved.view.root.text = 'x'.repeat(512 * 1024); }]) {
    const changed = structuredClone(archive); mutate(changed); assert.throws(() => validateMemoryDashboardArchive(changed, 1));
  }
  assert.throws(() => validateMemoryDashboardArchive(archive, 2));
});

test('memory facade creation is inert and disposal releases all owned counters before mounting', async () => {
  let loads = 0;
  const app = await createMemoryApplication({ host: host(), services, cycle: 1, signal: new AbortController().signal,
    load: async () => { loads++; throw new Error('Unexpected runtime load.'); } });
  assert.equal(loads, 0);
  assert.deepEqual(app.nativeActions('initial').map(action => action.id), ['edit-live-note', 'edit-saved-note', 'save-initial']);
  assert.deepEqual(app.nativeActions('presentation'), []); assert.deepEqual(app.nativeActions('second').map(action => action.id), ['save-restored']);
  assert.throws(() => app.armNative('save-initial'), /unmounted/);
  await app.disposePresentation(); await app.close(); await app.close();
  assert.equal(loads, 0); assert.deepEqual(app.metrics(), { sourceCharacters: 0, controllerParts: 0, controllerIslands: 0, pendingOperations: 0, actions: 0 });
});

for (const interruption of ['dispose', 'abort', 'close']) {
  test(`pending memory runtime load cannot construct after ${interruption}, and teardown drains it`, async () => {
    let release, constructions = 0;
    const pending = new Promise(resolve => { release = resolve; }), controller = new AbortController();
    const app = await createMemoryApplication({ host: host(), services, cycle: 1, signal: controller.signal, load: () => pending });
    const mounting = app.mount(); void mounting.catch(() => {});
    const disposing = interruption === 'close' ? app.close() : interruption === 'dispose' ? app.disposePresentation() : (controller.abort(), app.disposePresentation());
    release({ catalog: { createCatalog() { constructions++; throw new Error('Aborted catalog constructed.'); }, initialCatalog: {} } });
    await assert.rejects(mounting, /aborted/); await disposing;
    assert.equal(constructions, 0); assert.equal(app.metrics().pendingOperations, 0); assert.equal(app.metrics().controllerIslands, 0);
    await app.close();
  });
}

test('a failed runtime load is released without creating host DOM or suppressing its original error', async () => {
  const app = await createMemoryApplication({ host: host(), services, cycle: 1, signal: new AbortController().signal,
    load: async () => { throw new Error('Fixture load failed.'); } });
  await assert.rejects(app.mount(), /Fixture load failed/);
  assert.deepEqual(app.metrics(), { sourceCharacters: 0, controllerParts: 0, controllerIslands: 0, pendingOperations: 0, actions: 0 });
  await app.close();
});


test('archive retains advancing instance CAS revisions across cycles without assuming a reset', async () => {
  const { archive } = await archiveFixture(40); archive.instanceRevision = 44;
  assert.equal(validateMemoryDashboardArchive(archive, 40).instanceRevision, 44);
  archive.instanceRevision = 1.5; assert.throws(() => validateMemoryDashboardArchive(archive, 40));
});

test('same-revision public busy state completes memory restore without another ready event', async () => {
  let notify, disconnected = 0;
  class Observer { constructor(callback) { notify = callback; } observe(_view, options) { assert.deepEqual(options.attributeFilter, ['aria-busy']); } disconnect() { disconnected++; } }
  const view = new EventTarget(); view.status = 'loading'; let finished = false;
  const controller = new AbortController();
  const waiting = waitForMemoryDashboardView(view, controller.signal, { Observer }).then(() => { finished = true; });
  notify(); await Promise.resolve(); assert.equal(finished, false);
  view.status = 'ready'; notify(); await waiting; assert.equal(disconnected, 1);
  view.status = 'loading'; const aborted = waitForMemoryDashboardView(view, controller.signal, { Observer }); controller.abort();
  await assert.rejects(aborted, /readiness aborted/); assert.equal(disconnected, 2);
  view.status = 'error'; await assert.rejects(waitForMemoryDashboardView(view, new AbortController().signal, { Observer }), /view failed/);
  assert.equal(disconnected, 3);
});


test('actual admitted form actions preserve dirty payloads and reject replay, stale revisions and changed owners', async () => {
  const { archive, runtime, catalog } = await archiveFixture(4);
  const first = runtime.createAction(archive.saved.view, 'form', catalog, archive.saved.state.values); assert.equal(first.ok, true);
  assert.equal(validateMemoryDashboardAction(first.value, { cycle: 4, higherDefault: false, actions: 0 }), 1);
  assert.throws(() => validateMemoryDashboardAction(first.value, { cycle: 4, higherDefault: false, actions: 1 }), /replayed/);
  assert.throws(() => validateMemoryDashboardAction(first.value, { cycle: 4, higherDefault: true, actions: 1 }), /identity/);
  const next = structuredClone(archive.saved.view); next.revision = 1;
  const second = runtime.createAction(next, 'form', catalog, archive.saved.state.values); assert.equal(second.ok, true);
  assert.equal(validateMemoryDashboardAction(second.value, { cycle: 4, higherDefault: true, actions: 1 }), 2);
  assert.throws(() => validateMemoryDashboardAction({ ...second.value, surfaceId: 'other' }, { cycle: 4, higherDefault: true, actions: 1 }), /identity/);
  assert.throws(() => validateMemoryDashboardAction({ ...second.value, payload: { ...second.value.payload, note: 'New model default' } }, { cycle: 4, higherDefault: true, actions: 1 }), /dirty form/);
});
