import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DashboardConflict, DashboardError, DashboardStore, copyDashboardJson, diffDashboardDefinitions, validateDashboardDefinition } from './persistence.js';
import type { DashboardAuthorizationRequest, DashboardContext, DashboardDefinition, DashboardHostAdapter, DashboardOperation, DashboardRecord, DashboardSavedInstance } from './persistence.js';
import { migrateDashboard } from './migrations.js';
import { DashboardApplication } from './application.js';
import type { LyraGenCatalog } from './types.js';

const catalog: LyraGenCatalog = { id: 'test', version: '1', components: { text: { tag: 'p', properties: {}, text: true } } };
function definition(title = 'Dashboard'): DashboardDefinition {
  return { format: 'lyra-dashboard', version: 1, title, view: { version: '1', catalog: { id: 'test', version: '1' }, surfaceId: 'surface', revision: 0, root: { id: 'root', type: 'text', text: title } }, dataSources: [{ id: 'sales', source: 'sales' }] };
}
const owner: DashboardContext = { actorId: 'owner', tenantId: 'tenant-a', workspaceId: 'workspace' };
const viewer: DashboardContext = { ...owner, actorId: 'viewer' };
const editor: DashboardContext = { ...owner, actorId: 'editor' };
const foreign: DashboardContext = { ...owner, actorId: 'foreign', tenantId: 'tenant-b' };

/** Test-only durable fixture: synchronous file CAS serializes sessions in this process. */
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-gen-host-'));
  const filename = join(directory, 'documents.json');
  writeFileSync(filename, '{}');
  const stateFilename = join(directory, 'instances.json');
  writeFileSync(stateFilename, '{}');
  let sequence = 0;
  let revoked = false;
  const read = (): Record<string, DashboardRecord> => JSON.parse(readFileSync(filename, 'utf8')) as Record<string, DashboardRecord>;
  const authorize = ({ context, operation, metadata }: DashboardAuthorizationRequest): boolean => {
    if (revoked && context.actorId === viewer.actorId) return false;
    if (metadata && (metadata.tenantId !== context.tenantId || metadata.workspaceId !== context.workspaceId)) return false;
    if (context.actorId === owner.actorId) return true;
    if (context.actorId === editor.actorId) return operation !== 'publish' && operation !== 'delete';
    return context.actorId === viewer.actorId && ['read', 'list', 'data', 'export', 'fork', 'create', 'state'].includes(operation);
  };
  const session = (authenticated: DashboardContext): DashboardStore => {
    const check = (context: DashboardContext, operation: DashboardOperation, metadata?: DashboardRecord['metadata']): void => {
      if (JSON.stringify(context) !== JSON.stringify(authenticated) || !authorize({ context: authenticated, operation, ...(metadata ? { metadata } : {}) })) throw new DashboardError('denied', 'Access denied.');
    };
    const instanceKey = (id: string, instanceId: string): string => JSON.stringify([authenticated.tenantId, authenticated.workspaceId, authenticated.actorId, id, instanceId]);
    const adapter: DashboardHostAdapter = {
      async readInstance(context, id, instanceId) {
        check(context, 'state', read()[id]?.metadata);
        const states = JSON.parse(readFileSync(stateFilename, 'utf8')) as Record<string, DashboardSavedInstance>;
        return states[instanceKey(id, instanceId)];
      },
      async compareAndSwapInstance(context, id, instanceId, expected, next) {
        check(context, 'state', read()[id]?.metadata);
        const states = JSON.parse(readFileSync(stateFilename, 'utf8')) as Record<string, DashboardSavedInstance>;
        const key = instanceKey(id, instanceId);
        if ((states[key]?.revision ?? null) !== expected) return { ok: false };
        states[key] = next;
        writeFileSync(`${stateFilename}.next`, JSON.stringify(states));
        renameSync(`${stateFilename}.next`, stateFilename);
        return { ok: true };
      },
      async read(context, id, operation) { const record = read()[id]; check(context, operation, record?.metadata); return record; },
      async list(context) { check(context, 'list'); return { records: Object.values(read()).filter(record => authorize({ context, operation: 'read', metadata: record.metadata })) }; },
      async compareAndSwap(context, id, expected, next, operation) {
        const records = read();
        const current = records[id];
        check(context, operation, current?.metadata ?? next?.metadata);
        if ((current?.metadata.revision ?? null) !== expected) return { ok: false };
        if (next) records[id] = next; else delete records[id];
        writeFileSync(`${filename}.next`, JSON.stringify(records));
        renameSync(`${filename}.next`, filename);
        return { ok: true };
      }
    };
    return new DashboardStore({ adapter, catalog, authorize, createId: () => `document-${++sequence}`, allowState: key => key === 'filters' });
  };
  return { session, revoke: () => { revoked = true; }, cleanup: () => { rmSync(directory, { recursive: true, force: true }); } };
}

