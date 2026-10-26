import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DashboardConflict, DashboardError, DashboardStore, diffDashboardDefinitions } from '@aceshooting/lyra-gen/persistence.js';
import { catalog } from './model.js';

const example = fileURLToPath(new URL('.', import.meta.url));
// Public, deliberately simulated sessions. These strings are not production credentials.
const sessions = new Map([
  ['fixture-author', { actorId: 'author', tenantId: 'north', workspaceId: 'stationery', role: 'author' }],
  ['fixture-editor', { actorId: 'editor', tenantId: 'north', workspaceId: 'stationery', role: 'editor' }],
  ['fixture-viewer', { actorId: 'viewer', tenantId: 'north', workspaceId: 'stationery', role: 'viewer' }],
  ['fixture-other-tenant', { actorId: 'other-viewer', tenantId: 'south', workspaceId: 'stationery', role: 'viewer' }],
]);

async function readRequest(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 256_000) throw new DashboardError('invalid', 'Request is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** Single-process development host. Exclusive ownership prevents competing file writers. */
export async function startDashboardHost({ directory, port = 0 } = {}) {
  const ownedDirectory = directory === undefined;
  const dataDirectory = directory ?? mkdtempSync(join(tmpdir(), 'lyra-dashboard-data-'));
  mkdirSync(dataDirectory, { recursive: true });
  const lock = join(dataDirectory, 'host.lock');
  const descriptor = openSync(lock, 'wx');
  closeSync(descriptor);
  const assets = mkdtempSync(join(tmpdir(), 'lyra-dashboard-assets-'));
  const file = join(dataDirectory, 'dashboards.json');
  if (!existsSync(file)) writeFileSync(file, JSON.stringify({ records: {}, revoked: [] }));
  const read = () => JSON.parse(readFileSync(file, 'utf8'));
  const write = state => {
    writeFileSync(`${file}.next`, JSON.stringify(state));
    renameSync(`${file}.next`, file);
  };
  const allowed = ({ context, operation, id, metadata }) => {
    const session = [...sessions.values()].find(item => item.actorId === context.actorId && item.tenantId === context.tenantId && item.workspaceId === context.workspaceId);
    const state = read();
    if (!session || state.revoked.includes(session.actorId)) return false;
    const current = metadata ?? state.records[id]?.metadata;
    if (current && (current.tenantId !== session.tenantId || current.workspaceId !== session.workspaceId)) return false;
    if (session.role === 'author') return true;
    if (session.role === 'editor') return !['publish', 'delete'].includes(operation);
    if (['read', 'list', 'data', 'fork', 'create'].includes(operation)) return true;
    return current?.ownerId === session.actorId && ['draft', 'update', 'history'].includes(operation);
  };
  const check = (context, operation, id, metadata) => {
    if (!allowed({ context, operation, id, metadata })) throw new DashboardError('denied', 'Access denied.');
  };
  const adapter = {
    async read(context, id, operation) { check(context, operation, id); return read().records[id]; },
    async list(context) { check(context, 'list'); return { records: Object.values(read().records).filter(record => allowed({ context, operation: 'read', metadata: record.metadata })) }; },
    async compareAndSwap(context, id, expectedRevision, next, operation) {
      const state = read();
      const current = state.records[id];
      check(context, operation, id, current?.metadata ?? next?.metadata);
      if ((current?.metadata.revision ?? null) !== expectedRevision) return { ok: false };
      if (next) state.records[id] = next; else delete state.records[id];
      write(state);
      return { ok: true };
    },
  };
  const store = new DashboardStore({ adapter, catalog, authorize: allowed, createId: () => randomUUID() });
  const send = (response, status, value) => {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(value));
  };
  let origin;
  const server = createServer(async (request, response) => {
    let requestedId;
    try {
      const url = new URL(request.url, origin);
      if (url.pathname === '/api' && request.method === 'POST') {
        if (request.headers.origin && request.headers.origin !== origin) return send(response, 403, { error: 'denied' });
        const session = sessions.get(request.headers.authorization?.replace(/^Bearer /, ''));
        if (!session) return send(response, 401, { error: 'denied' });
        const context = { actorId: session.actorId, tenantId: session.tenantId, workspaceId: session.workspaceId };
        const body = await readRequest(request);
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['operation', 'id', 'expectedRevision', 'definition', 'targetRevision', 'policy'].includes(key))) throw new DashboardError('invalid', 'Unexpected request field.');
        const { operation, id, expectedRevision, definition, targetRevision, policy } = body;
        requestedId = id;
        let result;
        switch (operation) {
          case 'create': result = await store.create(context, definition); break;
          case 'read': result = await store.read(context, id); break;
          case 'list': result = await store.list(context); break;
          case 'update': result = await store.update(context, id, expectedRevision, definition); break;
          case 'publish': result = await store.publish(context, id, expectedRevision); break;
          case 'resolve': result = await store.resolve(context, id, policy); break;
          case 'fork': result = await store.fork(context, id, policy); break;
          case 'history': result = await store.history(context, id); break;
          case 'undo': result = await store.undo(context, id, expectedRevision, targetRevision); break;
          case 'data': result = await store.data(context, id, 'inventory', async (_reference, viewer) => ({ viewer: viewer.actorId, notebooks: 12, pens: 8 })); break;
          case 'revoke': {
            check(context, 'publish', id);
            const state = read();
            if (!state.records[id]) throw new DashboardError('missing', 'Dashboard unavailable.');
            state.revoked = [...new Set([...state.revoked, 'viewer'])];
            write(state);
            result = { revoked: true };
            break;
          }
          default: throw new DashboardError('invalid', 'Unknown operation.');
        }
        return send(response, 200, result);
      }
      if (request.method !== 'GET') return send(response, 405, { error: 'method' });
      const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/app.css': ['app.css', 'text/css'] };
      const asset = files[url.pathname];
      if (!asset) return send(response, 404, { error: 'missing' });
      response.writeHead(200, {
        'Content-Type': `${asset[1]}; charset=utf-8`, 'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      });
      response.end(readFileSync(join(url.pathname === '/app.js' ? assets : example, asset[0])));
    } catch (error) {
      if (error instanceof DashboardConflict) {
        const proposal = error.proposed;
        let differences = [];
        // The proposal is caller-owned; current draft content is never returned without permission.
        const session = sessions.get(request.headers.authorization?.replace(/^Bearer /, ''));
        if (session && proposal) {
          const bodyId = requestedId;
          if (bodyId && allowed({ context: session, operation: 'draft', id: bodyId })) differences = diffDashboardDefinitions(read().records[bodyId].definition, proposal);
        }
        send(response, 409, { error: 'conflict', proposed: proposal, differences });
      } else send(response, error instanceof DashboardError && error.code === 'denied' ? 403 : error instanceof DashboardError && error.code === 'missing' ? 404 : 400, { error: error instanceof DashboardError ? error.code : 'invalid' });
    }
  });
  try {
    await build({ entryPoints: [join(example, 'app.js')], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: join(assets, 'app.js'), logLevel: 'silent' });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    origin = `http://127.0.0.1:${server.address().port}`;
  } catch (error) {
    rmSync(assets, { recursive: true, force: true });
    rmSync(lock, { force: true });
    if (ownedDirectory) rmSync(dataDirectory, { recursive: true, force: true });
    throw error;
  }
  let closed = false;
  return {
    origin,
    async close() {
      if (closed) return;
      closed = true;
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      rmSync(assets, { recursive: true, force: true });
      rmSync(lock, { force: true });
      if (ownedDirectory) rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directoryIndex = process.argv.indexOf('--data');
  const host = await startDashboardHost({ ...(directoryIndex >= 0 ? { directory: process.argv[directoryIndex + 1] } : {}), port: Number(process.env.PORT ?? 4179) });
  process.stdout.write(`Saved dashboard development example: ${host.origin}\n`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void host.close().then(() => process.exit(0)); });
}
