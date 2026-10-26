import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { repairView } from './repair-workflow.js';
import type { LyraGenRepairBoundary, LyraGenRepairResponse, LyraGenRepairTransport } from './repair-workflow.js';
import { createSurfaceState, setSurfaceState } from './runtime.js';
import type { LyraGenPatch } from './runtime.js';
import type { LyraGenCatalog, LyraGenView } from './types.js';

const catalog: LyraGenCatalog = { id: 'repair', version: '1', components: {
  row: { tag: 'div', properties: {}, children: true },
  input: { tag: 'input', properties: { label: { type: 'string' }, value: { type: 'string' } }, bindings: { value: { event: 'input', property: 'value' } } },
} };
const view: LyraGenView = { version: '1', catalog: { id: 'repair', version: '1' }, surfaceId: 'surface', revision: 0,
  root: { id: 'row', type: 'row', children: [
    { id: 'field', type: 'input', props: { label: 42, value: 'Initial' }, bindings: { value: '/value' } },
    { id: 'private', type: 'input', props: { label: 'Unrelated secret' } },
  ] } };
const patch = (label: string | number = 'Fixed'): LyraGenPatch => ({ surfaceId: 'surface', expectedRevision: 0, operations: [{ op: 'replace', nodeId: 'field', node: { ...view.root.children![0]!, props: { label, value: 'New default' } } }] });
const response = (): LyraGenRepairResponse => ({ patch: patch(), tokensUsed: 3 });
const boundary = (): LyraGenRepairBoundary => ({ view, generation: 0 });
const run = (transport: LyraGenRepairTransport, getCurrent = boundary, limits = {}) => repairView({ catalog, getCurrent, nodeIds: ['field'], transport, limits });
const deferred = <T>() => { let resolve!: (value: T) => void; let reject!: (reason: Error) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };

test('only failing nodes and scoped diagnostics reach the host transport; usage is actual', async () => {
  const edited = setSurfaceState(createSurfaceState(view), '/value', 'User edit');
  assert.equal(edited.ok, true); if (!edited.ok) return;
  const current = { ...boundary(), state: edited.value };
  const result = await run(async (request, context) => {
    assert.deepEqual(request.nodes.map(node => node.id), ['field']);
    assert.equal(JSON.stringify(request).includes('Unrelated secret'), false);
    assert.deepEqual(request.diagnostics.map(diagnostic => diagnostic.path), ['/root/children/0/props/label']);
    assert.equal(context.attempt, 1);
    assert.equal(context.maxTokens, 4096);
    assert.equal(context.signal.aborted, false);
    return response();
  }, () => current);
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.value.view.revision, 1);
  assert.deepEqual(result.value.state?.values, { value: 'User edit' });
  assert.deepEqual(result.value.state?.dirty, ['/value']);
  assert.equal(result.value.tokensUsed, 3);
  assert.equal(result.value.attempts, 1);
  assert.equal(current.view.revision, 0);
});

test('content retries consume actual usage and enforce attempt and token ceilings', async () => {
  let calls = 0;
  const result = await run(async (_request, context) => {
    calls++;
    assert.equal(context.maxTokens, calls === 1 ? 5 : 3);
    return { patch: patch(calls === 1 ? 42 : 'Fixed'), tokensUsed: 2 };
  }, boundary, { maxTokens: 5 });
  assert.equal(result.ok, true); if (result.ok) assert.equal(result.value.tokensUsed, 4);
  assert.equal(calls, 2);
  calls = 0;
  const attempts = await run(async () => { calls++; return { patch: patch(42), tokensUsed: 0 }; }, boundary, { maxAttempts: 3 });
  assert.equal(attempts.ok, false);
  assert.equal(calls, 3);
  for (const tokensUsed of [undefined, -1, 1.5, Infinity, 11]) {
    const invalid = await run(async () => ({ patch: patch(), tokensUsed } as LyraGenRepairResponse), boundary, { maxTokens: 10 });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.equal(invalid.diagnostics[0]?.code, 'repair.limit');
  }
});