test('durable reopen, draft isolation, publication pin/follow, and revision conflicts', async () => {
  const host = fixture();
  try {
    const store = host.session(owner);
    const first = await store.create(owner, definition());
    const id = first.metadata.id;
    assert.equal((await host.session(owner).read(owner, id)).definition.title, 'Dashboard');
    const published = await store.publish(owner, id, 1);
    assert.equal(published.metadata.revision, 2);
    const reader = host.session(viewer);
    await assert.rejects(reader.read(viewer, id), { code: 'denied' });
    await store.update(owner, id, 2, definition('Draft'));
    assert.equal((await reader.resolve(viewer, id)).definition.title, 'Dashboard');
    const competing = definition('Competing');
    await assert.rejects(store.update(owner, id, 2, competing), (error: unknown) => error instanceof DashboardConflict && error.proposed?.title === 'Competing');
    await store.publish(owner, id, 3);
    assert.equal((await reader.resolve(viewer, id)).definition.title, 'Draft');
    assert.equal((await reader.resolve(viewer, id, { mode: 'pin', revision: 2 })).definition.title, 'Dashboard');
    await store.rollback(owner, id, 4, 2);
    assert.equal((await reader.resolve(viewer, id)).selectedRevision, 2);
    assert.equal((await reader.resolve(viewer, id, { mode: 'pin', revision: 4 })).definition.title, 'Draft');
    const undone = await store.undo(owner, id, 5, 1);
    assert.equal(undone.metadata.revision, 6);
    assert.equal(undone.definition.title, 'Dashboard');
    assert.equal((await store.history(owner, id)).length, 6);
    const changes = diffDashboardDefinitions(definition(), definition('Changed'));
    assert.equal(changes.find(change => change.path === '/title')?.after, 'Changed');
  } finally { host.cleanup(); }
});

test('sessions enforce tenants, roles, revocation, source authorization and fork independence', async () => {
  const host = fixture();
  try {
    const store = host.session(owner);
    const first = await store.create(owner, definition());
    const id = first.metadata.id;
    await store.publish(owner, id, 1);
    await assert.rejects(host.session(foreign).resolve(foreign, id), { code: 'denied' });
    await assert.rejects(host.session(editor).publish(editor, id, 2), { code: 'denied' });
    const reader = host.session(viewer);
    const fork = await reader.fork(viewer, id);
    assert.notEqual(fork.metadata.id, id);
    assert.notEqual(fork.definition.view.surfaceId, first.definition.view.surfaceId);
    assert.equal(fork.metadata.ownerId, viewer.actorId);
    await assert.rejects(reader.resolve(viewer, fork.metadata.id), { code: 'unpublished' });
    await store.update(owner, id, 2, definition('Changed original'));
    assert.equal(fork.definition.title, 'Dashboard');
    const exportValue = await reader.export(viewer, id);
    assert.equal('metadata' in exportValue, false);
    assert.deepEqual(Object.keys(await reader.instanceState(viewer, id, { version: 1, values: { filters: 'allowed' } })), ['version', 'values']);
    await assert.rejects(reader.instanceState(viewer, id, { version: 1, values: { token: 'private' } }), { code: 'invalid' });
    await reader.saveState(viewer, id, 'personal', null, { version: 1, values: { filters: 'mine' } });
    assert.equal((await host.session(viewer).loadState(viewer, id, 'personal'))?.state.values['filters'], 'mine');
    assert.equal(await store.loadState(owner, id, 'personal'), undefined);
    await assert.rejects(reader.saveState(viewer, id, 'personal', null, { version: 1, values: { filters: 'stale' } }), { code: 'conflict' });
    let receivedActor = '';
    await assert.rejects(reader.data(viewer, id, 'sales', async (_reference, context) => { receivedActor = context.actorId; host.revoke(); return 'private response'; }), { code: 'denied' });
    assert.equal(receivedActor, viewer.actorId);
    await assert.rejects(reader.resolve(viewer, id), { code: 'denied' });
    await assert.rejects(reader.list(viewer), { code: 'denied' });
    await assert.rejects(reader.export(viewer, id), { code: 'denied' });
    await assert.rejects(reader.resolve(owner, id), { code: 'denied' });
    await assert.rejects(store.delete(owner, id, 2), { code: 'conflict' });
    await store.delete(owner, id, 3);
    await assert.rejects(store.read(owner, id), { code: 'missing' });
  } finally { host.cleanup(); }
});

