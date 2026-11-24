import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateView } from '../runtime.js';
import type { LyraGenCatalog, LyraGenView } from '../types.js';
import { applyJsonPatch, jsonPatchToScopedPatch, jsonPatchToViewPatch, parseJsonPatch, viewPatchToJsonPatch } from './json-patch.js';

const catalog: LyraGenCatalog = { id: 'patch', version: '1', components: {
  row: { tag: 'div', properties: { title: { type: 'string', maxLength: 40 } }, children: true },
  text: { tag: 'span', text: true, properties: {} },
} };
const admitted = (): LyraGenView => {
  const result = validateView({ version: '1', catalog: { id: 'patch', version: '1' }, surfaceId: 'surface', revision: 3, root: {
    id: 'root', type: 'row', props: { title: 'Board' }, children: [
      { id: 'a', type: 'text', text: 'A' },
      { id: 'b', type: 'row', props: { title: 'B' }, children: [{ id: 'b1', type: 'text', text: 'B1' }] },
      { id: 'c', type: 'text', text: 'C' },
    ] } }, catalog);
  assert.ok(result.ok);
  return result.value;
};

test('a property change becomes an identity-addressed replace and keeps untouched branches', () => {
  const view = admitted();
  const scoped = jsonPatchToScopedPatch(view, [{ op: 'replace', path: '/root/children/1/props/title', value: 'Renamed' }]);
  assert.ok(scoped.ok);
  assert.deepEqual(scoped.value?.operations.map(operation => [operation.op, 'nodeId' in operation ? operation.nodeId : operation.parentId]), [['replace', 'b']]);
  const next = jsonPatchToViewPatch(view, [{ op: 'replace', path: '/root/children/1/props/title', value: 'Renamed' }], catalog);
  assert.ok(next.ok);
  assert.equal(next.value.revision, 4);
  assert.equal(next.value.root.children![1]!.props!['title'], 'Renamed');
  assert.equal(next.value.root.children![0], view.root.children![0]);
  assert.equal(next.value.root.children![2], view.root.children![2]);
});

test('an added child becomes an anchored insert and a removed child a remove', () => {
  const view = admitted();
  const operations = [
    { op: 'add', path: '/root/children/1', value: { id: 'new', type: 'text', text: 'New' } },
    { op: 'add', path: '/root/children/-', value: { id: 'tail', type: 'text', text: 'Tail' } },
    { op: 'remove', path: '/root/children/3' },
  ];
  const scoped = jsonPatchToScopedPatch(view, operations);
  assert.ok(scoped.ok);
  assert.deepEqual(scoped.value?.operations, [
    { op: 'remove', nodeId: 'c' },
    { op: 'insert', parentId: 'root', node: { id: 'new', type: 'text', text: 'New' }, before: 'b' },
    { op: 'insert', parentId: 'root', node: { id: 'tail', type: 'text', text: 'Tail' } },
  ]);
  const next = jsonPatchToViewPatch(view, operations, catalog);
  assert.ok(next.ok);
  assert.deepEqual(next.value.root.children!.map(child => child.id), ['a', 'new', 'b', 'tail']);
});

test('move, copy and test follow RFC 6902; reordering replaces the parent', () => {
  const view = admitted();
  const moved = jsonPatchToViewPatch(view, [{ op: 'test', path: '/revision', value: 3 }, { op: 'move', from: '/root/children/0', path: '/root/children/-' }], catalog);
  assert.ok(moved.ok);
  assert.deepEqual(moved.value.root.children!.map(child => child.id), ['b', 'c', 'a']);
  const copied = jsonPatchToViewPatch(view, [{ op: 'copy', from: '/root/children/0', path: '/root/children/-' }, { op: 'replace', path: '/root/children/3/id', value: 'a2' }], catalog);
  assert.ok(copied.ok);
  assert.deepEqual(copied.value.root.children!.map(child => child.id), ['a', 'b', 'c', 'a2']);
  const duplicate = jsonPatchToViewPatch(view, [{ op: 'copy', from: '/root/children/0', path: '/root/children/-' }], catalog);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.diagnostics[0]?.code, 'identity.conflict');
  const failed = jsonPatchToViewPatch(view, [{ op: 'test', path: '/root/props/title', value: 'Other' }, { op: 'remove', path: '/root/children/0' }], catalog);
  assert.equal(failed.ok, false);
  assert.equal(failed.diagnostics[0]?.code, 'patch.test');
  const unchanged = jsonPatchToViewPatch(view, [{ op: 'test', path: '/surfaceId', value: 'surface' }], catalog);
  assert.ok(unchanged.ok);
  assert.equal(unchanged.value, view);
});

