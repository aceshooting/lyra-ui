import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrateStoredAnswer } from './answer-migrations.js';
import { validateDashboardDefinition } from './persistence.js';
import { resolveReferences } from './references.js';
import { restoreSnapshot } from './runtime.js';
import { anotherSnapshotViewer, currentSnapshotCatalog, dashboardFromSnapshot, foreignSnapshotViewer, legacyPrivateSnapshot, legacySnapshotCatalog, migrateSharedSnapshot, redactSharedSnapshot, snapshotHost, snapshotOwner, snapshotValue, snapshotViewer } from '../test/fixtures/dashboard-snapshot.js';

test('cross-version sharing explicitly redacts private state and cached values while retaining permitted presentation and edits', async () => {
  const original = legacyPrivateSnapshot();
  const before = JSON.stringify(original);
  const legacyHost = snapshotHost(legacySnapshotCatalog);
  const id = await legacyHost.publish(dashboardFromSnapshot(original));
  const exported = await legacyHost.store.export(snapshotOwner, id);
  assert.equal('metadata' in exported, false);
  assert.equal('state' in exported, false);
  const shared = redactSharedSnapshot({ ...original, view: exported.view });
  assert.equal(JSON.stringify(shared).includes('Author-only'), false);
  assert.equal(JSON.stringify(shared).includes('98765'), false);
  const migrated = snapshotValue(migrateSharedSnapshot(JSON.parse(JSON.stringify(shared))));
  assert.equal(migrated.definition.version, 1);
  assert.deepEqual(migrated.snapshot.view.catalog, { id: 'shared-snapshot', version: '2' });
  assert.equal(migrated.snapshot.view.surfaceId, original.view.surfaceId);
  assert.equal(migrated.snapshot.view.revision, original.view.revision);
  assert.equal(migrated.snapshot.view.root.children?.find(node => node.id === 'heading')?.text, 'Permitted inventory overview');
  assert.deepEqual(migrated.snapshot.state.values, { filter: 'Notebooks', note: '' });
  assert.deepEqual(migrated.snapshot.state.dirty, ['/filter']);
  assert.deepEqual(migrated.snapshot.view.root.children?.find(node => node.id === 'inspect')?.action, { name: 'inspect', payload: null });
  assert.deepEqual(snapshotValue(restoreSnapshot(migrated.snapshot, currentSnapshotCatalog)).state.values, { filter: 'Notebooks', note: '' });
  assert.equal(JSON.stringify(original), before);
  const currentHost = snapshotHost(currentSnapshotCatalog);
  const currentId = await currentHost.publish(migrated.definition);
  assert.deepEqual(await currentHost.store.instanceState(snapshotViewer, currentId, { version: 1, values: { filter: 'Notebooks' } }), { version: 1, values: { filter: 'Notebooks' } });
  await assert.rejects(currentHost.store.instanceState(snapshotViewer, currentId, { version: 1, values: { note: 'Author-only personal note' } }), { code: 'invalid' });
});

test('a shared reference reauthorizes the current viewer after catalog and dashboard migration', async () => {
  const migrated = snapshotValue(migrateSharedSnapshot(redactSharedSnapshot(legacyPrivateSnapshot())));
  const host = snapshotHost(currentSnapshotCatalog);
  const id = await host.publish(migrated.definition);
  const received: string[] = [];
  for (const context of [snapshotViewer, anotherSnapshotViewer]) {
    const source = await host.store.data(context, id, 'inventory', async (_reference, viewer) => {
      received.push(viewer.actorId);
      return { summary: `${viewer.actorId}: permitted inventory`, count: viewer.actorId === snapshotViewer.actorId ? 12 : 8 };
    });
    const resolved = snapshotValue(resolveReferences({ $ref: '@data:inventory#/summary' }, { data: new Map([['inventory', { value: source }]]) }));
    assert.equal(resolved, `${context.actorId}: permitted inventory`);
  }
  assert.deepEqual(received, ['reader', 'another-reader']);
  assert.equal(host.checks.filter(check => check.operation === 'data').every(check => check.context.actorId !== snapshotOwner.actorId), true);
  host.grants.get(snapshotViewer.actorId)!.delete('inventory');
  let calls = 0;
  await assert.rejects(host.store.data(snapshotViewer, id, 'inventory', async () => { calls++; return 'must not disclose'; }), { code: 'denied' });
  assert.equal(calls, 0);
  assert.equal(resolveReferences({ $ref: '@data:inventory#/summary' }, { data: new Map() }).ok, false);
});

