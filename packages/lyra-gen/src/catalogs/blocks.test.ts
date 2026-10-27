import assert from 'node:assert/strict';
import test from 'node:test';
import { answerBlocksCatalog, createCatalog, initialCatalog } from '../catalog.js';
import { buildCatalogPrompt, exportCatalogJsonSchema } from '../prompts.js';
import { validateView } from '../runtime.js';
import type { LyraGenNode } from '../types.js';
import { expandComparison, expandKpiRow, expandSteps } from './blocks.js';

const blocks = answerBlocksCatalog();
const view = (root: LyraGenNode, catalog = blocks) => ({ version: '1' as const, catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'blocks', revision: 0, root });
const kpi: LyraGenNode = { id: 'k', type: 'kpi-row', props: { items: [{ label: 'Revenue', value: 1200, deltaPercent: 4.5 }, { label: 'Churn', value: '2.1%', goodDirection: 'down', caption: 'Monthly' }] } };
const comparison: LyraGenNode = { id: 'c', type: 'comparison', props: { caption: 'Plans', columns: ['Basic', 'Pro'], rows: [{ label: 'Seats', values: [1, 10] }, { label: 'Support', values: ['Email', null] }] } };
const steps: LyraGenNode = { id: 's', type: 'steps', props: { label: 'Rollout', items: [{ label: 'Plan' }, { label: 'Build', description: 'Now' }, { label: 'Ship' }], current: 1 } };

test('overlay identity, composition and untouched base', () => {
  const before = JSON.stringify(initialCatalog.components, (_, value: unknown) => (typeof value === 'function' ? 'fn' : value));
  const overlay = answerBlocksCatalog(initialCatalog);
  assert.equal(overlay.id, 'lyra-reviewed+blocks');
  assert.equal(overlay.version, initialCatalog.version);
  assert.ok(Object.isFrozen(overlay));
  for (const role of ['kpi-row', 'comparison', 'steps', 'stepper']) assert.ok(Object.hasOwn(overlay.components, role));
  for (const [role, component] of Object.entries(initialCatalog.components)) if (role !== 'stat') assert.equal(overlay.components[role], component);
  assert.equal(Object.hasOwn(initialCatalog.components, 'kpi-row'), false);
  assert.equal(Object.hasOwn(initialCatalog.components['stat']!.properties, 'deltaPercent'), false);
  assert.equal(JSON.stringify(initialCatalog.components, (_, value: unknown) => (typeof value === 'function' ? 'fn' : value)), before);
  assert.equal(initialCatalog.id, 'lyra-reviewed');
});

test('overlay refuses bases lacking expansion targets or already defining a block', () => {
  for (const role of ['row', 'stat', 'table']) {
    const { [role]: _omitted, ...rest } = initialCatalog.components;
    assert.throws(() => answerBlocksCatalog(createCatalog({ id: 'small', version: '1', components: { text: initialCatalog.components['text']!, ...rest } })), TypeError);
  }
  assert.throws(() => answerBlocksCatalog(blocks), TypeError);
});

test('kpi-row expands to a row of stats with deterministic ids', () => {
  const node = expandKpiRow(kpi);
  assert.equal(node.id, 'k');
  assert.equal(node.type, 'row');
  assert.deepEqual(node.children?.map(child => child.id), ['k--0', 'k--1']);
  assert.deepEqual(node.children?.[0], { id: 'k--0', type: 'stat', props: { label: 'Revenue', value: '1200', deltaPercent: 4.5 } });
  assert.deepEqual(node.children?.[1]?.props, { label: 'Churn', value: '2.1%', caption: 'Monthly', goodDirection: 'down' });
});

test('comparison expands to a table with generated keys and throws on mismatched rows', () => {
  const node = expandComparison(comparison);
  assert.equal(node.type, 'table');
  assert.deepEqual(node.props?.['columns'], [{ key: 'c0', label: 'Item' }, { key: 'c1', label: 'Basic' }, { key: 'c2', label: 'Pro' }]);
  assert.deepEqual(node.props?.['rows'], [{ c0: 'Seats', c1: 1, c2: 10 }, { c0: 'Support', c1: 'Email', c2: null }]);
  assert.throws(() => expandComparison({ ...comparison, props: { ...comparison.props!, rows: [{ label: 'A', values: [1, 2] }, { label: 'B', values: [1] }] } }), RangeError);
});

test('steps expands to a read-only stepper with derived states', () => {
  const node = expandSteps(steps);
  assert.equal(node.type, 'stepper');
  assert.equal(node.props?.['readonly'], true);
  assert.equal(node.props?.['accessibleLabel'], 'Rollout');
  assert.deepEqual(node.props?.['steps'], [{ stepId: 's--0', label: 'Plan', state: 'completed' }, { stepId: 's--1', label: 'Build', state: 'current', title: 'Now' }, { stepId: 's--2', label: 'Ship', state: 'pending' }]);
  const none = expandSteps({ ...steps, props: { label: 'x', items: [{ label: 'a' }] } });
  assert.deepEqual((none.props?.['steps'] as { state: string }[]).map(step => step.state), ['pending']);
});

