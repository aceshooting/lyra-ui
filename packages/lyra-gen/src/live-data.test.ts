import assert from 'node:assert/strict';
import test from 'node:test';
import { DashboardDataQueue, HostQueryRegistry, LiveDataController, resolveDashboardLineage } from './live-data.js';
import type { DashboardQueryResult } from './live-data.js';

const context = { viewerId: 'viewer', tenantId: 'tenant', authorizationRevision: '1' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
test('superseded requests cannot overwrite newer data even when the host ignores abort', async () => {
  const registry = new HostQueryRegistry();
  const first = deferred<DashboardQueryResult>();
  let calls = 0;
  let aborted = false;
  registry.register('sales', { maxBytes: 1000, maxRows: 20, authorize: () => true, execute: async (_params, _context, signal) => {
    if (++calls === 1) { signal.addEventListener('abort', () => { aborted = true; }); return first.promise; }
    return { data: [2] };
  } });
  const controller = new LiveDataController(registry, context, () => 123);
  const old = controller.refresh('sales');
  await Promise.resolve();
  await controller.refresh('sales');
  first.resolve({ data: [1] });
  await old;
  assert.equal(aborted, true);
  assert.deepEqual(controller.snapshot.result?.data, [2]);
  assert.equal(controller.snapshot.receivedAt, 123);
  controller.dispose();
});
test('authorization is checked for every viewer request and again before committing', async () => {
  const registry = new HostQueryRegistry();
  let permitted = true;
  let checks = 0;
  const response = deferred<DashboardQueryResult>();
  registry.register('sales', { maxBytes: 1000, maxRows: 20, authorize: current => { checks++; return current.tenantId === 'tenant' && permitted; }, execute: () => response.promise });
  const controller = new LiveDataController(registry, context);
  const pending = controller.refresh('sales');
  await Promise.resolve();
  permitted = false;
  response.resolve({ data: ['private'] });
  await pending;
  assert.equal(checks, 2);
  assert.deepEqual(controller.snapshot, { status: 'denied', stale: true, error: 'access-denied' });
  controller.setContext({ ...context, tenantId: 'different' });
  await controller.refresh('sales');
  assert.equal(checks, 3);
  assert.equal(controller.snapshot.result, undefined);
  controller.dispose();
});
test('registry revocation and context changes erase retained private results and discard late responses', async () => {
  const registry = new HostQueryRegistry();
  const response = deferred<DashboardQueryResult>();
  const revoke = registry.register('sales', { maxBytes: 1000, maxRows: 20, authorize: () => true, execute: () => response.promise });
  const controller = new LiveDataController(registry, context);
  const pending = controller.refresh('sales');
  await Promise.resolve();
  revoke();
  response.resolve({ data: ['private'] });
  await pending;
  assert.equal(controller.snapshot.status, 'denied');
  assert.equal(controller.snapshot.result, undefined);
  controller.setContext({ ...context, viewerId: 'another' });
  assert.equal(controller.snapshot.result, undefined);
  controller.dispose();
});
test('failures keep the last valid data with its age; row budgets reject oversized responses', async () => {
  const registry = new HostQueryRegistry();
  let mode = 0;
  registry.register('sales', { maxBytes: 1000, maxRows: 2, authorize: () => true, execute: async () => {
    if (mode === 1) throw new Error('credential details must not escape');
    return { data: mode === 2 ? [1, 2, 3] : [1] };
  } });
  const controller = new LiveDataController(registry, context, () => 100);
  await controller.refresh('sales');
  mode = 1;
  await controller.refresh('sales');
  assert.deepEqual(controller.snapshot.result?.data, [1]);
  assert.equal(controller.snapshot.receivedAt, 100);
  assert.equal(controller.snapshot.error, 'query-failed');
  assert.equal(controller.snapshot.stale, true);
  mode = 2;
  await controller.refresh('sales');
  assert.equal(controller.snapshot.error, 'invalid-result');
  assert.deepEqual(controller.snapshot.result?.data, [1]);
  controller.dispose();
});
test('partial data discloses unverified lineage and results are copied on exposure', async () => {
  const registry = new HostQueryRegistry();
  registry.register('sales', { maxBytes: 1000, maxRows: 2, authorize: () => true, execute: async () => ({ data: [1], partial: true, sources: [{ id: 'source', label: 'Source', updatedAt: 1 }], lineage: { '/0': 'missing' } }) });
  const controller = new LiveDataController(registry, context);
  await controller.refresh('sales');
  assert.equal(controller.snapshot.status, 'partial');
  assert.equal(controller.snapshot.stale, true);
  assert.deepEqual(resolveDashboardLineage(controller.snapshot.result!, '/0'), { verified: false });
  (controller.snapshot.result!.data as number[]).push(3);
  assert.deepEqual(controller.snapshot.result?.data, [1]);
  assert.equal(resolveDashboardLineage({ data: 1, sources: [{ id: 's', label: 'Source', updatedAt: 1 }], lineage: { '': 's' } }, '').verified, true);
  controller.dispose();
});
test('pull queue bounds retained bytes/items, discloses drops and batches a slow consumer', () => {
  const queue = new DashboardDataQueue<number>({ maxItems: 3, maxBytes: 3, batchSize: 2, overflow: 'drop-oldest' });
  for (let index = 0; index < 10; index++) queue.push(index);
  assert.deepEqual(queue.metrics, { items: 3, bytes: 3, dropped: 7 });
  assert.deepEqual(queue.takeBatch(), [7, 8]);
  assert.deepEqual(queue.takeBatch(), [9]);
  queue.dispose();
  assert.equal(queue.push(1), false);
  assert.deepEqual(queue.metrics, { items: 0, bytes: 0, dropped: 7 });
  for (const overflow of ['reject', 'drop-newest'] as const) {
    const bounded = new DashboardDataQueue<string>({ maxItems: 1, maxBytes: 4, batchSize: 1, overflow });
    assert.equal(bounded.push('a'), true);
    assert.equal(bounded.push('b'), false);
    assert.deepEqual(bounded.takeBatch(), ['a']);
    assert.equal(bounded.push('large'), false);
    assert.equal(bounded.metrics.dropped, 2);
  }
});
test('revocation/context transitions never emit retained data and admission rejects accessors', async () => {
  const registry = new HostQueryRegistry();
  let executions = 0;
  registry.register('sales', { maxBytes: 1000, maxRows: 1, authorize: () => true, execute: async () => { executions++; return { data: [1] }; } });
  const controller = new LiveDataController(registry, context);
  await controller.refresh('sales');
  const retained: unknown[] = [];
  controller.subscribe(snapshot => { retained.push(snapshot.result); });
  controller.revoke();
  assert.deepEqual(retained, [undefined]);
  await controller.refresh('sales');
  retained.length = 0;
  controller.setContext({ ...context, viewerId: 'new' });
  assert.deepEqual(retained, [undefined]);
  let getters = 0;
  await controller.refresh('sales', { get dangerous() { getters++; return 'secret'; } });
  assert.equal(getters, 0);
  assert.equal(executions, 2);
  assert.equal(controller.snapshot.error, 'invalid-result');
  controller.dispose();
});
test('row limits cover arrays nested in object payloads and missing value paths are unverified', async () => {
  const registry = new HostQueryRegistry();
  registry.register('sales', { maxBytes: 1000, maxRows: 1, authorize: () => true, execute: async () => ({ data: { rows: [1, 2] } }) });
  const controller = new LiveDataController(registry, context);
  await controller.refresh('sales');
  assert.equal(controller.snapshot.error, 'invalid-result');
  assert.equal(controller.snapshot.result, undefined);
  assert.equal(resolveDashboardLineage({ data: {}, sources: [{ id: 's', label: 'Source', updatedAt: 1 }], lineage: { '/missing': 's' } }, '/missing').verified, false);
  controller.dispose();
});
