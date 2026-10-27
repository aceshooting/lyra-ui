import assert from 'node:assert/strict';
import test from 'node:test';
import { DashboardNavigation, SharedDashboardState, constrainDashboardLayout, dashboardPageWindow, editDashboardLayout, regenerateDashboardLayout, toLyraDashboardLayout } from './dashboard.js';
import type { DashboardNavigationFrame } from './dashboard.js';

test('linked filters update once, preserve independent scopes and clear dangling selection', () => {
  const state = new SharedDashboardState((_scope, filters) => typeof filters['region'] === 'string' || Object.keys(filters).length === 0);
  let chartCalls = 0, tableCalls = 0;
  const offChart = state.subscribe('sales', 'chart', event => {
    chartCalls++;
    assert.equal(state.update('sales', 'chart', { selection: event.snapshot.selection }, event), false);
  });
  state.subscribe('sales', 'table', () => { tableCalls++; });
  state.update('inventory', 'table', { filters: { region: 'west' } });
  state.update('sales', 'table', { filters: { region: 'east' }, selection: ['a', 'b', 'a'] });
  assert.equal(chartCalls, 1);
  assert.equal(tableCalls, 0);
  state.clearDangling('sales', new Set(['b']));
  assert.deepEqual(state.snapshot('sales').selection, ['b']);
  assert.deepEqual(state.snapshot('inventory').filters, { region: 'west' });
  assert.equal(state.update('sales', 'chart', { filters: { region: 'east' } }), false);
  offChart();
  state.removeScope('sales');
  state.update('sales', 'host', { selection: ['c'] });
  assert.equal(chartCalls, 2);
  assert.equal(tableCalls, 1);
  state.dispose();
});
test('shared-state filter validators and budgets reject invalid updates atomically', () => {
  const state = new SharedDashboardState((_scope, filters) => filters['valid'] === true, 1, 100);
  state.update('a', 'table', { filters: { valid: true } });
  assert.throws(() => state.update('a', 'table', { filters: { valid: false } }));
  assert.throws(() => state.update('b', 'table', { filters: { valid: true } }));
  assert.equal(state.snapshot('a').revision, 1);
});
const frame = (destination: string): DashboardNavigationFrame => ({ destination, label: destination, state: { filter: 'east', selection: ['a'] }, scroll: { inline: 12, block: 200 }, focusId: 'panel' });
test('drilldown restores the exact edited parent and rejects inaccessible returns', async () => {
  let denied = '';
  const navigation = new DashboardNavigation(destination => destination !== denied);
  await navigation.enter(frame('overview'));
  const parent = { ...frame('overview'), state: { filter: 'user-edited', selection: ['b'] } };
  await navigation.enter(frame('detail'), parent);
  assert.deepEqual(navigation.breadcrumbs.map(crumb => crumb.destination), ['overview', 'detail']);
  denied = 'overview';
  assert.equal(await navigation.back(), undefined);
  assert.equal(navigation.current?.destination, 'detail');
  denied = '';
  assert.deepEqual(await navigation.back(), parent);
  navigation.reset();
  assert.equal(navigation.current, undefined);
});
test('page windows scale without allocating rows and disclose sampling', () => {
  assert.deepEqual(dashboardPageWindow(500000, 100000, 100, 1000000, { sampled: true, aggregation: 'daily' }), { offset: 500000, limit: 100, total: 1000000, sampled: true, aggregation: 'daily' });
  assert.deepEqual(dashboardPageWindow(99, 20, 10, 0), { offset: 0, limit: 0, total: 0, sampled: false });
  assert.throws(() => dashboardPageWindow(Infinity, 20, 100));
});
const constraints = { columns: 4, maxRows: 8, maxPanels: 8, collision: 'pack' } as const;
test('layout packs around pinned cells and preserves them on regeneration', () => {
  const panels = [{ id: 'pinned', column: 0, row: 0, width: 2, height: 2, pinned: true }, { id: 'new', column: 0, row: 0, width: 2, height: 2 }];
  const layout = constrainDashboardLayout(panels, constraints);
  assert.equal(layout[1]?.column, 2);
  assert.throws(() => editDashboardLayout(layout, { type: 'move', id: 'pinned', columns: 1, rows: 0 }, constraints));
  const refreshed = regenerateDashboardLayout(layout, [{ id: 'new', column: 0, row: 0, width: 4, height: 2 }], constraints);
  assert.deepEqual(refreshed[0], layout[0]);
  assert.equal(refreshed[1]?.row, 2);
  const unpinned = editDashboardLayout(layout, { type: 'pin', id: 'pinned', pinned: false }, constraints);
  assert.equal(editDashboardLayout(unpinned, { type: 'resize', id: 'pinned', columns: -100, rows: 0 }, constraints)[0]?.width, 1);
  assert.throws(() => constrainDashboardLayout(panels, { ...constraints, collision: 'reject' }));
});
test('navigation and shared updates reject accessors before reading them; huge layouts reject promptly', async () => {
  let reads = 0;
  const navigation = new DashboardNavigation(() => true);
  await assert.rejects(navigation.enter({ ...frame('overview'), get destination() { reads++; return 'overview'; } }));
  const shared = new SharedDashboardState(() => true);
  assert.throws(() => shared.update('sales', 'table', { get selection() { reads++; return ['a']; } }));
  assert.equal(reads, 0);
  assert.throws(() => constrainDashboardLayout([{ id: 'a', column: 0, row: 0, width: 1, height: 1 }], { ...constraints, maxRows: Number.MAX_SAFE_INTEGER }));
});