test('cancellation and deadlines abort ignored transports; late rejection stays handled', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const early = await repairView({ catalog, getCurrent: boundary, nodeIds: ['field'], signal: controller.signal, transport: async () => { calls++; return response(); } });
  assert.equal(early.ok, false);
  assert.equal(calls, 0);
  const pending = deferred<LyraGenRepairResponse>();
  const entered = deferred<AbortSignal>();
  const later = new AbortController();
  const active = repairView({ catalog, getCurrent: boundary, nodeIds: ['field'], signal: later.signal, transport: async (_request, context) => { entered.resolve(context.signal); return pending.promise; } });
  const signal = await entered.promise;
  later.abort();
  const canceled = await active;
  assert.equal(canceled.ok, false);
  if (!canceled.ok) assert.equal(canceled.diagnostics[0]?.code, 'repair.aborted');
  assert.equal(signal.aborted, true);
  pending.reject(new Error('Late transport failure.'));
  await new Promise(resolve => setTimeout(resolve, 0));
  const timed = await run(async () => new Promise<LyraGenRepairResponse>(() => {}), boundary, { maxElapsedMs: 10 });
  assert.equal(timed.ok, false); if (!timed.ok) assert.equal(timed.diagnostics[0]?.code, 'repair.limit');
});

test('elapsed-time ceilings are rechecked after synchronous host boundary reads', async () => {
  const now = Date.now;
  try {
    for (const delayedRead of [2, 4]) {
      let time = 1000;
      let reads = 0;
      let calls = 0;
      Date.now = () => time;
      const result = await repairView({ catalog, nodeIds: ['field'], limits: { maxElapsedMs: 100 }, getCurrent: () => { if (++reads === delayedRead) time += 101; return boundary(); }, transport: async () => { calls++; return response(); } });
      assert.equal(result.ok, false); if (!result.ok) assert.equal(result.diagnostics[0]?.code, 'repair.limit');
      assert.equal(calls, delayedRead === 2 ? 0 : 1);
    }
  } finally { Date.now = now; }
});

test('transport failures stay generic and cancellation wins over transport abort errors', async () => {
  const failed = await run(async () => { throw new Error('Private credential detail.'); });
  assert.equal(failed.ok, false); if (!failed.ok) {
    assert.equal(failed.diagnostics[0]?.code, 'repair.transport');
    assert.equal(JSON.stringify(failed).includes('credential'), false);
  }
  const controller = new AbortController();
  const canceled = await repairView({ catalog, getCurrent: boundary, nodeIds: ['field'], signal: controller.signal, transport: async () => { controller.abort(); throw new Error('Provider abort detail.'); } });
  assert.equal(canceled.ok, false); if (!canceled.ok) assert.equal(canceled.diagnostics[0]?.code, 'repair.aborted');
});

test('generation, revision, same-revision view changes and user state edits reject stale results', async () => {
  for (const mutate of [
    (current: LyraGenRepairBoundary) => ({ ...current, generation: 1 }),
    (current: LyraGenRepairBoundary) => ({ ...current, view: { ...current.view, revision: 1 } }),
    (current: LyraGenRepairBoundary) => ({ ...current, view: { ...current.view, root: { ...current.view.root, children: [...current.view.root.children!].reverse() } } }),
    (current: LyraGenRepairBoundary) => { const state = setSurfaceState(current.state!, '/value', 'Latest edit'); if (!state.ok) throw new Error('Invalid fixture.'); return { ...current, state: state.value }; },
  ]) {
    let current: LyraGenRepairBoundary = { ...boundary(), state: createSurfaceState(view) };
    const pending = deferred<LyraGenRepairResponse>();
    const entered = deferred<void>();
    const active = run(async () => { entered.resolve(); return pending.promise; }, () => current);
    await entered.promise;
    current = mutate(current);
    pending.resolve(response());
    const result = await active;
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.diagnostics[0]?.code, 'revision.conflict');
  }
});