test('creator source grants and forged reference parameters do not transfer with migrated documents', async () => {
  const migrated = snapshotValue(migrateSharedSnapshot(redactSharedSnapshot(legacyPrivateSnapshot())));
  const host = snapshotHost(currentSnapshotCatalog);
  const definition = { ...migrated.definition, dataSources: [{ id: 'inventory', source: 'restricted' }] };
  const id = await host.publish(definition);
  assert.equal((await host.store.resolve(snapshotViewer, id)).definition.title, 'Shared inventory');
  let calls = 0;
  await assert.rejects(host.store.data(snapshotViewer, id, 'inventory', async () => { calls++; return 'creator-only result'; }), { code: 'denied' });
  await assert.rejects(host.store.data(foreignSnapshotViewer, id, 'inventory', async () => { calls++; return 'foreign result'; }), { code: 'denied' });
  assert.equal(calls, 0);
  await assert.rejects(host.store.import(snapshotOwner, { ...definition, dataSources: [{ id: 'inventory', source: 'inventory', parameters: { actorId: 'author' } }] }), { code: 'invalid' });
  assert.throws(() => validateDashboardDefinition({ ...definition, dataSources: [{ id: 'inventory', source: 'https://unapproved.example/data' }] }, currentSnapshotCatalog), { code: 'invalid' });
});

test('revocation during a migrated source request rejects its late result', async () => {
  const migrated = snapshotValue(migrateSharedSnapshot(redactSharedSnapshot(legacyPrivateSnapshot())));
  const host = snapshotHost(currentSnapshotCatalog);
  const id = await host.publish(migrated.definition);
  let started!: () => void;
  let finish!: (value: string) => void;
  const began = new Promise<void>(resolve => { started = resolve; });
  const result = host.store.data(snapshotViewer, id, 'inventory', async (_reference, context) => {
    assert.equal(context.actorId, snapshotViewer.actorId);
    started();
    return new Promise<string>(resolve => { finish = resolve; });
  });
  const rejected = assert.rejects(result, { code: 'denied' });
  await began;
  host.grants.get(snapshotViewer.actorId)!.clear();
  finish('Late creator-sensitive data');
  await rejected;
  assert.deepEqual(host.checks.filter(check => check.operation === 'data').map(check => check.context.actorId), ['reader', 'reader']);
});

test('unsupported catalogs and injected snapshot state cannot acquire a migration or sharing grant', () => {
  const shared = redactSharedSnapshot(legacyPrivateSnapshot());
  assert.equal(migrateSharedSnapshot(shared, false).ok, false);
  assert.equal(migrateSharedSnapshot({ ...shared, view: { ...shared.view, catalog: { id: 'unknown', version: '3' } } }).ok, false);
  assert.equal(migrateSharedSnapshot({ ...shared, state: { ...shared.state, values: { ...shared.state.values as object, credential: 'do not share' } } }).ok, false);
  assert.equal(migrateSharedSnapshot({ ...shared, state: { ...shared.state, owners: { ...shared.state.owners, '/credential': { nodeId: 'filter', type: 'input', property: 'value' } } } }).ok, false);
  assert.equal(migrateStoredAnswer({ ...shared, grants: ['restricted'] }, currentSnapshotCatalog, { catalogs: [legacySnapshotCatalog], migrations: [], approve: () => true }).ok, false);
});
