import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { validateView } from '../runtime.js';
import type { JsonValue, LyraGenCatalog, LyraGenNode, LyraGenView } from '../types.js';
import { applyJsonPatch, jsonPatchToViewPatch, MAX_JSON_PATCH_OPERATIONS, viewPatchToJsonPatch } from './json-patch.js';

const catalog: LyraGenCatalog = { id: 'patch', version: '1', components: {
  row: { tag: 'div', properties: { title: { type: 'string', maxLength: 16 } }, children: true },
  text: { tag: 'span', text: true, properties: {} },
} };
const pool = Array.from({ length: 10 }, (_, index) => `n${index}`);
const entry = fc.record({ row: fc.boolean(), parent: fc.nat(), label: fc.string({ maxLength: 6 }) });
const tree = fc.tuple(fc.string({ maxLength: 6 }), fc.shuffledSubarray(pool, { maxLength: 8 }), fc.array(entry, { minLength: 8, maxLength: 8 }));

type Draft = { id: string; type: string; props?: Record<string, string>; text?: string; children?: Draft[] };
function build([title, ids, entries]: [string, string[], { row: boolean; parent: number; label: string }[]], revision: number): LyraGenView {
  const root: Draft = { id: 'root', type: 'row', props: { title }, children: [] };
  const rows = [root];
  ids.forEach((id, index) => {
    const { row, parent, label } = entries[index]!;
    const node: Draft = row ? { id, type: 'row', props: { title: label }, children: [] } : { id, type: 'text', text: label };
    rows[parent % rows.length]!.children!.push(node);
    if (row) rows.push(node);
  });
  const result = validateView({ version: '1', catalog: { id: 'patch', version: '1' }, surfaceId: 'surface', revision, root }, catalog);
  assert.ok(result.ok, JSON.stringify(result.diagnostics));
  return result.value;
}

test('position-addressed JSON Patch round-trips random view revisions through identity-addressed patches', () => {
  fc.assert(fc.property(tree, tree, (before, after) => {
    const previous = build(before, 2);
    const next = build(after, 3);
    const operations = viewPatchToJsonPatch(previous, next);
    assert.ok(operations.ok);
    assert.ok(operations.value.length <= MAX_JSON_PATCH_OPERATIONS);
    const replayed = jsonPatchToViewPatch(previous, operations.value, catalog);
    assert.ok(replayed.ok, JSON.stringify(replayed.diagnostics));
    assert.deepEqual(replayed.value, next);
    const generic = applyJsonPatch(previous as unknown as JsonValue, operations.value);
    assert.ok(generic.ok);
    assert.deepEqual(generic.value, next);
  }), propertyRuns());
});

const paths = ['/root/children/0', '/root/children/1', '/root/children/-', '/root/children/0/children/0', '/root/children/0/children/-',
  '/root/props/title', '/root/children/0/props/title', '/root/children/1/text', '/revision', '/surfaceId', '/root'];
const operation = fc.oneof(
  fc.record({ op: fc.constantFrom('add', 'replace', 'test'), path: fc.constantFrom(...paths), value: fc.oneof(fc.string({ maxLength: 4 }), fc.constantFrom<JsonValue>(3, null),
    fc.constantFrom(...pool).map(id => ({ id: `x-${id}`, type: 'text', text: id }))) }),
  fc.record({ op: fc.constant('remove'), path: fc.constantFrom(...paths) }),
  fc.record({ op: fc.constantFrom('move', 'copy'), from: fc.constantFrom(...paths), path: fc.constantFrom(...paths) }),
);

test('random RFC 6902 operations either match generic application or fail closed with diagnostics', () => {
  fc.assert(fc.property(tree, fc.array(operation, { maxLength: 6 }), (shape, operations) => {
    const view = build(shape, 2);
    const result = jsonPatchToViewPatch(view, operations, catalog);
    if (!result.ok) { assert.ok(result.diagnostics.length > 0); return; }
    const generic = applyJsonPatch(view as unknown as JsonValue, operations);
    assert.ok(generic.ok);
    const expected = generic.value as unknown as LyraGenView;
    assert.deepEqual(result.value.root, expected.root as LyraGenNode);
    assert.equal(result.value.surfaceId, view.surfaceId);
    assert.ok(result.value.revision === view.revision || result.value.revision === view.revision + 1);
    assert.ok(validateView(result.value, catalog).ok);
  }), propertyRuns());
});
