import { migrateStoredAnswer } from '../../src/answer-migrations.js';
import { migrateDashboard } from '../../src/migrations.js';
import { DashboardStore } from '../../src/persistence.js';
import type { DashboardAuthorizationRequest, DashboardContext, DashboardDefinition, DashboardHostAdapter, DashboardRecord } from '../../src/persistence.js';
import { createSnapshot, createSurfaceState, restoreSnapshot, setSurfaceState } from '../../src/runtime.js';
import type { LyraGenSnapshot } from '../../src/runtime.js';
import type { JsonObject, LyraGenCatalog, LyraGenNode, LyraGenResult, LyraGenView } from '../../src/types.js';

export const snapshotOwner: DashboardContext = { actorId: 'author', tenantId: 'north', workspaceId: 'stationery' };
export const snapshotViewer: DashboardContext = { ...snapshotOwner, actorId: 'reader' };
export const anotherSnapshotViewer: DashboardContext = { ...snapshotOwner, actorId: 'another-reader' };
export const foreignSnapshotViewer: DashboardContext = { ...snapshotViewer, tenantId: 'south' };

const catalog = (version: string): LyraGenCatalog => ({ id: 'shared-snapshot', version, components: {
  stack: { tag: 'div', properties: {}, children: true },
  heading: { tag: 'h2', properties: {}, text: true },
  text: { tag: 'p', properties: {}, text: true },
  input: { tag: 'input', fieldPurpose: 'general', properties: { ariaLabel: { type: 'string' }, value: { type: 'string' } }, accessibleName: { required: true, properties: ['ariaLabel'] }, bindings: { value: { event: 'input', property: 'value' } } },
  button: { tag: 'button', properties: {}, text: true, events: ['click'], accessibleName: { required: true, text: true } },
}, actions: { inspect: { payload: { type: 'null' } } } });
export const legacySnapshotCatalog = catalog('1');
export const currentSnapshotCatalog = catalog('2');

export function snapshotValue<T>(result: LyraGenResult<T>): T {
  if (!result.ok) throw new Error(`Snapshot fixture rejected: ${result.diagnostics.map(item => item.code).join(',')}`);
  return result.value;
}
export function legacyPrivateSnapshot(): LyraGenSnapshot {
  const view: LyraGenView = { version: '1', catalog: { id: legacySnapshotCatalog.id, version: '1' }, surfaceId: 'inventory', revision: 7, root: { id: 'root', type: 'stack', children: [
    { id: 'heading', type: 'heading', text: 'Permitted inventory overview' },
    { id: 'summary', type: 'text', text: 'Author-only cached inventory: 98765' },
    { id: 'filter', type: 'input', props: { ariaLabel: 'Category filter', value: 'All' }, bindings: { value: '/filter' } },
    { id: 'note', type: 'input', props: { ariaLabel: 'Personal note', value: '' }, bindings: { value: '/note' } },
    { id: 'inspect', type: 'button', text: 'Inspect current inventory', action: { name: 'inspect', payload: null } },
  ] } };
  let state = createSurfaceState(view);
  state = snapshotValue(setSurfaceState(state, '/filter', 'Notebooks'));
  state = snapshotValue(setSurfaceState(state, '/note', 'Author-only personal note'));
  return createSnapshot(view, state);
}
export function dashboardFromSnapshot(snapshot: LyraGenSnapshot): DashboardDefinition {
  return { format: 'lyra-dashboard', version: 1, title: 'Shared inventory', view: snapshot.view, dataSources: [{ id: 'inventory', source: 'inventory' }] };
}

/** Explicit fixture host policy: share the filter, omit personal edits and cached source data. */
export function redactSharedSnapshot(snapshot: LyraGenSnapshot): LyraGenSnapshot {
  const checked = snapshotValue(restoreSnapshot(snapshot, legacySnapshotCatalog));
  const root: LyraGenNode = { ...checked.view.root, children: checked.view.root.children!.map(node => node.id === 'summary' ? { ...node, text: 'Load inventory for the current viewer.' } : node) };
  const view = { ...checked.view, root };
  const values = checked.state.values as JsonObject;
  const state = snapshotValue(setSurfaceState(createSurfaceState(view), '/filter', values['filter']!));
  return createSnapshot(view, state);
}
export function migrateSharedSnapshot(snapshot: unknown, approve = true): LyraGenResult<{ readonly snapshot: LyraGenSnapshot; readonly definition: DashboardDefinition }> {
  const migrated = migrateStoredAnswer(snapshot, currentSnapshotCatalog, {
    catalogs: [legacySnapshotCatalog], approve: () => approve,
    migrations: [{ from: { id: legacySnapshotCatalog.id, version: '1' }, to: { id: currentSnapshotCatalog.id, version: '2' }, migrate: original => ({ ...original, view: { ...original.view, catalog: { id: currentSnapshotCatalog.id, version: '2' } } }) }],
  });
  if (!migrated.ok) return migrated;
  const definition = migrateDashboard({ ...dashboardFromSnapshot(migrated.value.snapshot), version: 0 }, currentSnapshotCatalog, [
    { fromVersion: 0, toVersion: 1, migrate: document => ({ ...document, version: 1 }) },
  ]).definition;
  return { ok: true, value: { snapshot: migrated.value.snapshot, definition }, diagnostics: [] };
}

export function snapshotHost(catalog: LyraGenCatalog) {
  const records = new Map<string, DashboardRecord>();
  const grants = new Map<string, Set<string>>([
    [snapshotOwner.actorId, new Set(['inventory', 'restricted'])],
    [snapshotViewer.actorId, new Set(['inventory'])],
    [anotherSnapshotViewer.actorId, new Set(['inventory'])],
  ]);
  const checks: DashboardAuthorizationRequest[] = [];
  const authorize = (request: DashboardAuthorizationRequest): boolean => {
    checks.push(request);
    const { context, metadata, operation, source } = request;
    if (context.tenantId !== 'north' || context.workspaceId !== 'stationery') return false;
    if (metadata && (metadata.tenantId !== context.tenantId || metadata.workspaceId !== context.workspaceId)) return false;
    if (operation === 'data') return source !== undefined && (grants.get(context.actorId)?.has(source) ?? false);
    return context.actorId === snapshotOwner.actorId || ['read', 'export', 'state'].includes(operation);
  };
  const adapter: DashboardHostAdapter = {
    async read(_context, id) { return records.get(id); },
    async list() { return { records: [...records.values()] }; },
    async compareAndSwap(_context, id, expectedRevision, next) {
      if ((records.get(id)?.metadata.revision ?? null) !== expectedRevision) return { ok: false };
      if (next) records.set(id, next); else records.delete(id);
      return { ok: true };
    },
  };
  let nextId = 0;
  const store = new DashboardStore({ adapter, catalog, authorize, createId: () => `shared-${++nextId}`,
    allowState: (key, value) => key === 'filter' && typeof value === 'string' });
  async function publish(definition: DashboardDefinition): Promise<string> {
    const created = await store.import(snapshotOwner, definition);
    await store.publish(snapshotOwner, created.metadata.id, created.metadata.revision);
    return created.metadata.id;
  }
  return { store, grants, checks, publish };
}