test('stored JSON excludes authority fields, execution, malformed versions and unsafe containers', () => {
  for (const extra of [{ tenantId: 'other' }, { credentials: 'secret' }, { tools: [] }]) assert.throws(() => validateDashboardDefinition({ ...definition(), ...extra }, catalog), { code: 'invalid' });
  assert.throws(() => copyDashboardJson({ callback: () => undefined }), { code: 'invalid' });
  let invoked = false;
  assert.throws(() => copyDashboardJson({ get secret() { invoked = true; return 'secret'; } }), { code: 'invalid' });
  assert.equal(invoked, false);
  assert.throws(() => copyDashboardJson(new Date()), { code: 'invalid' });
  assert.throws(() => validateDashboardDefinition({ ...definition(), dataSources: [{ id: 'x', source: 'https://untrusted.test' }] }, catalog), { code: 'invalid' });
  assert.throws(() => validateDashboardDefinition({ ...definition(), version: 99 }, catalog), { code: 'invalid' });
  assert.throws(() => validateDashboardDefinition({ ...definition(), view: { ...definition().view, catalog: { id: 'missing', version: '1' } } }, catalog), { code: 'invalid' });
});

test('explicit version migration produces current validated content and fails closed', () => {
  const old = { ...definition(), version: 0 };
  assert.throws(() => migrateDashboard(old, catalog), { code: 'invalid' });
  const migrated = migrateDashboard(old, catalog, [{ fromVersion: 0, toVersion: 1, migrate: value => ({ ...value, version: 1 }) }]);
  assert.equal(migrated.definition.title, 'Dashboard');
  assert.deepEqual(migrated.steps, [{ fromVersion: 0, toVersion: 1 }]);
  assert.throws(() => migrateDashboard(old, catalog, [{ fromVersion: 0, toVersion: 1, migrate: value => ({ ...value, version: 1, credentials: 'forbidden' }) }]), { code: 'invalid' });
  assert.throws(() => migrateDashboard({ ...old, version: 2 }, catalog), { code: 'invalid' });
});

test('application mounts authorized publications, disposes resources and removes revoked content', async () => {
  const host = fixture();
  try {
    const ownerStore = host.session(owner);
    const created = await ownerStore.create(owner, definition());
    await ownerStore.publish(owner, created.metadata.id, 1);
    let mounts = 0;
    let cleanups = 0;
    let signal: AbortSignal | undefined;
    const application = new DashboardApplication({ store: host.session(viewer), context: () => viewer, mount: value => { mounts++; signal = value.signal; return () => { cleanups++; }; } });
    assert.equal(await application.navigate({ documentId: created.metadata.id }), 'mounted');
    assert.equal(mounts, 1);
    host.revoke();
    await assert.rejects(application.refresh(), { code: 'denied' });
    assert.equal(application.current, undefined);
    assert.equal(cleanups, 1);
    assert.equal(signal?.aborted, true);
    application.dispose();
    await assert.rejects(application.navigate({ documentId: created.metadata.id }), { code: 'invalid' });
  } finally { host.cleanup(); }
});