test('panel layout maps directly to the public controlled dashboard-grid vocabulary', () => {
  const layout = toLyraDashboardLayout([{ id: 'panel', column: 1, row: 2, width: 2, height: 3, pinned: true }], constraints);
  assert.deepEqual(layout, [{ cellId: 'panel', x: 1, y: 2, w: 2, h: 3, locked: true }]);
  assert.equal(Object.isFrozen(layout), true);
  assert.equal(Object.isFrozen(layout[0]), true);
});

test('a rejected enter or back is a no-op and does not cancel a pending valid navigation', async () => {
  let release!: (allowed: boolean) => void;
  const navigation = new DashboardNavigation(destination => destination === 'slow' ? new Promise<boolean>(done => { release = done; }) : true, 2);
  assert.equal(await navigation.enter(frame('root')), true);
  const pending = navigation.enter(frame('slow'));
  assert.equal(await navigation.back(), undefined, 'a single-frame back has no parent');
  await navigation.enter(frame('a'), frame('missing-parent'));
  release(true);
  assert.equal(await pending, true);
  assert.deepEqual(navigation.breadcrumbs.map(crumb => crumb.destination), ['root', 'slow']);
  assert.equal(await navigation.enter(frame('deep')), false, 'depth limit reached');
});
test('depth-limit rejection does not cancel a pending back navigation', async () => {
  let release!: (allowed: boolean) => void;
  let hold = false;
  const navigation = new DashboardNavigation(destination => hold && destination === 'root' ? new Promise<boolean>(done => { release = done; }) : true, 2);
  await navigation.enter(frame('root'));
  await navigation.enter(frame('child'));
  hold = true;
  const pending = navigation.back();
  assert.equal(await navigation.enter(frame('over')), false);
  release(true);
  assert.equal((await pending)?.destination, 'root');
});
test('a throwing listener neither starves the others nor loses the committed update', () => {
  const state = new SharedDashboardState(() => true);
  const seen: string[] = [];
  state.subscribe('s', 'a', () => { throw new Error('boom'); });
  state.subscribe('s', 'b', event => { seen.push(`b${event.snapshot.revision}`); });
  state.subscribe('s', 'c', event => { seen.push(`c${event.snapshot.revision}`); });
  assert.throws(() => state.update('s', 'origin', { selection: ['x'] }), { message: 'boom' });
  assert.deepEqual(seen, ['b1', 'c1']);
  assert.deepEqual(state.snapshot('s').selection, ['x']);
});
test('shared snapshots are frozen and shared instead of copied', () => {
  const state = new SharedDashboardState(() => true);
  let received: unknown;
  state.subscribe('s', 'a', event => { received = event.snapshot; });
  state.update('s', 'origin', { filters: { k: 'v' }, selection: ['x'] });
  assert.equal(received, state.snapshot('s'));
  assert.equal(Object.isFrozen(state.snapshot('s').selection), true);
  assert.equal(Object.isFrozen(state.snapshot('s').filters), true);
  assert.equal(Object.isFrozen(state.snapshot('none')), true);
});
