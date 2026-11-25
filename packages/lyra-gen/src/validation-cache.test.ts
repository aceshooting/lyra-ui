import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCatalog } from './catalog.js';
import { validateCanonicalView, ViewValidationCache } from './isolation.js';
import { resolveLimits, snapshotJson, validateSchema } from './schema.js';
import { applyViewPatch, validateView } from './runtime.js';
import type { LyraGenCatalog, LyraGenNode, LyraGenSchema, LyraGenView } from './types.js';

const json = (value: unknown): string => JSON.stringify(value);

test('a mutable schema is admitted on every call, a frozen one per limits', () => {
  const schema = { type: 'object', properties: { size: { type: 'integer', maximum: 3 } } } as { type: 'object'; properties: Record<string, LyraGenSchema> };
  assert.equal(validateSchema({ size: 5 }, schema).ok, false);
  schema.properties['size'] = { type: 'integer', maximum: 9 };
  assert.equal(validateSchema({ size: 5 }, schema).ok, true);
  const frozen = Object.freeze({ type: 'array', items: Object.freeze({ type: 'string' }) }) as LyraGenSchema;
  assert.equal(validateSchema(['a'], frozen).ok, true);
  // The same frozen schema under tighter limits fails its own admission instead of reusing the default result.
  assert.deepEqual(validateSchema(['a'], frozen, { maxNodes: 2 }).diagnostics.map(item => item.code), ['limit.nodes']);
  assert.equal(validateSchema(['a'], frozen).ok, true);
  // A frozen schema with a mutable part is never reused.
  const inner = { type: 'string', maxLength: 1 } as { type: 'string'; maxLength: number };
  const partly = Object.freeze({ type: 'array', items: inner }) as LyraGenSchema;
  assert.equal(validateSchema(['ab'], partly).ok, false);
  inner.maxLength = 5;
  assert.equal(validateSchema(['ab'], partly).ok, true);
});

test('resolved limits are reused only for frozen overrides', () => {
  const overrides = { maxNodes: 10 };
  assert.equal(resolveLimits(overrides).maxNodes, 10);
  overrides.maxNodes = 20;
  assert.equal(resolveLimits(overrides).maxNodes, 20);
  const frozen = Object.freeze({ maxDepth: 3 });
  assert.equal(resolveLimits(frozen), resolveLimits(frozen));
  assert.equal(resolveLimits(resolveLimits(frozen)), resolveLimits(frozen));
  assert.equal(resolveLimits().maxNodes, resolveLimits({}).maxNodes);
});

test('admission failures keep their escaped paths', () => {
  const result = snapshotJson({ 'a/b': [{ 'c~d': 1n }] });
  assert.deepEqual(result.diagnostics, [{ code: 'json.type', path: '/a~1b/0/c~0d', message: 'Only JSON values are permitted.', severity: 'error' }]);
  assert.equal(snapshotJson({ x: 'abcdef' }, { maxStringLength: 3 }).diagnostics[0]?.path, '/x');
  assert.equal(validateSchema({ 'k/1': 'x' }, { type: 'object', properties: { 'k/1': { type: 'number' } } }).diagnostics[0]?.path, '/k~11');
});

const definition: LyraGenCatalog = {
  id: 'cache', version: '1',
  components: {
    stack: { tag: 'div', properties: {}, children: true },
    text: { tag: 'p', properties: { tone: { type: 'string', enum: ['calm', 'loud'] } }, text: true },
    pair: {
      tag: 'div', properties: { label: { type: 'string', minLength: 1 } }, required: ['label'],
      expand: node => ({ id: node.id, type: 'stack', children: [{ id: `${node.id}--0`, type: 'text', text: String(node.props?.['label']) }] })
    }
  }
};
const view = (root: LyraGenNode): LyraGenView => ({ version: '1', catalog: { id: 'cache', version: '1' }, surfaceId: 's', revision: 1, root });

test('a validated view is reused only for its created catalog and limits', () => {
  const catalog = createCatalog(definition);
  const first = validateView(view({ id: 'r', type: 'stack', children: [{ id: 't', type: 'text', text: 'x', props: { tone: 'calm' } }] }), catalog);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const again = validateView(first.value, catalog);
  assert.equal(again.ok && again.value, first.value);
  assert.equal(validateView(first.value, catalog, { limits: { maxNodes: 4 } }).ok, false);
  // A catalog that was not created by createCatalog can change, so its results are recomputed.
  const mutable = { ...definition, components: { ...definition.components } } as { components: Record<string, unknown> } & LyraGenCatalog;
  const checked = validateView(first.value, mutable);
  assert.equal(checked.ok, true);
  if (!checked.ok) return;
  delete mutable.components['text'];
  assert.deepEqual(validateView(checked.value, mutable).diagnostics.map(item => item.code), ['catalog.component']);
  // A patched view is reused as well, and still carries the next revision.
  const patched = applyViewPatch(first.value, { surfaceId: 's', expectedRevision: 1, operations: [{ op: 'set', nodeId: 't', prop: 'tone', value: 'loud' }] }, catalog);
  assert.equal(patched.ok, true);
  if (patched.ok) assert.equal((validateView(patched.value, catalog) as { value: LyraGenView }).value, patched.value);
});

test('incremental validation matches a fresh validation, including identity conflicts around block expansion', () => {
  const catalog = createCatalog(definition);
  const block: LyraGenNode = { id: 'k', type: 'pair', props: { label: 'Total' } };
  const leaf: LyraGenNode = { id: 'm', type: 'text', text: 'x' };
  const bad: LyraGenNode = { id: 'b', type: 'text', props: { tone: 'shrill' } };
  const sequence: LyraGenNode[] = [
    { id: 'r', type: 'stack', children: [block] },
    { id: 'r', type: 'stack', children: [block, leaf] },
    // An earlier node (here the root) now takes the block's identity: the block must not expand any more.
    { id: 'k', type: 'stack', children: [block, leaf] },
    { id: 'r', type: 'stack', children: [{ id: 'k', type: 'text', text: 'first' }, block, leaf] },
    { id: 'r', type: 'stack', children: [{ id: 'm', type: 'text', text: 'first' }, block, leaf, bad] },
    { id: 'r', type: 'stack', children: [block, leaf, bad] },
    { id: 'r', type: 'stack', children: [{ id: 's', type: 'stack', children: [block, leaf] }, bad] },
  ];
  for (const options of [{}, { recovery: 'isolate' as const }, { limits: { maxDiagnostics: 1 } }]) {
    const cache = new ViewValidationCache();
    for (const [index, root] of sequence.entries()) {
      const input = view(root);
      assert.equal(json(validateCanonicalView(input, catalog, options, input, cache)), json(validateCanonicalView(input, catalog, options)), `step ${index} ${json(options)}`);
    }
  }
});
