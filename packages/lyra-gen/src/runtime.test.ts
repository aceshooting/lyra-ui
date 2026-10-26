import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyViewPatch, createAction, createSnapshot, createSurfaceState, reconcileSurfaceState, restoreSnapshot, setSurfaceState, validateView } from './runtime.js';
import type { LyraGenCatalog, LyraGenView } from './types.js';

const catalog: LyraGenCatalog = {
  id: 'test', version: '1',
  components: {
    row: { tag: 'div', properties: {}, children: true },
    text: { tag: 'span', properties: {}, text: true },
    input: { tag: 'input', properties: { value: { type: 'string' }, label: { type: 'string' } }, accessibleName: { required: true, properties: ['label'] }, bindings: { value: { event: 'input', property: 'value' } } },
    button: { tag: 'button', properties: {}, text: true, events: ['click'] }
  },
  actions: { save: { payload: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } } }
};
function view(): LyraGenView {
  return { version: '1', catalog: { id: 'test', version: '1' }, surfaceId: 'surface', revision: 0,
    root: { id: 'root', type: 'row', children: [
      { id: 'field', type: 'input', props: { label: 'Title', value: 'Original' }, bindings: { value: '/title' } },
      { id: 'label', type: 'text', text: 'Original label' },
      { id: 'save', type: 'button', text: 'Save', action: { name: 'save' } }
    ] } };
}

test('validation copies, freezes, enforces identity, catalog, slots and structured props', () => {
  const source = view();
  const result = validateView(source, catalog);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.notEqual(result.value, source);
  assert.equal(Object.isFrozen(result.value.root.children), true);
  for (const bad of [
    { ...source, revision: -1 },
    { ...source, catalog: { id: 'test', version: '2' } },
    { ...source, root: { ...source.root, children: [...source.root.children!, source.root.children![0]] } },
    { ...source, root: { id: 'root', type: 'input', props: { label: 'X', value: 42 } } },
    { ...source, root: { id: 'root', type: 'text', slot: 'invented' } },
    { ...source, root: { id: 'root', type: 'row', props: JSON.parse('{"__proto__":1}') } }
  ]) assert.equal(validateView(bad, catalog).ok, false);
});

test('atomic patches retain untouched references and reject stale, duplicate, nested and invalid targets', () => {
  const initial = validateView(view(), catalog);
  assert.equal(initial.ok, true); if (!initial.ok) return;
  const patch = { surfaceId: 'surface', expectedRevision: 0, operations: [{ op: 'replace' as const, nodeId: 'label', node: { id: 'label', type: 'text', text: 'New label' } }] };
  const result = applyViewPatch(initial.value, patch, catalog);
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.value.revision, 1);
  assert.equal(result.value.root.children![0], initial.value.root.children![0]);
  assert.notEqual(result.value.root, initial.value.root);
  assert.equal(applyViewPatch(result.value, patch, catalog).ok, false);
  assert.equal(applyViewPatch(initial.value, { ...patch, operations: [...patch.operations, ...patch.operations] }, catalog).ok, false);
  assert.equal(applyViewPatch(initial.value, { ...patch, operations: [{ op: 'replace', nodeId: 'root', node: initial.value.root }, ...patch.operations] }, catalog).ok, false);
  assert.equal(applyViewPatch(initial.value, { ...patch, operations: [{ op: 'remove', nodeId: 'root' }] }, catalog).ok, false);
  assert.equal(applyViewPatch(initial.value, { ...patch, operations: [{ op: 'replace', nodeId: 'label', node: { id: 'label', type: 'unknown' } }] }, catalog).ok, false);
  assert.equal(initial.value.revision, 0);
});

test('dirty owned fields survive follow-ups, deleted fields disappear and snapshots restore', () => {
  const initial = view();
  const state = createSurfaceState(initial, { title: 'Host', hidden: 'secret' });
  assert.deepEqual(state.values, { title: 'Host' });
  const sibling = applyViewPatch(initial, { surfaceId: 'surface', expectedRevision: 0, operations: [{ op: 'replace', nodeId: 'label', node: { id: 'label', type: 'text', text: 'Follow-up' } }] }, catalog);
  assert.equal(sibling.ok, true);
  if (sibling.ok) {
    const retained = reconcileSurfaceState(state, initial, sibling.value);
    assert.equal(retained.ok, true);
    if (retained.ok) assert.deepEqual(retained.value.values, { title: 'Host' });
  }
  const edited = setSurfaceState(state, '/title', 'User edit');
  assert.equal(edited.ok, true); if (!edited.ok) return;
  assert.equal(setSurfaceState(state, '/hidden', 'Unauthorized').ok, false);
  const patched = applyViewPatch(initial, { surfaceId: 'surface', expectedRevision: 0, operations: [{ op: 'replace', nodeId: 'field', node: { ...initial.root.children![0]!, props: { label: 'Renamed', value: 'Model overwrite' } } }] }, catalog);
  assert.equal(patched.ok, true); if (!patched.ok) return;
  const reconciled = reconcileSurfaceState(edited.value, initial, patched.value);
  assert.equal(reconciled.ok, true); if (!reconciled.ok) return;
  assert.deepEqual(reconciled.value.values, { title: 'User edit' });
  const restored = restoreSnapshot(JSON.parse(JSON.stringify(createSnapshot(patched.value, reconciled.value))), catalog);
  assert.equal(restored.ok, true);
  const invalid = { ...createSnapshot(patched.value, reconciled.value), state: { ...reconciled.value, values: { title: 'User edit', secret: 1 } } };
  assert.equal(restoreSnapshot(invalid, catalog).ok, false);
  assert.equal(restoreSnapshot({ ...invalid, state: { ...reconciled.value, values: { title: 12 } } }, catalog).ok, false);
  const removed = applyViewPatch(patched.value, { surfaceId: 'surface', expectedRevision: 1, operations: [{ op: 'remove', nodeId: 'field' }] }, catalog);
  assert.equal(removed.ok, true); if (!removed.ok) return;
  const dropped = reconcileSurfaceState(reconciled.value, patched.value, removed.value);
  assert.equal(dropped.ok, true); if (dropped.ok) assert.deepEqual(dropped.value.values, {});
});

test('action contexts carry current identity and validate authorized payloads', () => {
  assert.equal(createAction(view(), 'save', catalog, { title: 'Title' }).ok, true);
  assert.equal(createAction(view(), 'save', catalog, { title: 12 }).ok, false);
  assert.equal(createAction(view(), 'save', catalog, null).ok, false);
  assert.equal(createAction(view(), 'field', catalog).ok, false);
  const action = createAction(view(), 'save', catalog, { title: 'Title' });
  if (action.ok) assert.deepEqual(action.value, { surfaceId: 'surface', nodeId: 'save', revision: 0, name: 'save', payload: { title: 'Title' } });
});

test('nested forms reject and diagnostic ceilings cannot conceal terminal authority failures', () => {
  const withForm: LyraGenCatalog = { ...catalog, components: { ...catalog.components, form: { tag: 'form', properties: {}, children: true } } };
  assert.equal(validateView({ ...view(), root: { id: 'outer', type: 'form', children: [{ id: 'inner', type: 'form' }] } }, withForm).ok, false);
  const result = validateView({ ...view(), root: { id: 'root', type: 'row', children: [
    { id: 'unnamed', type: 'input', props: { value: 12 } },
    { id: 'forbidden', type: 'unknown' }
  ] } }, catalog, { limits: { maxDiagnostics: 1 } });
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0]?.code, 'catalog.component');
});
