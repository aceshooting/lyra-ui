import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyViewPatch, diffViews, validateView, type LyraGenPatch } from './runtime.js';
import { LYRA_GEN_ISOLATED_TYPE } from './isolation.js';
import type { LyraGenCatalog, LyraGenNode, LyraGenView } from './types.js';

const catalog: LyraGenCatalog = {
  id: 'test', version: '1',
  components: {
    board: { tag: 'div', properties: {}, children: ['card', 'group'] },
    group: { tag: 'div', properties: {}, children: ['card'] },
    card: { tag: 'section', properties: { title: { type: 'string', maxLength: 40 }, tone: { type: 'string', enum: ['calm', 'loud'] } }, children: ['text'] },
    text: { tag: 'span', properties: { value: { type: 'number', minimum: 0, maximum: 100 } }, text: true }
  }
};
const card = (id: string, children?: LyraGenNode[]): LyraGenNode => ({ id, type: 'card', props: { title: id }, ...(children ? { children } : {}) });
function base(): LyraGenView {
  const result = validateView({ version: '1', catalog: { id: 'test', version: '1' }, surfaceId: 's', revision: 1, root: { id: 'root', type: 'board', children: [card('a', [{ id: 'a1', type: 'text', text: 'One' }]), card('b'), { id: 'g', type: 'group', children: [card('c')] }] } }, catalog);
  assert.equal(result.ok, true);
  return (result as { value: LyraGenView }).value;
}
const patch = (operations: readonly unknown[]): LyraGenPatch => ({ surfaceId: 's', expectedRevision: 1, operations: operations as LyraGenPatch['operations'] });
const ids = (node: LyraGenNode | undefined): string[] => (node?.children ?? []).map(child => child.id);
const codes = (result: { readonly diagnostics: readonly { readonly code: string }[] }): string[] => result.diagnostics.map(item => item.code);

test('set assigns one property, keeps the node identity elsewhere and reports a changed node', () => {
  const current = base();
  const result = applyViewPatch(current, patch([{ op: 'set', nodeId: 'a', prop: 'title', value: 'Renamed' }, { op: 'set', nodeId: 'a', prop: 'tone', value: 'calm' }]), catalog);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const updated = result.value.root.children![0]!;
  assert.deepEqual(updated.props, { title: 'Renamed', tone: 'calm' });
  assert.equal(updated.children, current.root.children![0]!.children);
  assert.equal(result.value.root.children![1], current.root.children![1]);
  assert.equal(Object.isFrozen(updated.props), true);
  assert.deepEqual(diffViews(current, result.value), { added: [], changed: ['a'], removed: [] });
  // A node without props gains them.
  const text = applyViewPatch(current, patch([{ op: 'set', nodeId: 'a1', prop: 'value', value: 7 }]), catalog);
  assert.equal(text.ok, true);
  if (text.ok) assert.deepEqual(text.value.root.children![0]!.children![0]!.props, { value: 7 });
});

test('set goes through full validation and isolation like any patch', () => {
  const current = base();
  const invalid = applyViewPatch(current, patch([{ op: 'set', nodeId: 'a', prop: 'tone', value: 'shrill' }]), catalog);
  assert.equal(invalid.ok, false);
  assert.deepEqual(codes(invalid), ['schema.enum']);
  assert.deepEqual(codes(applyViewPatch(current, patch([{ op: 'set', nodeId: 'a', prop: 'unknown', value: 1 }]), catalog)), ['props.unknown']);
  const isolated = applyViewPatch(current, patch([{ op: 'set', nodeId: 'b', prop: 'tone', value: 'shrill' }]), catalog, { recovery: 'isolate' });
  assert.equal(isolated.ok, true);
  if (isolated.ok) {
    assert.equal(isolated.value.root.children![1]!.type, LYRA_GEN_ISOLATED_TYPE);
    assert.deepEqual(isolated.isolated?.map(entry => entry.nodeId), ['b']);
  }
  const reserved = applyViewPatch(current, patch([{ op: 'set', nodeId: 'a', prop: 'title', value: { type: LYRA_GEN_ISOLATED_TYPE } }]), catalog);
  assert.deepEqual(codes(reserved), ['catalog.component']);
});

test('set refuses malformed, unknown, repeated and overlapping targets', () => {
  const current = base();
  for (const operation of [{ op: 'set', nodeId: 'a', prop: 'title' }, { op: 'set', nodeId: 'a', value: 'x' }, { op: 'set', nodeId: 'a', prop: '__proto__', value: {} }, { op: 'set', nodeId: 'a', prop: 'title', value: 'x', extra: 1 }]) {
    assert.deepEqual(codes(applyViewPatch(current, patch([operation]), catalog)), ['patch.invalid'], JSON.stringify(operation));
  }
  assert.deepEqual(codes(applyViewPatch(current, patch([{ op: 'set', nodeId: 'missing', prop: 'title', value: 'x' }]), catalog)), ['identity.conflict']);
  assert.deepEqual(codes(applyViewPatch(current, patch([{ op: 'set', nodeId: 'a', prop: 'title', value: 'x' }, { op: 'set', nodeId: 'a', prop: 'title', value: 'y' }]), catalog)), ['identity.conflict']);
  assert.deepEqual(codes(applyViewPatch(current, patch([{ op: 'set', nodeId: 'a', prop: 'title', value: 'x' }, { op: 'remove', nodeId: 'a' }]), catalog)), ['identity.conflict']);
  assert.deepEqual(codes(applyViewPatch(current, patch([{ op: 'replace', nodeId: 'a', node: card('a') }, { op: 'set', nodeId: 'a1', prop: 'value', value: 1 }]), catalog)), ['identity.conflict']);
});

