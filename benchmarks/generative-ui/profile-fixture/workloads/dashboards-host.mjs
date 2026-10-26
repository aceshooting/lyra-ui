import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createSavedCatalog, createSavedDefinition, createSavedSource, SAVED_SOURCE } from './dashboards.js';

// Simulated fixture identities; no production authentication is implemented here.
const sessions = Object.freeze(Object.fromEntries(['author', 'editor', 'viewer', 'other-tenant'].map(role => [role,
  { actorId: role, tenantId: role === 'other-tenant' ? 'other' : 'profile', workspaceId: 'reports', role }])));
const documentId = 'saved-profile', instanceId = 'report-instance';
const fields = new Set(['operation', 'expectedRevision', 'definition', 'state']);

/** Owned single-process file adapter. Atomic replacement does not promise crash durability. */
export async function createHostServices({ loadLibrary, scratchDirectory }) {
  const [{ DashboardStore, DashboardError, DashboardConflict }, library] = await Promise.all([
    loadLibrary('@aceshooting/lyra-gen/persistence.js'), loadLibrary('@aceshooting/lyra-gen/catalog.js'),
  ]);
  const catalog = createSavedCatalog(library), source = createSavedSource();
  const directory = mkdtempSync(path.join(scratchDirectory, 'dashboard-'));
  const file = path.join(directory, 'dashboards.json');
  let disposed = false;
  const read = () => JSON.parse(readFileSync(file, 'utf8'));
  const write = state => { writeFileSync(`${file}.next`, JSON.stringify(state)); renameSync(`${file}.next`, file); };
  try { write({ records: {}, instances: {}, revoked: [] }); }
  catch (error) { rmSync(directory, { recursive: true, force: true }); throw error; }
  const allowed = ({ context, operation, id, metadata }) => {
    const session = sessions[context.actorId];
    const state = read();
    if (!session || session.tenantId !== context.tenantId || session.workspaceId !== context.workspaceId || state.revoked.includes(context.actorId)) return false;
    const current = metadata ?? state.records[id]?.metadata;
    if (current && (current.tenantId !== context.tenantId || current.workspaceId !== context.workspaceId)) return false;
    if (session.role === 'author') return true;
    if (session.role === 'editor') return !['publish', 'delete'].includes(operation);
    return ['read', 'list', 'data', 'state'].includes(operation);
  };
  const check = (context, operation, id = documentId, metadata) => {
    if (!allowed({ context, operation, id, metadata })) throw new DashboardError('denied', 'Fixture access denied.');
  };
  const instanceKey = context => JSON.stringify([context.tenantId, context.workspaceId, context.actorId, documentId, instanceId]);
  let timings = [];
  const timed = (operation, work) => { const start = performance.now(); try { return work(); } finally { timings.push({ operation, durationMs: performance.now() - start }); } };
  const adapter = {
    async read(context, id, operation) { check(context, operation, id); return timed('read', () => read().records[id]); },
    async list(context) { check(context, 'list'); return { records: Object.values(read().records).filter(record => allowed({ context, operation: 'read', metadata: record.metadata })) }; },
    async compareAndSwap(context, id, expectedRevision, next, operation) {
      return timed('cas', () => {
        const state = read(), current = state.records[id]; check(context, operation, id, current?.metadata ?? next?.metadata);
        if ((current?.metadata.revision ?? null) !== expectedRevision) return { ok: false };
        if (next) state.records[id] = next; else delete state.records[id];
        write(state); return { ok: true };
      });
    },
    async readInstance(context) { check(context, 'state'); return timed('read-instance', () => read().instances[instanceKey(context)]); },
    async compareAndSwapInstance(context, _id, _instance, expectedRevision, next) {
      return timed('cas-instance', () => {
        check(context, 'state'); const state = read(), key = instanceKey(context);
        if ((state.instances[key]?.revision ?? null) !== expectedRevision) return { ok: false };
        state.instances[key] = next; write(state); return { ok: true };
      });
    },
  };
  const store = new DashboardStore({ adapter, catalog, authorize: allowed, createId: () => documentId,
    allowState: (key, value) => key === 'note' && typeof value === 'string' && value.length <= 1024 });
  const reset = async () => {
    write({ records: {}, instances: {}, revoked: [] });
    const draft = await store.create(sessions.author, createSavedDefinition());
    await store.publish(sessions.author, documentId, draft.metadata.revision);
    await store.saveState(sessions.viewer, documentId, instanceId, null, { version: 1, values: { note: 'Model default' } });
    return { documentId, instanceId, revision: 2 };
  };
  let queue = Promise.resolve();
  const run = async ({ method, body, headers }) => {
    timings = [];
    const send = (status, value) => ({ status, contentType: 'application/json', body: JSON.stringify({ ...value, server: timings }) });
    try {
      if (disposed || method !== 'POST') return send(405, { error: 'method' });
      const context = sessions[headers['x-fixture-session']];
      if (!context) return send(403, { error: 'denied' });
      if (!(body instanceof Uint8Array) || body.byteLength > 262144) return send(400, { error: 'invalid' });
      const input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
      if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).some(key => !fields.has(key))) return send(400, { error: 'invalid' });
      let value;
      switch (input.operation) {
        case 'reset': if (context.role !== 'author') throw new DashboardError('denied', 'Fixture reset denied.'); value = await reset(); break;
        case 'resolve': value = await store.resolve(context, documentId); break;
        case 'read': value = await store.read(context, documentId); break;
        case 'update': value = await store.update(context, documentId, input.expectedRevision, input.definition); break;
        case 'publish': value = await store.publish(context, documentId, input.expectedRevision); break;
        case 'load-state': value = await store.loadState(context, documentId, instanceId) ?? null; break;
        case 'save-state': value = await store.saveState(context, documentId, instanceId, input.expectedRevision, input.state); break;
        case 'data': value = await store.data(context, documentId, SAVED_SOURCE.id, async reference => {
          if (reference.source !== SAVED_SOURCE.source) throw new DashboardError('denied', 'Unknown fixture source.');
          return structuredClone(source);
        }); break;
        case 'revoke': {
          check(context, 'publish'); const state = read(); state.revoked = ['viewer']; write(state); value = { revoked: true }; break;
        }
        default: throw new DashboardError('invalid', 'Unknown fixture operation.');
      }
      return send(200, { value });
    } catch (error) {
      if (error instanceof DashboardConflict) return send(409, { error: 'conflict', proposed: error.proposed });
      const code = error instanceof DashboardError ? error.code : 'invalid';
      return send(code === 'denied' ? 403 : code === 'conflict' ? 409 : code === 'missing' ? 404 : 400, { error: code });
    }
  };
  return {
    routes: [{ path: '/host/dashboard', methods: ['POST'], handle(request) {
      // Preserve request-local timing attribution and single-writer CAS ownership.
      const result = queue.then(() => run(request)); queue = result.then(() => undefined, () => undefined); return result;
    } }],
    services: { dashboard: { url: '/host/dashboard', documentId, instanceId, sourceId: SAVED_SOURCE.id, simulatedSessions: true } },
    async dispose() { if (disposed) return; disposed = true; await queue; rmSync(directory, { recursive: true, force: true }); },
  };
}