test('expanded output validates against the overlay primitives', () => {
  for (const [node, expand] of [[kpi, expandKpiRow], [comparison, expandComparison], [steps, expandSteps]] as const) {
    const result = validateView(view(expand(node)), blocks);
    assert.ok(result.ok, JSON.stringify(result.diagnostics));
  }
});

test('block schemas accept valid shapes and reject invalid ones with useful paths', () => {
  for (const node of [kpi, comparison, steps]) {
    const result = validateView(view(node), blocks);
    assert.ok(result.ok, `${node.type}: ${JSON.stringify(result.diagnostics)}`); // expansion also runs once the runtime hook exists
  }
  const rejected: [LyraGenNode, string][] = [
    [{ id: 'k', type: 'kpi-row', props: { items: [] } }, '/root/props/items'],
    [{ id: 'k', type: 'kpi-row', props: { items: Array.from({ length: 7 }, () => ({ label: 'a', value: 1 })) } }, '/root/props/items'],
    [{ id: 'k', type: 'kpi-row', props: { items: [{ label: 'a' }] } }, '/root/props/items/0'],
    [{ id: 'k', type: 'kpi-row', props: { items: [{ label: 'a', value: 1, goodDirection: 'sideways' }] } }, '/root/props/items/0/goodDirection'],
    [{ id: 'c', type: 'comparison', props: { caption: 'x', columns: ['only'], rows: [{ label: 'a', values: [1] }] } }, '/root/props/columns'],
    [{ id: 'c', type: 'comparison', props: { caption: 'x', columns: ['a', 'b'], rows: [] } }, '/root/props/rows'],
    [{ id: 'c', type: 'comparison', props: { columns: ['a', 'b'], rows: [{ label: 'a', values: [1, 2] }] } }, '/root'],
    [{ id: 's', type: 'steps', props: { label: 'x', items: [{ label: 'a' }], current: 1.5 } }, '/root/props/current'],
    [{ id: 's', type: 'steps', props: { label: 'x', items: Array.from({ length: 13 }, () => ({ label: 'a' })) } }, '/root/props/items'],
  ];
  for (const [node, path] of rejected) {
    const result = validateView(view(node), blocks);
    assert.ok(!result.ok, `${node.type} ${path}`);
    assert.ok(result.diagnostics.some(d => d.path.startsWith(path)), `${path}: ${JSON.stringify(result.diagnostics)}`);
  }
});

test('blocks are unavailable in the base catalog and examples validate in the overlay', () => {
  assert.ok(!validateView(view(kpi, initialCatalog as typeof blocks), initialCatalog).ok);
  for (const role of ['kpi-row', 'comparison', 'steps']) for (const example of blocks.components[role]!.examples ?? []) {
    const result = validateView(view(example), blocks);
    assert.ok(result.ok, `${role}: ${JSON.stringify(result.diagnostics)}`);
  }
});

test('prompt and JSON Schema include the overlay roles', () => {
  const prompt = buildCatalogPrompt(blocks);
  for (const role of ['kpi-row', 'comparison', 'steps', 'stepper']) assert.ok(prompt.includes(`"${role}"`), role);
  assert.ok(prompt.includes('lyra-reviewed+blocks'));
  const defs = (exportCatalogJsonSchema(blocks) as { $defs: Record<string, unknown> }).$defs;
  for (const role of ['kpi-row', 'comparison', 'steps', 'stepper']) assert.ok(Object.hasOwn(defs, role), role);
  assert.ok(!buildCatalogPrompt(initialCatalog).includes('"kpi-row"'));
});

test('a mismatched comparison row is a block.invalid failure, contained in isolate mode', () => {
  const mismatched = { ...comparison, props: { ...comparison.props!, rows: [{ label: 'A', values: [1, 2] }, { label: 'B', values: [1] }] } };
  const strict = validateView(view(mismatched), blocks);
  assert.ok(!strict.ok);
  assert.deepEqual(strict.diagnostics.map(d => [d.code, d.path]), [['block.invalid', '/root']]);
  assert.match(strict.diagnostics[0]!.message, /Row 1 has 1 values for 2 columns/);
  const isolated = validateView(view({ id: 'root', type: 'stack', children: [kpi, mismatched] }), blocks, { recovery: 'isolate' });
  assert.ok(isolated.ok, JSON.stringify(isolated.diagnostics));
  assert.deepEqual(isolated.isolated?.map(entry => entry.nodeId), [mismatched.id]);
});

test('runtime expansion yields the primitive tree', () => {
  const result = validateView(view({ id: 'root', type: 'stack', children: [kpi, steps] }), blocks);
  assert.ok(result.ok, JSON.stringify(result.diagnostics));
  const [first, second] = result.value.root.children!;
  assert.equal(first!.type, 'row');
  assert.deepEqual(first!.children!.map(child => child.id), ['k--0', 'k--1']);
  assert.equal(second!.type, 'stepper');
});