test('move relocates a subtree, positioned like an insert, keeping its identity', () => {
  const current = base();
  const moved = applyViewPatch(current, patch([{ op: 'move', nodeId: 'c', parentId: 'root', before: 'b' }]), catalog);
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  assert.deepEqual(ids(moved.value.root), ['a', 'c', 'b', 'g']);
  assert.deepEqual(ids(moved.value.root.children![3]), []);
  assert.equal(moved.value.root.children![1], current.root.children![2]!.children![0]);
  assert.equal(moved.value.root.children![0], current.root.children![0]);
  assert.deepEqual(diffViews(current, moved.value), { added: [], changed: [], removed: [] });
  // Reordering within one parent, appended moves in operation order, and a moved subtree carrying its children.
  const reordered = applyViewPatch(current, patch([{ op: 'move', nodeId: 'a', parentId: 'root', after: 'g' }, { op: 'move', nodeId: 'b', parentId: 'g' }, { op: 'insert', parentId: 'g', node: card('n') }]), catalog);
  assert.equal(reordered.ok, true);
  if (reordered.ok) {
    assert.deepEqual(ids(reordered.value.root), ['g', 'a']);
    assert.deepEqual(ids(reordered.value.root.children![0]), ['c', 'b', 'n']);
    assert.deepEqual(ids(reordered.value.root.children![1]), ['a1']);
  }
  const edited = applyViewPatch(current, patch([{ op: 'move', nodeId: 'a', parentId: 'g' }, { op: 'set', nodeId: 'a1', prop: 'value', value: 3 }]), catalog);
  assert.equal(edited.ok, true);
  if (edited.ok) assert.deepEqual(edited.value.root.children![1]!.children![1]!.children![0]!.props, { value: 3 });
});

test('move goes through full validation of the new parent', () => {
  const current = base();
  const result = applyViewPatch(current, patch([{ op: 'move', nodeId: 'a1', parentId: 'root' }]), catalog);
  assert.deepEqual(codes(result), ['children.type']);
  const isolated = applyViewPatch(current, patch([{ op: 'move', nodeId: 'a1', parentId: 'root' }]), catalog, { recovery: 'isolate' });
  assert.equal(isolated.ok, true);
  if (isolated.ok) assert.deepEqual(isolated.isolated?.map(entry => entry.nodeId), ['a1']);
});

test('move refuses the root, cycles, unknown nodes, stale anchors and overlaps', () => {
  const current = base();
  const refused = (operations: readonly unknown[]): string[] => codes(applyViewPatch(current, patch(operations), catalog));
  assert.deepEqual(refused([{ op: 'move', nodeId: 'root', parentId: 'g' }]), ['patch.root']);
  assert.deepEqual(refused([{ op: 'move', nodeId: 'a', parentId: 'root', before: 'b', after: 'g' }]), ['patch.invalid']);
  assert.deepEqual(refused([{ op: 'move', nodeId: 'a' }]), ['patch.invalid']);
  assert.deepEqual(refused([{ op: 'move', nodeId: 'missing', parentId: 'root' }]), ['identity.conflict']);
  assert.deepEqual(refused([{ op: 'move', nodeId: 'a', parentId: 'missing' }]), ['identity.conflict']);
  assert.deepEqual(refused([{ op: 'move', nodeId: 'a', parentId: 'root' }, { op: 'move', nodeId: 'a', parentId: 'g' }]), ['identity.conflict']);
  assert.deepEqual(refused([{ op: 'move', nodeId: 'a', parentId: 'g', before: 'b' }]), ['identity.conflict']);
  assert.deepEqual(refused([{ op: 'move', nodeId: 'a', parentId: 'root', before: 'a' }]), ['identity.conflict']);
  assert.deepEqual(refused([{ op: 'move', nodeId: 'a', parentId: 'a1' }]), ['identity.conflict']);
  assert.deepEqual(refused([{ op: 'move', nodeId: 'g', parentId: 'c' }]), ['identity.conflict']);
  assert.deepEqual(refused([{ op: 'move', nodeId: 'a', parentId: 'c' }, { op: 'move', nodeId: 'g', parentId: 'a1' }]), ['identity.conflict']);
  assert.deepEqual(refused([{ op: 'move', nodeId: 'a', parentId: 'g' }, { op: 'remove', nodeId: 'a' }]), ['identity.conflict']);
  assert.deepEqual(refused([{ op: 'move', nodeId: 'c', parentId: 'root' }, { op: 'remove', nodeId: 'g' }]), ['identity.conflict']);
  assert.deepEqual(refused([{ op: 'move', nodeId: 'b', parentId: 'g' }, { op: 'remove', nodeId: 'g' }]), ['identity.conflict']);
  assert.deepEqual(refused([{ op: 'move', nodeId: 'b', parentId: 'g' }, { op: 'insert', parentId: 'root', node: card('n'), after: 'b' }]), ['identity.conflict']);
  assert.deepEqual(refused([{ op: 'move', nodeId: 'a', parentId: 'root', after: 'b' }, { op: 'move', nodeId: 'b', parentId: 'g' }]), ['identity.conflict']);
  assert.deepEqual(refused([{ op: 'move', nodeId: 'a', parentId: 'root', after: 'b' }, { op: 'remove', nodeId: 'b' }]), ['identity.conflict']);
});
