import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dryRunDashboard, planDashboard } from './dashboard-plan.js';
import type { JsonValue, LyraGenCatalog, LyraGenView } from './types.js';

const catalog: LyraGenCatalog = {
  id: 'p', version: '1',
  components: {
    stack: { tag: 'div', properties: {}, children: true, text: true },
    card: { tag: 'section', properties: { title: { type: 'string', maxLength: 64 } }, children: true, text: true },
    picker: { tag: 'select', properties: { value: { type: 'string', maxLength: 32 }, label: { type: 'string', maxLength: 64 } }, accessibleName: { required: true, properties: ['label'] }, bindings: { value: { event: 'change', property: 'value' } }, interactive: true },
    total: { tag: 'output', properties: { value: { type: 'number', minimum: 0, maximum: 1e9 }, label: { type: 'string', maxLength: 64 } } },
    list: { tag: 'ul', properties: {}, children: true },
    row: { tag: 'li', properties: { value: { type: 'number', minimum: 0, maximum: 1e9 } } },
  },
  queries: {
    revenue: { params: { type: 'object', properties: { region: { type: 'string', enum: ['eu', 'us'] } }, required: ['region'], additionalProperties: false }, result: { type: 'object', properties: { total: { type: 'number', minimum: 0, maximum: 1e9 } }, required: ['total'], additionalProperties: false } },
    rows: { params: { type: 'object', properties: {}, additionalProperties: false } },
  },
};
const picker = { id: 'region', type: 'picker', props: { label: 'Region', value: 'eu' }, bindings: { value: '/region' } };
const view = (children: unknown[]): LyraGenView => ({ version: '1', catalog: { id: 'p', version: '1' }, surfaceId: 's', revision: 0, root: { id: 'root', type: 'stack', children } } as unknown as LyraGenView);
const revenue = { id: 'sum', type: 'total', props: { label: 'Revenue' }, dataQuery: { name: 'revenue', paramReads: { region: '/region' } }, liveReads: { value: '/total' } };
const base = view([picker, revenue]);

test('plan lists panels with sources, controls and state paths deterministically', () => {
  const plan = planDashboard(base, catalog);
  assert.deepEqual(plan.panels.map(panel => panel.nodeId), ['region', 'sum']);
  const sum = plan.panels[1]!;
  assert.equal(sum.role, 'total');
  assert.equal(sum.label, 'Revenue');
  assert.deepEqual(sum.sources.query, { name: 'revenue', params: [{ name: 'region', source: 'state', pointer: '/region', owned: true }] });
  assert.deepEqual(sum.sources.live, ['/total']);
  assert.deepEqual(plan.panels[0]!.controls, [{ nodeId: 'region', role: 'picker', label: 'Region', statePaths: ['/region'] }]);
  assert.deepEqual(plan.controls.map(control => control.nodeId), ['region']);
  assert.deepEqual(plan.warnings, []);
  assert.deepEqual(planDashboard(base, catalog), plan);
  assert.ok(Object.isFrozen(plan));
});

test('plan warns about unowned reads, undeclared live data, empty repeats and empty panels', () => {
  const warned = planDashboard(view([
    { id: 'a', type: 'total', dataQuery: { name: 'revenue', paramReads: { region: '/missing' } } },
    { id: 'b', type: 'total', liveReads: { value: '/x' } },
    { id: 'c', type: 'list', repeat: { items: '/rows', key: '/id' } },
    { id: 'd', type: 'card' },
  ]), catalog);
  const codes = warned.warnings.map(item => `${item.nodeId}:${item.code}`);
  assert.deepEqual(codes, ['a:param.unowned', 'b:live.undeclared', 'c:repeat.template', 'd:panel.empty']);
  assert.deepEqual(planDashboard(view([{ id: 'b', type: 'total', liveReads: { value: '/x' } }]), catalog, { liveData: true }).warnings, []);
  const literal = planDashboard(view([{ id: 'q', type: 'total', dataQuery: { name: 'revenue', params: { region: 'us' } } }]), catalog);
  assert.deepEqual(literal.panels[0]!.sources.query!.params, [{ name: 'region', source: 'literal', value: 'us' }]);
});

test('plan finds nested query nodes and repeat sources', () => {
  const plan = planDashboard(view([{ id: 'card', type: 'card', props: { title: 'Orders' }, children: [{ id: 'l', type: 'list', dataQuery: { name: 'rows' }, repeat: { items: '/rows', key: '/id', max: 5 }, children: [{ id: 'r', type: 'row', itemReads: { value: '/n' } }] }] }]), catalog);
  assert.deepEqual(plan.panels.map(panel => panel.nodeId), ['card', 'l']);
  assert.equal(plan.panels[0]!.label, 'Orders');
  assert.deepEqual(plan.panels[1]!.sources.repeat, { items: '/rows', key: '/id', from: 'query', max: 5 });
});