test('security, identity, resource and expanded scope failures never reach repair transport', async () => {
  let calls = 0;
  const transport = async () => { calls++; return response(); };
  for (const invalid of [
    { ...view, catalog: { id: 'other', version: '1' } },
    { ...view, root: { ...view.root, children: [view.root.children![0]!, view.root.children![0]!] } },
    { ...view, root: { ...view.root, action: { name: 'deleteEverything' } } },
  ]) assert.equal((await run(transport, () => ({ view: invalid, generation: 0 }))).ok, false);
  assert.equal((await run(transport, boundary, { maxNodes: 1 })).ok, false);
  assert.equal((await repairView({ catalog, getCurrent: boundary, nodeIds: ['private'], transport })).ok, false);
  assert.equal((await repairView({ catalog, getCurrent: boundary, nodeIds: ['row', 'field'], transport })).ok, false);
  assert.equal(calls, 0);
  const escaped = await run(async () => ({ patch: { ...patch(), operations: [{ op: 'replace', nodeId: 'private', node: { id: 'private', type: 'input' } }] }, tokensUsed: 1 }));
  assert.equal(escaped.ok, false);
});

test('truncated diagnostics discovered outside scope never reach the next transport attempt', async () => {
  const invalid = { ...view, root: { ...view.root, children: [view.root.children![0]!, { ...view.root.children![1]!, props: { label: 42 } }] } };
  let calls = 0;
  const result = await repairView({ catalog, getCurrent: () => ({ view: invalid, generation: 0 }), nodeIds: ['field'], limits: { maxDiagnostics: 1 }, transport: async () => { calls++; return response(); } });
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.diagnostics[0]?.code, 'repair.scope');
  assert.equal(calls, 1);
});

test('repair cannot drop dirty ownership or return invalid post-reconciliation state', async () => {
  const edited = setSurfaceState(createSurfaceState(view), '/value', 'Edited');
  assert.equal(edited.ok, true); if (!edited.ok) return;
  const result = await run(async () => ({ patch: { ...patch(), operations: [{ op: 'replace', nodeId: 'field', node: { id: 'field', type: 'input', props: { label: 'Fixed' } } }] }, tokensUsed: 1 }), () => ({ ...boundary(), state: edited.value }));
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.diagnostics[0]?.code, 'state.unauthorized');
});

test('seeded repair schedules always reject newer generations before returning candidates', async () => {
  await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), fc.string({ maxLength: 64 }), async (generation, label) => {
    let current = boundary();
    const result = await run(async () => { current = { ...current, generation }; return { patch: patch(label), tokensUsed: 1 }; }, () => current);
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.diagnostics[0]?.code, 'revision.conflict');
  }), { seed: 1729, numRuns: 200 });
});

test('repair captures node scope before a transport mutates caller-owned options', async () => {
  const nodeIds = ['field'];
  let calls = 0;
  const result = await repairView({ catalog, getCurrent: boundary, nodeIds, transport: async request => {
    calls++;
    assert.deepEqual(request.nodes.map(node => node.id), ['field']);
    nodeIds[0] = 'private';
    return { patch: patch(calls === 1 ? 42 : 'Fixed'), tokensUsed: 1 };
  } });
  assert.equal(result.ok, true);
  assert.equal(calls, 2);
});

test('cancellation during the final current-boundary read rejects the candidate', async () => {
  const controller = new AbortController();
  let reads = 0;
  const result = await repairView({ catalog, nodeIds: ['field'], signal: controller.signal, getCurrent: () => { if (++reads === 4) controller.abort(); return boundary(); }, transport: async () => response() });
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.diagnostics[0]?.code, 'repair.aborted');
});

test('transport usage accessors are rejected without executing changing usage getters', async () => {
  let reads = 0;
  const result = await run(async () => ({ patch: patch(), get tokensUsed() { return ++reads === 1 ? 1 : 0; } }));
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.diagnostics[0]?.code, 'json.accessor');
  assert.equal(reads, 0);
});