test('simultaneous edits preserve the losing proposal without overwriting the winner', async () => {
  const host = fixture();
  try {
    const firstSession = host.session(owner);
    const secondSession = host.session(editor);
    const created = await firstSession.create(owner, definition());
    const results = await Promise.allSettled([
      firstSession.update(owner, created.metadata.id, 1, definition('First edit')),
      secondSession.update(editor, created.metadata.id, 1, definition('Second edit'))
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const rejected = results.find(result => result.status === 'rejected');
    assert.equal(rejected?.status, 'rejected');
    if (rejected?.status === 'rejected') {
      const conflict: unknown = rejected.reason;
      assert.ok(conflict instanceof DashboardConflict);
      assert.ok(conflict.proposed?.title.endsWith('edit'));
    }
    const current = await firstSession.read(owner, created.metadata.id);
    assert.equal(current.metadata.revision, 2);
    assert.equal('history' in current, false);
    assert.equal('publications' in current, false);
  } finally { host.cleanup(); }
});

test('superseded asynchronous mounts clean up and cannot replace the current dashboard', async () => {
  const host = fixture();
  try {
    const store = host.session(owner);
    const created = await store.create(owner, definition());
    await store.publish(owner, created.metadata.id, 1);
    let beginMount: (() => void) | undefined;
    const started = new Promise<void>(resolve => { beginMount = resolve; });
    let finishMount: ((cleanup: () => void) => void) | undefined;
    const pending = new Promise<() => void>(resolve => { finishMount = resolve; });
    let cleaned = 0;
    let calls = 0;
    const app = new DashboardApplication({ store, context: () => owner, mount: () => {
      calls++;
      if (calls === 1) { beginMount?.(); return pending; }
      return () => { cleaned++; };
    } });
    const stale = app.navigate({ documentId: created.metadata.id });
    await started;
    assert.equal(await app.navigate({ documentId: created.metadata.id }), 'mounted');
    finishMount?.(() => { cleaned++; });
    assert.equal(await stale, 'superseded');
    assert.equal(cleaned, 1);
    assert.equal(app.current?.metadata.id, created.metadata.id);
    app.dispose();
    assert.equal(cleaned, 2);
  } finally { host.cleanup(); }
});

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

test('a pending share link cannot replace a newer direct navigation', async () => {
  const host = fixture();
  try {
    const store = host.session(owner);
    const first = await store.create(owner, definition('Old linked dashboard'));
    const second = await store.create(owner, definition('New direct choice'));
    await store.publish(owner, first.metadata.id, 1);
    await store.publish(owner, second.metadata.id, 1);
    const resolving = deferred<void>();
    const link = deferred<{ documentId: string }>();
    const mounts: string[] = [];
    const app = new DashboardApplication({ store, context: () => owner, resolveLink: () => { resolving.resolve(); return link.promise; }, mount: ({ dashboard }) => { mounts.push(dashboard.metadata.id); return () => undefined; } });
    const old = app.openLink('old-link');
    await resolving.promise;
    assert.equal(await app.navigate({ documentId: second.metadata.id }), 'mounted');
    link.resolve({ documentId: first.metadata.id });
    assert.equal(await old, 'superseded');
    assert.equal(app.current?.metadata.id, second.metadata.id);
    assert.deepEqual(mounts, [second.metadata.id]);
    app.dispose();
  } finally { host.cleanup(); }
});

test('concurrent share links preserve invocation order rather than resolution order', async () => {
  const host = fixture();
  try {
    const store = host.session(owner);
    const first = await store.create(owner, definition('First link'));
    const second = await store.create(owner, definition('Latest link'));
    await store.publish(owner, first.metadata.id, 1);
    await store.publish(owner, second.metadata.id, 1);
    const oldLink = deferred<{ documentId: string }>();
    const newLink = deferred<{ documentId: string }>();
    const started = deferred<void>();
    let calls = 0;
    const mounts: string[] = [];
    const app = new DashboardApplication({ store, context: () => owner, resolveLink: token => {
      if (++calls === 2) started.resolve();
      return token === 'old' ? oldLink.promise : newLink.promise;
    }, mount: ({ dashboard }) => { mounts.push(dashboard.metadata.id); return () => undefined; } });
    const old = app.openLink('old');
    await Promise.resolve();
    const latest = app.openLink('latest');
    await started.promise;
    newLink.resolve({ documentId: second.metadata.id });
    assert.equal(await latest, 'mounted');
    oldLink.resolve({ documentId: first.metadata.id });
    assert.equal(await old, 'superseded');
    assert.deepEqual(mounts, [second.metadata.id]);
    assert.equal(app.current?.metadata.id, second.metadata.id);
    app.dispose();
  } finally { host.cleanup(); }
});

test('revocation or disposal during share-link awaits cannot start a new mount', async () => {
  const host = fixture();
  try {
    const store = host.session(owner);
    const created = await store.create(owner, definition());
    await store.publish(owner, created.metadata.id, 1);
    for (const phase of ['context', 'link'] as const) {
      for (const action of ['revoke', 'dispose'] as const) {
        const context = deferred<DashboardContext>();
        const link = deferred<{ documentId: string }>();
        const resolving = deferred<void>();
        let mounts = 0;
        let resolutions = 0;
        const app = new DashboardApplication({ store, context: () => phase === 'context' ? context.promise : owner, resolveLink: () => { resolutions++; resolving.resolve(); return link.promise; }, mount: () => { mounts++; return () => undefined; } });
        const pending = app.openLink('saved');
        if (phase === 'link') await resolving.promise;
        app[action]();
        context.resolve(owner);
        link.resolve({ documentId: created.metadata.id });
        assert.equal(await pending, 'superseded');
        assert.equal(mounts, 0);
        assert.equal(resolutions, phase === 'context' ? 0 : 1);
        assert.equal(app.current, undefined);
        app.dispose();
      }
    }
  } finally { host.cleanup(); }
});

test('a rejected stale link resolution does not surface after a newer navigation', async () => {
  const host = fixture();
  try {
    const store = host.session(owner);
    const created = await store.create(owner, definition());
    await store.publish(owner, created.metadata.id, 1);
    const link = deferred<{ documentId: string }>();
    const resolving = deferred<void>();
    const app = new DashboardApplication({ store, context: () => owner, resolveLink: () => { resolving.resolve(); return link.promise; }, mount: () => () => undefined });
    const stale = app.openLink('unavailable');
    await resolving.promise;
    await app.navigate({ documentId: created.metadata.id });
    link.reject(new Error('The old link lookup failed.'));
    assert.equal(await stale, 'superseded');
    assert.equal(app.current?.metadata.id, created.metadata.id);
    app.dispose();
  } finally { host.cleanup(); }
});

test('a newer share-link intent supersedes a direct navigation awaiting context', async () => {
  const host = fixture();
  try {
    const store = host.session(owner);
    const first = await store.create(owner, definition('Old direct choice'));
    const second = await store.create(owner, definition('New linked choice'));
    await store.publish(owner, first.metadata.id, 1);
    await store.publish(owner, second.metadata.id, 1);
    const context = deferred<DashboardContext>();
    const started = deferred<void>();
    const mounts: string[] = [];
    let contexts = 0;
    const app = new DashboardApplication({ store, context: () => {
      if (++contexts === 1) { started.resolve(); return context.promise; }
      return owner;
    }, resolveLink: () => ({ documentId: second.metadata.id }), mount: ({ dashboard }) => { mounts.push(dashboard.metadata.id); return () => undefined; } });
    const direct = app.navigate({ documentId: first.metadata.id });
    await started.promise;
    assert.equal(await app.openLink('new-choice'), 'mounted');
    context.resolve(owner);
    assert.equal(await direct, 'superseded');
    assert.deepEqual(mounts, [second.metadata.id]);
    assert.equal(app.current?.metadata.id, second.metadata.id);
    app.dispose();
  } finally { host.cleanup(); }
});

test('refresh keeps the mounted screen and route when the leave guard answers stay, and restores the route after a failed re-resolve', async () => {
  const host = fixture();
  try {
    const ownerStore = host.session(owner);
    const created = await ownerStore.create(owner, definition());
    await ownerStore.publish(owner, created.metadata.id, 1);
    let stay = false;
    const changes: (boolean)[] = [];
    let cleanups = 0;
    const application = new DashboardApplication({ store: host.session(viewer), context: () => viewer, beforeLeave: () => !stay, onChange: dashboard => { changes.push(dashboard !== undefined); }, mount: () => () => { cleanups++; } });
    assert.equal(await application.navigate({ documentId: created.metadata.id }), 'mounted');
    changes.length = 0;
    stay = true;
    assert.equal(await application.refresh(), 'cancelled');
    assert.deepEqual(changes, []);
    assert.equal(cleanups, 0);
    assert.notEqual(application.current, undefined);
    stay = false;
    host.revoke();
    await assert.rejects(application.refresh(), { code: 'denied' });
    assert.equal(application.current, undefined);
    // The route survives the failed refresh, so a later retry still has something to refresh.
    assert.notEqual(await application.refresh().catch(() => 'threw'), 'cancelled');
  } finally { host.cleanup(); }
});

function memoryStore(options: { readonly maxHistory?: number } = {}) {
  const records = new Map<string, DashboardRecord>();
  const adapter: DashboardHostAdapter = {
    async read(_context, id) { const record = records.get(id); return record ? JSON.parse(JSON.stringify(record)) as DashboardRecord : undefined; },
    async list() { return { records: [...records.values()] }; },
    async compareAndSwap(_context, id, expected, next) {
      if ((records.get(id)?.metadata.revision ?? null) !== expected) return { ok: false };
      if (next) records.set(id, next); else records.delete(id);
      return { ok: true };
    }
  };
  const store = new DashboardStore({ adapter, catalog, authorize: () => true, createId: () => 'big', ...options });
  return { store, records };
}
const bulky = (title: string): DashboardDefinition => { const base = definition(title); return { ...base, view: { ...base.view, root: { id: 'root', type: 'text', text: 'x'.repeat(60_000) } } }; };

test('a long revision history never bricks a dashboard (bounded record, default retention)', async () => {
  const { store, records } = memoryStore();
  const { metadata } = await store.create(owner, bulky('v1'));
  let revision = metadata.revision;
  for (let index = 0; index < 45; index++) revision = (await store.update(owner, 'big', revision, bulky(`v${index + 2}`))).metadata.revision;
  assert.equal((await store.read(owner, 'big')).metadata.revision, 46);
  assert.equal((await store.history(owner, 'big')).length, 46);
  await store.publish(owner, 'big', 46);
  assert.equal((await store.resolve(owner, 'big')).selectedRevision, 47);
  await store.delete(owner, 'big', 47);
  assert.equal(records.size, 0);
});

test('maxHistory prunes old drafts but keeps the current revision and every publication', async () => {
  const { store } = memoryStore({ maxHistory: 3 });
  await store.create(owner, definition('v1'));
  await store.publish(owner, 'big', 1);
  let revision = 2;
  for (let index = 0; index < 8; index++) revision = (await store.update(owner, 'big', revision, definition(`d${index}`))).metadata.revision;
  const history = await store.history(owner, 'big');
  assert.deepEqual(history.map(item => item.revision), [2, 8, 9, 10]);
  assert.equal(history.at(-1)?.definition.title, 'd7');
  assert.equal((await store.resolve(owner, 'big', { mode: 'pin', revision: 2 })).definition.title, 'v1');
  await assert.rejects(store.undo(owner, 'big', revision, 4), { code: 'missing' });
  assert.equal((await store.undo(owner, 'big', revision, 2)).definition.title, 'v1');
  assert.throws(() => memoryStore({ maxHistory: 0 }), { code: 'invalid' });
});

test('delete succeeds for a legacy record too large to read in full', async () => {
  const { store, records } = memoryStore();
  await store.create(owner, definition());
  const record = records.get('big') as DashboardRecord;
  let nested: unknown = 'leaf';
  for (let depth = 0; depth < 60; depth++) nested = { nested };
  const huge = { ...record, history: [...record.history, { revision: 2, definition: nested }] } as unknown as DashboardRecord;
  records.set('big', huge);
  await assert.rejects(store.read(owner, 'big'), { code: 'invalid' });
  await store.delete(owner, 'big', 1);
  assert.equal(records.size, 0);
});

test('diffDashboardDefinitions reports nested and array changes in sorted pointer order', () => {
  const left = bulky('a'); const right = { ...bulky('b'), dataSources: [{ id: 'sales', source: 'other' }] };
  assert.deepEqual(diffDashboardDefinitions(left, right).map(change => change.path), ['/dataSources', '/title']);
  assert.deepEqual(diffDashboardDefinitions(left, left), []);
});
