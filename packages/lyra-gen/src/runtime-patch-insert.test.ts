import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyViewPatch, diffViews, validateView, type LyraGenPatch } from './runtime.js';
import type { LyraGenCatalog, LyraGenNode, LyraGenView } from './types.js';

const catalog: LyraGenCatalog = {
  id: 'test', version: '1',
  components: {
    board: { tag: 'div', properties: {}, children: ['card'] },
    card: { tag: 'section', properties: { title: { type: 'string', maxLength: 40 } }, children: ['text'] },
    text: { tag: 'span', properties: { value: { type: 'number', minimum: 0, maximum: 100 } }, text: true },
    slider: { tag: 'input', properties: { value: { type: 'number', minimum: 0, maximum: 500 }, label: { type: 'string' }, href: { type: 'string' } }, accessibleName: { required: true, properties: ['label'] }, bindings: { value: { event: 'input', property: 'value' } } },
    form: { tag: 'div', properties: {}, children: true }
  }
};
const card = (id: string, title = id): LyraGenNode => ({ id, type: 'card', props: { title } });
function base(): LyraGenView {
  const result = validateView({ version: '1', catalog: { id: 'test', version: '1' }, surfaceId: 's', revision: 1, root: { id: 'root', type: 'board', children: [card('a'), card('b')] } }, catalog);
  assert.equal(result.ok, true);
  return (result as { value: LyraGenView }).value;
}
const patch = (operations: LyraGenPatch['operations']): LyraGenPatch => ({ surfaceId: 's', expectedRevision: 1, operations });
const ids = (view: LyraGenView): string[] => view.root.children!.map(child => child.id);

test('insert appends, or places before/after an anchor, keeping sibling identities', () => {
  const current = base();
  const appended = applyViewPatch(current, patch([{ op: 'insert', parentId: 'root', node: card('c') }]), catalog);
  assert.equal(appended.ok, true);
  if (!appended.ok) return;
  assert.deepEqual(ids(appended.value), ['a', 'b', 'c']);
  assert.equal(appended.value.revision, 2);
  assert.equal(appended.value.root.children![0], current.root.children![0]);
  const placed = applyViewPatch(current, patch([
    { op: 'insert', parentId: 'root', node: card('x'), before: 'a' },
    { op: 'insert', parentId: 'root', node: card('y'), after: 'a' },
    { op: 'insert', parentId: 'root', node: card('z'), after: 'b' }
  ]), catalog);
  assert.equal(placed.ok, true);
  if (placed.ok) assert.deepEqual(ids(placed.value), ['x', 'a', 'y', 'b', 'z']);
  const nested = applyViewPatch(current, patch([{ op: 'insert', parentId: 'a', node: { id: 'n', type: 'text', text: 'New' } }, { op: 'replace', nodeId: 'b', node: card('b', 'Renamed') }]), catalog);
  assert.equal(nested.ok, true);
  if (nested.ok) assert.deepEqual(nested.value.root.children![0]!.children!.map(child => child.id), ['n']);
});

test('insert rejects bad shapes, existing identities, foreign anchors, overlaps and catalog violations', () => {
  const current = base();
  const codes = (operations: LyraGenPatch['operations']): string[] => {
    const result = applyViewPatch(current, patch(operations), catalog);
    assert.equal(result.ok, false, JSON.stringify(operations));
    return result.diagnostics.map(diagnostic => diagnostic.code);
  };
  assert.deepEqual(codes([{ op: 'insert', parentId: 'root', node: card('c'), before: 'a', after: 'b' }]), ['patch.invalid']);
  assert.deepEqual(codes([{ op: 'insert', parentId: 'root', node: card('c'), nodeId: 'x' } as never]), ['patch.invalid']);
  assert.deepEqual(codes([{ op: 'insert', parentId: 'missing', node: card('c') }]), ['identity.conflict']);
  assert.deepEqual(codes([{ op: 'insert', parentId: 'root', node: card('a') }]), ['identity.conflict']);
  assert.deepEqual(codes([{ op: 'insert', parentId: 'root', node: card('c') }, { op: 'insert', parentId: 'root', node: card('c') }]), ['identity.conflict']);
  assert.deepEqual(codes([{ op: 'insert', parentId: 'a', node: { id: 'n', type: 'text' }, before: 'b' }]), ['identity.conflict']);
  assert.deepEqual(codes([{ op: 'insert', parentId: 'root', node: card('c'), after: 'a' }, { op: 'remove', nodeId: 'a' }]), ['identity.conflict']);
  assert.deepEqual(codes([{ op: 'insert', parentId: 'a', node: { id: 'n', type: 'text' } }, { op: 'remove', nodeId: 'a' }]), ['identity.conflict']);
  assert.deepEqual(codes([{ op: 'insert', parentId: 'a', node: { id: 'n', type: 'text' } }, { op: 'replace', nodeId: 'root', node: { id: 'root', type: 'board' } }]), ['identity.conflict']);
  assert.ok(codes([{ op: 'insert', parentId: 'root', node: { id: 'n', type: 'text' } }]).includes('children.type'));
  assert.ok(codes([{ op: 'insert', parentId: 'root', node: { id: 'c', type: 'card', children: [{ id: 'a', type: 'text' }] } }]).includes('identity.duplicate'));
  assert.deepEqual(codes([{ op: 'insert', parentId: 'root', node: { id: 'c', type: 'lyra-gen:isolated' } }]), ['catalog.component']);
});