test('reserved members, prototype segments, unknown types and unbounded documents fail closed', () => {
  const view = admitted();
  const code = (operations: unknown): string | undefined => {
    const result = jsonPatchToViewPatch(view, operations, catalog);
    return result.ok ? undefined : result.diagnostics[0]?.code;
  };
  assert.equal(code([{ op: 'replace', path: '/surfaceId', value: 'other' }]), 'patch.reserved');
  assert.equal(code([{ op: 'replace', path: '/revision', value: 9 }]), 'revision.conflict');
  assert.equal(code([{ op: 'remove', path: '/root' }]), 'patch.reserved');
  assert.equal(code([{ op: 'replace', path: '', value: {} }]), 'patch.reserved');
  assert.equal(code([{ op: 'move', from: '/catalog', path: '/root/props/title' }]), 'patch.reserved');
  assert.equal(code([{ op: 'add', path: '/root/props/__proto__', value: 'x' }]), 'security.prototype');
  assert.equal(code([{ op: 'add', path: '/root/children/0/constructor', value: 'x' }]), 'security.prototype');
  assert.equal(code(JSON.parse('[{"op":"add","path":"/root/props/title","value":{"__proto__":1}}]')), 'json.key');
  assert.equal(code([{ op: 'replace', path: '/root/children/0/type', value: 'lyra-gen:isolated' }]), 'catalog.component');
  assert.equal(code([{ op: 'replace', path: '/root/children/0/type', value: 'script' }]) !== undefined, true);
  assert.equal(code([{ op: 'replace', path: '/root/id', value: 'other' }]), 'patch.root');
  assert.equal(code([{ op: 'remove', path: '/root/children/9' }]), 'patch.path');
  assert.equal(code([{ op: 'add', path: '/root/children/9', value: { id: 'x', type: 'text' } }]), 'patch.path');
  assert.equal(code([{ op: 'move', from: '/root/children/1', path: '/root/children/1/children/0' }]), 'patch.path');
  assert.equal(code([{ op: 'unknown', path: '/root' }]), 'patch.invalid');
  assert.equal(code(Array.from({ length: 129 }, () => ({ op: 'test', path: '/revision', value: 3 }))), 'patch.invalid');
  assert.equal(code([{ op: 'replace', path: '/root/props/title', value: 'x'.repeat(41) }]) !== undefined, true);
  assert.equal(jsonPatchToViewPatch(view, [{ op: 'copy', from: '/root', path: '/root/children/-' }], catalog, { limits: { maxBytes: 600 } }).ok, false);
});

test('copy amplification stays inside the byte budget', () => {
  const doublings = Array.from({ length: 64 }, () => ({ op: 'copy', from: '/a', path: '/a/-' }));
  const result = applyJsonPatch({ a: ['x'.repeat(64)] }, doublings, { maxBytes: 4096 });
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0]?.code, 'limit.bytes');
});

test('generic data patches are atomic and admit only defined members', () => {
  const result = applyJsonPatch({ items: [1, 2] }, [{ op: 'add', path: '/items/1', value: 9 }, { op: 'replace', path: '/flag', value: true, extra: 'ignored' }]);
  assert.equal(result.ok, false);
  const appended = applyJsonPatch({ items: [1] }, [{ op: 'add', path: '/items/-', value: 2 }]);
  assert.ok(appended.ok);
  assert.deepEqual(appended.value, { items: [1, 2] });
  const parsed = parseJsonPatch([{ op: 'remove', path: '/a', value: 1 }]);
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.value, [{ op: 'remove', path: '/a' }]);
  assert.equal(parseJsonPatch({ op: 'remove', path: '/a' }).ok, false);
  assert.equal(parseJsonPatch([{ op: 'add', path: 'relative', value: 1 }]).ok, false);
});

test('view changes become position-addressed RFC 6902 operations that round-trip', () => {
  const view = admitted();
  const next = jsonPatchToViewPatch(view, [
    { op: 'replace', path: '/root/props/title', value: 'Live' },
    { op: 'remove', path: '/root/children/0' },
    { op: 'add', path: '/root/children/0/children/-', value: { id: 'b2', type: 'text', text: 'B2' } },
  ], catalog);
  assert.ok(next.ok);
  const operations = viewPatchToJsonPatch(view, next.value);
  assert.ok(operations.ok);
  assert.deepEqual(operations.value, [
    { op: 'replace', path: '/root/props/title', value: 'Live' },
    { op: 'remove', path: '/root/children/0' },
    { op: 'add', path: '/root/children/0/children/1', value: { id: 'b2', type: 'text', text: 'B2' } },
    { op: 'replace', path: '/revision', value: 4 },
  ]);
  const replayed = jsonPatchToViewPatch(view, operations.value, catalog);
  assert.ok(replayed.ok);
  assert.deepEqual(replayed.value, next.value);
  assert.equal(viewPatchToJsonPatch(view, { ...view, surfaceId: 'other' }).ok, false);
  const same = viewPatchToJsonPatch(view, view);
  assert.ok(same.ok);
  assert.deepEqual(same.value, []);
});
