import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateView } from './runtime.js';
import type { LyraGenCatalog } from './types.js';

const catalog: LyraGenCatalog = {
  id: 'x', version: '1',
  components: {
    stack: { tag: 'div', properties: {}, children: true },
    picker: { tag: 'select', properties: { value: { type: 'string', maxLength: 32 }, label: { type: 'string', maxLength: 64 } }, accessibleName: { required: true, properties: ['label'] }, bindings: { value: { event: 'change', property: 'value' } } },
    total: { tag: 'output', properties: { value: { type: 'string', maxLength: 64 }, disabled: { type: 'boolean' }, href: { type: 'string', maxLength: 64 } }, urlSinks: undefined },
  },
};
const view = (node: Record<string, unknown>): unknown => ({ version: '1', catalog: { id: 'x', version: '1' }, surfaceId: 's', revision: 0, root: { id: 'root', type: 'stack', children: [
  { id: 'mode', type: 'picker', props: { label: 'Mode', value: 'a' }, bindings: { value: '/mode' } }, { id: 'out', type: 'total', ...node },
] } });
const code = (node: Record<string, unknown>): string | undefined => { const result = validateView(view(node), catalog); return result.ok ? undefined : result.diagnostics[0]!.code; };

test('visible and checks take bounded conditions over owned state or live data', () => {
  assert.equal(code({ visible: { source: 'state', pointer: '/mode', op: 'equals', value: 'b' } }), undefined);
  assert.equal(code({ visible: { source: 'live', pointer: '/alerts/count', op: 'gt', value: 0 } }), undefined);
  assert.equal(code({ checks: [{ source: 'state', pointer: '/mode', op: 'in', value: ['a', 'b'] }] }), undefined);
  assert.equal(code({ visible: { source: 'state', pointer: '/mode', op: 'matches', value: '.*' } }), 'condition.invalid');
  assert.equal(code({ visible: { source: 'state', pointer: '/mode', op: 'gt', value: 'x' } }), 'condition.invalid');
  assert.equal(code({ visible: { source: 'state', pointer: '/mode', op: 'in', value: [{ nested: true }] } }), 'condition.invalid');
  assert.equal(code({ visible: { source: 'item', pointer: '/a', op: 'truthy' } }), 'condition.invalid');
  assert.equal(code({ visible: { source: 'state', pointer: '/unowned', op: 'truthy' } }), 'condition.unowned');
  assert.equal(code({ checks: [] }), 'condition.invalid');
});

test('computes call named host functions on referenced values for declared non-URL properties', () => {
  assert.equal(code({ computes: { value: { fn: 'formatNumber', arg: { source: 'live', pointer: '/revenue' } } } }), undefined);
  assert.equal(code({ computes: { value: { fn: 'sum', arg: [{ source: 'live', pointer: '/a' }, { source: 'live', pointer: '/b' }] } } }), undefined);
  assert.equal(code({ computes: { value: { fn: 'formatNumber', arg: { value: 42 } } } }), undefined);
  assert.equal(code({ computes: { invented: { fn: 'sum', arg: { value: 1 } } } }), 'compute.unknown');
  assert.equal(code({ computes: { href: { fn: 'sum', arg: { value: 1 } } } }), 'content.url-binding');
  assert.equal(code({ computes: { value: { fn: 'x; alert(1)', arg: { value: 1 } } } }), 'compute.invalid');
  assert.equal(code({ computes: { value: { fn: 'sum', arg: { source: 'state', pointer: '/unowned' } } } }), 'condition.unowned');
});

test('per-node accessibility is bounded, names roles through their own property and never hides interactive roles', () => {
  const named: LyraGenCatalog = { ...catalog, components: { ...catalog.components, chart: { tag: 'figure', properties: { label: { type: 'string', maxLength: 64 } }, accessibleName: { required: true, properties: ['label'] } } } };
  const check = (node: Record<string, unknown>): string | undefined => { const result = validateView(view(node), named); return result.ok ? undefined : result.diagnostics[0]!.code; };
  assert.equal(check({ type: 'chart', a11y: { label: 'Revenue by month', description: 'Twelve monthly totals.' } }), undefined);
  assert.equal(check({ type: 'chart' }), 'a11y.name');
  assert.equal(check({ type: 'total', a11y: { live: 'polite' } }), undefined);
  assert.equal(check({ type: 'total', a11y: { hidden: true } }), undefined);
  assert.equal(check({ type: 'total', a11y: { live: 'assertive' } }), 'a11y.invalid');
  assert.equal(check({ type: 'total', a11y: { label: 'No name property' } }), 'a11y.invalid');
  assert.equal(check({ type: 'total', a11y: { label: '' } }), 'a11y.invalid');
  assert.equal(validateView({ version: '1', catalog: { id: 'x', version: '1' }, surfaceId: 's', revision: 0, root: { id: 'root', type: 'stack', children: [{ id: 'mode', type: 'picker', props: { label: 'Mode' }, bindings: { value: '/mode' }, a11y: { hidden: true } }] } }, named).diagnostics[0]?.code, 'a11y.interactive');
});