test('dry run reports ok, empty, failed, invalid-result and oversized per panel', async () => {
  const wide = view([picker,
    { id: 'ok', type: 'total', dataQuery: { name: 'revenue', paramReads: { region: '/region' } }, liveReads: { value: '/total' } },
    { id: 'none', type: 'total', dataQuery: { name: 'revenue', params: { region: 'us' } }, liveReads: { value: '/other' } },
    { id: 'bad', type: 'total', dataQuery: { name: 'revenue', params: { region: 'eu' } } },
  ]);
  const seen: JsonValue[] = [];
  const run = await dryRunDashboard(wide, catalog, {
    bindingState: { region: 'us' },
    queryProvider: request => {
      seen.push(request.params);
      if (request.nodeId === 'ok') return { total: 5 };
      if (request.nodeId === 'none') return { total: 0 };
      return { total: -1 };
    }
  });
  assert.deepEqual(seen, [{ region: 'us' }, { region: 'us' }, { region: 'eu' }]);
  const status = Object.fromEntries(run.panels.map(panel => [panel.nodeId, panel.status]));
  assert.deepEqual(status, { region: 'ok', ok: 'ok', none: 'empty', bad: 'invalid-result' });
  assert.equal(run.publishable, false);

  const mixed = view([
    { id: 'e1', type: 'total', dataQuery: { name: 'rows' } },
    { id: 'e2', type: 'total', dataQuery: { name: 'rows' }, liveReads: { value: '/nope' } },
    { id: 'f1', type: 'total', dataQuery: { name: 'rows' } },
    { id: 'big', type: 'total', dataQuery: { name: 'rows' } },
  ]);
  const second = await dryRunDashboard(mixed, catalog, {
    limits: { maxArrayLength: 4 },
    queryProvider: request => {
      if (request.nodeId === 'e1') return [];
      if (request.nodeId === 'e2') return { other: 1 };
      if (request.nodeId === 'f1') throw new Error('secret stack trace');
      return [1, 2, 3, 4, 5];
    }
  });
  assert.deepEqual(Object.fromEntries(second.panels.map(panel => [panel.nodeId, panel.status])), { e1: 'empty', e2: 'empty', f1: 'failed', big: 'oversized' });
  assert.ok(!JSON.stringify(second).includes('secret'));
  assert.equal(second.publishable, false);
});

test('empty results block publishing only when configured', async () => {
  const only = view([{ id: 'e', type: 'total', dataQuery: { name: 'rows' } }]);
  const provider = (): unknown => null;
  assert.equal((await dryRunDashboard(only, catalog, { queryProvider: provider })).publishable, true);
  assert.equal((await dryRunDashboard(only, catalog, { queryProvider: provider, emptyBlocksPublish: true })).publishable, false);
});

test('invalid parameters fail without calling the provider', async () => {
  let calls = 0;
  const run = await dryRunDashboard(view([{ id: 'p', type: 'total', dataQuery: { name: 'revenue' } }]), catalog, { queryProvider: () => { calls++; return {}; } });
  assert.equal(calls, 0);
  assert.equal(run.panels[0]!.status, 'failed');
  assert.equal(run.publishable, false);
});

test('a hung query times out and aborts its signal; the rest still run', async () => {
  let aborted = false;
  const two = view([{ id: 'slow', type: 'total', dataQuery: { name: 'rows' } }, { id: 'fast', type: 'total', dataQuery: { name: 'rows' }, liveReads: { value: '/v' } }]);
  const run = await dryRunDashboard(two, catalog, {
    timeoutMs: 20,
    queryProvider: request => request.nodeId === 'slow'
      ? new Promise(() => { request.signal.addEventListener('abort', () => { aborted = true; }); })
      : { v: 1 }
  });
  assert.equal(aborted, true);
  assert.deepEqual(run.panels.map(panel => panel.status), ['failed', 'ok']);
});

test('an external abort stops the run and fails what is left', async () => {
  const controller = new AbortController();
  const two = view([{ id: 'a', type: 'total', dataQuery: { name: 'rows' } }, { id: 'b', type: 'total', dataQuery: { name: 'rows' } }]);
  const called: string[] = [];
  const run = await dryRunDashboard(two, catalog, {
    signal: controller.signal,
    queryProvider: request => { called.push(request.nodeId); controller.abort(); return new Promise(() => undefined); }
  });
  assert.deepEqual(called, ['a']);
  assert.equal(run.aborted, true);
  assert.equal(run.publishable, false);
  assert.deepEqual(run.panels.map(panel => panel.status), ['failed', 'failed']);
});

test('dry run never mutates the view or state and never touches actions', async () => {
  const withAction = view([picker, { id: 'go', type: 'total', action: { name: 'launch', payload: null }, dataQuery: { name: 'revenue', paramReads: { region: '/region' } } }]);
  const frozen = JSON.stringify(withAction);
  const state = { region: 'eu' };
  const run = await dryRunDashboard(withAction, { ...catalog, components: { ...catalog.components, total: { ...catalog.components['total']!, events: ['click'] } }, actions: { launch: { payload: { type: 'null' } } } }, { bindingState: state, queryProvider: () => ({ total: 1 }) });
  assert.equal(JSON.stringify(withAction), frozen);
  assert.deepEqual(state, { region: 'eu' });
  assert.equal(run.valid, true);
});

test('an invalid view is not run', async () => {
  let calls = 0;
  const run = await dryRunDashboard({ nope: true } as unknown as LyraGenView, catalog, { queryProvider: () => { calls++; return {}; } });
  assert.equal(run.valid, false);
  assert.equal(run.publishable, false);
  assert.equal(calls, 0);
});
