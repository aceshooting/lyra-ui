import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSurfaceState, reconcileSurfaceState, validateView } from './runtime.js';
import type { JsonValue, LyraGenCatalog, LyraGenNode, LyraGenView } from './types.js';

const catalog: LyraGenCatalog = {
  id: 'bindings', version: '1',
  components: {
    row: { tag: 'div', properties: {}, children: true },
    input: { tag: 'input', properties: { value: { type: 'string' }, label: { type: 'string' } }, accessibleName: { required: true, properties: ['label'] }, bindings: { value: { event: 'input', property: 'value' } } }
  }
};
const field = (id: string, pointer: string, value = id): LyraGenNode => ({ id, type: 'input', props: { label: id, value }, bindings: { value: pointer } });
const view = (children: LyraGenNode[], revision = 0): LyraGenView => ({ version: '1', catalog: { id: 'bindings', version: '1' }, surfaceId: 'surface', revision, root: { id: 'root', type: 'row', children } });
const codes = (children: LyraGenNode[]): string[] => {
  const result = validateView(view(children), catalog);
  return result.ok ? [] : result.diagnostics.map(diagnostic => diagnostic.code);
};
const deepFrozen = (value: unknown): boolean => value === null || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value).every(deepFrozen));

test('binding ownership accepts many disjoint paths and names each overlap kind', () => {
  const many = Array.from({ length: 600 }, (_, index) => field(`f${index}`, `/group${index % 7}/item${index}`));
  assert.deepEqual(codes(many), []);
  assert.deepEqual(codes([field('a', '/x/y'), field('b', '/x/y')]), ['identity.binding']);
  assert.deepEqual(codes([field('a', '/x'), field('b', '/x/y/z')]), ['identity.binding']);
  assert.deepEqual(codes([field('a', '/x/y/z'), field('b', '/x')]), ['identity.binding']);
  assert.deepEqual(codes([field('a', '/x/y'), field('b', '/x/yy'), field('c', '/xy')]), []);
  assert.deepEqual(codes([...many, field('late', '/group3')]), ['identity.binding']);
  assert.deepEqual(codes([...many, field('deep', '/group3/item3/nested')]), ['identity.binding']);
});

test('state creation and reconciliation write many nested paths into deeply frozen values', () => {
  const children = Array.from({ length: 300 }, (_, index) => field(`f${index}`, `/rows/${index}/name`));
  children.push(field('shared', '/meta/title', 'Title'));
  const first = validateView(view(children), catalog);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const state = createSurfaceState(first.value, { meta: { title: 'Supplied' } } as JsonValue);
  assert.equal(deepFrozen(state.values), true);
  const values = state.values as { rows: Record<string, { name: string }>; meta: { title: string } };
  assert.equal(Object.keys(values.rows).length, 300);
  assert.equal(values.rows['299']!.name, 'f299');
  assert.equal(values.meta.title, 'Supplied');
  const next = validateView(view([...children.slice(0, 299), field('f299', '/rows/299/name', 'Changed default'), children[300]!], 1), catalog);
  assert.equal(next.ok, true);
  if (!next.ok) return;
  const reconciled = reconcileSurfaceState({ ...state, dirty: ['/rows/0/name'] }, first.value, next.value);
  assert.equal(reconciled.ok, true);
  if (!reconciled.ok) return;
  assert.equal(deepFrozen(reconciled.value.values), true);
  const kept = reconciled.value.values as { rows: Record<string, { name: string }>; meta: { title: string } };
  assert.equal(kept.rows['0']!.name, 'f0');
  assert.equal(kept.rows['299']!.name, 'Changed default');
  assert.equal(kept.meta.title, 'Supplied');
  assert.deepEqual(reconciled.value.dirty, ['/rows/0/name']);
});
