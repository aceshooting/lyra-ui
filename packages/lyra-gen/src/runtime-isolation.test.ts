import assert from 'node:assert/strict';
import { test } from 'node:test';
import { markupFixtures } from '../test/fixtures/markup.js';
import { LYRA_GEN_ISOLATED_TYPE } from './isolation.js';
import { applyViewPatch, createSurfaceState, validateView } from './runtime.js';
import type { LyraGenCatalog, LyraGenNode, LyraGenView } from './types.js';

const base = { text: { tag: 'span', properties: {}, text: true }, row: { tag: 'div', properties: {}, children: true }, stat: { tag: 'b', properties: { label: { type: 'string' } }, text: true } } as const;
type Expand = (node: LyraGenNode) => LyraGenNode;
const catalogWith = (expand: Expand): LyraGenCatalog => ({ id: 'blocks', version: '1', components: { ...base, kpi: { tag: 'div', properties: { count: { type: 'number' } }, required: ['count'], expand } } });
const twoStats: Expand = node => ({ id: node.id, type: 'row', children: [0, 1].map(index => ({ id: `${node.id}--${index}`, type: 'stat', props: { label: String(index) }, text: 'v' })) });
const view = (...children: unknown[]): LyraGenView => ({ version: '1', catalog: { id: 'blocks', version: '1' }, surfaceId: 's', revision: 0, root: { id: 'root', type: 'row', children } } as unknown as LyraGenView);
const kpi = (id = 'k') => ({ id, type: 'kpi', props: { count: 2 } });

test('strict mode stays byte-identical on the existing fixtures: results carry no isolation members', () => {
  assert.ok(markupFixtures.length > 0);
  const catalog = catalogWith(twoStats);
  const good = view({ id: 'a', type: 'text', text: 'x' });
  const strict = validateView(good, catalog);
  assert.deepEqual(Object.keys(strict), ['ok', 'value', 'diagnostics']);
  assert.deepEqual(validateView(good, catalog, { recovery: 'isolate' }), strict);
  const bad = validateView(view({ id: 'a', type: 'nope' }), catalog);
  assert.deepEqual(bad, { ok: false, diagnostics: [{ code: 'catalog.component', path: '/root/children/0/type', message: 'Component is not in the active catalog.', severity: 'error' }] });
});

test('expansion replaces the block by its primitives in place and the view is frozen and registered', () => {
  const catalog = catalogWith(twoStats);
  const result = validateView(view({ id: 'a', type: 'text', text: 'x' }, kpi()), catalog);
  assert.equal(result.ok, true); if (!result.ok) return;
  const block = result.value.root.children![1]!;
  assert.deepEqual([block.type, block.children!.map(child => child.id)], ['row', ['k--0', 'k--1']]);
  assert.equal(Object.isFrozen(block) && Object.isFrozen(block.children), true);
  assert.equal(validateView(result.value, catalog).ok, true);
  assert.equal(createSurfaceState(result.value).surfaceId, 's');
});

test('expansion runs only after the block own members validate', () => {
  let calls = 0;
  const catalog = catalogWith(node => { calls++; return twoStats(node); });
  const result = validateView(view({ id: 'k', type: 'kpi', props: { count: 'x' } }), catalog);
  assert.equal(result.ok, false);
  assert.equal(calls, 0);
  assert.equal(result.diagnostics[0]!.code, 'schema.type');
});

test('expansion identity rules are boundary failures in both modes', () => {
  const wrongRoot = catalogWith(node => ({ ...twoStats(node), id: 'other' }));
  const wrongChild = catalogWith(node => ({ id: node.id, type: 'row', children: [{ id: 'x', type: 'text' }] }));
  const nonObject = catalogWith(() => null as unknown as LyraGenNode);
  const reexpands = catalogWith(node => ({ id: node.id, type: 'kpi', props: { count: 1 } }));
  for (const catalog of [wrongRoot, wrongChild, nonObject, reexpands]) for (const recovery of ['strict', 'isolate'] as const) {
    const result = validateView(view({ id: 'a', type: 'text', text: 'x' }, kpi()), catalog, { recovery });
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0]!.code, 'block.expansion');
  }
});