test('diffViews reports added, changed and removed ids in document order', () => {
  const current = base();
  const next = applyViewPatch(current, patch([
    { op: 'insert', parentId: 'root', node: { id: 'c', type: 'card', props: { title: 'c' }, children: [{ id: 'c-text', type: 'text', text: 'Hi' }] }, before: 'a' },
    { op: 'replace', nodeId: 'b', node: card('b', 'Renamed') }
  ]), catalog);
  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.deepEqual(diffViews(current, next.value), { added: ['c', 'c-text'], changed: ['b'], removed: [] });
  const removed = applyViewPatch(next.value, { surfaceId: 's', expectedRevision: 2, operations: [{ op: 'remove', nodeId: 'c' }] }, catalog);
  assert.equal(removed.ok, true);
  if (removed.ok) assert.deepEqual(diffViews(next.value, removed.value), { added: [], changed: [], removed: ['c', 'c-text'] });
  // Key order and a structurally equal replacement are not changes.
  const same = applyViewPatch(current, patch([{ op: 'replace', nodeId: 'a', node: { props: { title: 'a' }, type: 'card', id: 'a' } }]), catalog);
  assert.equal(same.ok, true);
  if (same.ok) assert.deepEqual(diffViews(current, same.value), { added: [], changed: [], removed: [] });
});

test('reads address owned state, declared non-URL properties and never conflict with a binding', () => {
  const view = (reads: unknown, extra: Record<string, unknown> = {}): unknown => ({ version: '1', catalog: { id: 'test', version: '1' }, surfaceId: 's', revision: 0,
    root: { id: 'root', type: 'form', children: [
      { id: 'limit', type: 'slider', props: { label: 'Limit', value: 10 }, bindings: { value: '/limit' } },
      { id: 'out', type: 'text', reads, ...extra }
    ] } });
  assert.equal(validateView(view({ value: '/limit' }), catalog).ok, true);
  const code = (reads: unknown, extra?: Record<string, unknown>): string | undefined => { const result = validateView(view(reads, extra), catalog); return result.ok ? undefined : result.diagnostics[0]!.code; };
  assert.equal(code([]), 'read.invalid');
  assert.equal(code({ invented: '/limit' }), 'read.unknown');
  assert.equal(code({ value: 3 }), 'read.unknown');
  assert.equal(code({ value: '' }), 'read.pointer');
  assert.equal(code({ value: 'limit' }), 'read.pointer');
  assert.equal(code({ value: '/other' }), 'read.unowned');
  const sink = validateView({ version: '1', catalog: { id: 'test', version: '1' }, surfaceId: 's', revision: 0, root: { id: 'root', type: 'form', children: [
    { id: 'a', type: 'slider', props: { label: 'A' }, bindings: { value: '/a' } },
    { id: 'b', type: 'slider', props: { label: 'B' }, reads: { href: '/a' } }
  ] } }, catalog);
  assert.equal(sink.ok, false);
  if (!sink.ok) assert.equal(sink.diagnostics[0]!.code, 'content.url-binding');
  const both = validateView({ version: '1', catalog: { id: 'test', version: '1' }, surfaceId: 's', revision: 0, root: { id: 'root', type: 'form', children: [
    { id: 'a', type: 'slider', props: { label: 'A' }, bindings: { value: '/a' } },
    { id: 'b', type: 'slider', props: { label: 'B' }, bindings: { value: '/b' }, reads: { value: '/a' } }
  ] } }, catalog);
  assert.equal(both.ok, false);
  if (!both.ok) assert.equal(both.diagnostics[0]!.code, 'read.conflict');
  // A read is component-local, so isolate mode contains it instead of rejecting the view.
  const isolated = validateView(view({ value: '/other' }), catalog, { recovery: 'isolate' });
  assert.equal(isolated.ok, true);
  if (isolated.ok) assert.deepEqual(isolated.isolated?.map(entry => entry.nodeId), ['out']);
});