test('expansion identity collision is a boundary failure in isolate mode', () => {
  const catalog = catalogWith(twoStats);
  const result = validateView(view({ id: 'k--0', type: 'text', text: 'x' }, kpi()), catalog, { recovery: 'isolate' });
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.code === 'identity.duplicate'));
});

test('invalid expanded output: strict rejects, isolate contains the block node', () => {
  const catalog = catalogWith(node => ({ id: node.id, type: 'row', children: [{ id: `${node.id}--0`, type: 'stat', props: { label: 5 } }] }));
  const input = view({ id: 'a', type: 'text', text: 'x' }, kpi());
  const strict = validateView(input, catalog);
  assert.equal(strict.ok, false);
  const isolate = validateView(input, catalog, { recovery: 'isolate' });
  assert.equal(isolate.ok, true); if (!isolate.ok) return;
  assert.deepEqual(isolate.value.root.children![1], { id: 'k', type: LYRA_GEN_ISOLATED_TYPE });
  assert.deepEqual(isolate.isolated!.map(item => [item.nodeId, item.path]), [['k', '/root/children/1']]);
});

test('a throwing expansion reports block.invalid: strict rejects, isolate contains the block', () => {
  const catalog = catalogWith(() => { throw new RangeError('Row 2 needs 3 values.'); });
  const input = view({ id: 'a', type: 'text', text: 'x' }, kpi());
  const strict = validateView(input, catalog);
  assert.deepEqual(strict, { ok: false, diagnostics: [{ code: 'block.invalid', path: '/root/children/1', message: 'Row 2 needs 3 values.', severity: 'error' }] });
  const isolate = validateView(input, catalog, { recovery: 'isolate' });
  assert.equal(isolate.ok, true); if (!isolate.ok) return;
  assert.deepEqual(isolate.value.root.children!.map(child => child.type), ['text', LYRA_GEN_ISOLATED_TYPE]);
  assert.equal(isolate.diagnostics[0]!.severity, 'warning');
  const generic = validateView(input, catalogWith(() => { throw new Error('x'.repeat(500)); }));
  assert.equal(generic.diagnostics[0]!.message, 'The block content is invalid.');
});

test('applyViewPatch passes recovery through and keeps existing markers', () => {
  const catalog = catalogWith(twoStats);
  const first = validateView(view({ id: 'a', type: 'text', text: 'x' }, { id: 'bad', type: 'nope' }), catalog, { recovery: 'isolate' });
  assert.equal(first.ok, true); if (!first.ok) return;
  const patch = (node: unknown) => ({ surfaceId: 's', expectedRevision: 0, operations: [{ op: 'replace' as const, nodeId: 'a', node: node as LyraGenNode }] });
  const strictPatch = applyViewPatch(first.value, patch({ id: 'a', type: 'nope' }), catalog);
  assert.equal(strictPatch.ok, false);
  const isolated = applyViewPatch(first.value, patch({ id: 'a', type: 'nope' }), catalog, { recovery: 'isolate' });
  assert.equal(isolated.ok, true); if (!isolated.ok) return;
  assert.deepEqual(isolated.isolated!.map(item => item.nodeId).sort(), ['a', 'bad']);
  assert.equal(isolated.value.revision, 1);
  const plain = applyViewPatch(first.value, patch({ id: 'a', type: 'text', text: 'y' }), catalog);
  assert.equal(plain.ok, true);
  assert.deepEqual(plain.ok && plain.isolated?.map(item => item.nodeId), ['bad']);
  const forged = applyViewPatch(first.value, patch({ id: 'a', type: LYRA_GEN_ISOLATED_TYPE }), catalog, { recovery: 'isolate' });
  assert.equal(forged.ok, false);
});
