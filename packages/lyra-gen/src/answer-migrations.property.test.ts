import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { migrateStoredAnswer } from './answer-migrations.js';
import type { LyraGenAnswerMigration } from './answer-migrations.js';
import { createSnapshot, createSurfaceState, setSurfaceState } from './runtime.js';
import type { LyraGenSnapshot } from './runtime.js';
import type { LyraGenCatalog, LyraGenView } from './types.js';

const catalog = (version: string): LyraGenCatalog => ({ id: 'answers', version, components: { input: { tag: 'input', properties: { value: { type: 'string' } }, bindings: { value: { event: 'input', property: 'value' } } } } });
const oldCatalog = catalog('1');
const middleCatalog = catalog('2');
const newCatalog = catalog('3');
const stored = (text = 'Edited'): LyraGenSnapshot => {
  const view: LyraGenView = { version: '1', catalog: { id: 'answers', version: '1' }, surfaceId: 'answer', revision: 7, root: { id: 'field', type: 'input', props: { value: 'Default' }, bindings: { value: '/value' } } };
  const edited = setSurfaceState(createSurfaceState(view), '/value', text);
  if (!edited.ok) throw new Error('Invalid test fixture.');
  return createSnapshot(view, edited.value);
};
const route = (from: string, to: string, migrate?: (input: LyraGenSnapshot) => unknown): LyraGenAnswerMigration => ({ from: { id: 'answers', version: from }, to: { id: 'answers', version: to }, migrate: migrate ?? (input => ({ ...input, view: { ...input.view, catalog: { id: 'answers', version: to } } })) });
const options = { catalogs: [oldCatalog, middleCatalog], migrations: [route('1', '2'), route('2', '3')], approve: () => true };

test('exact registered approved chains preserve the original and dirty state', () => {
  const source = JSON.parse(JSON.stringify(stored())) as LyraGenSnapshot;
  const before = JSON.stringify(source);
  const approvals: string[] = [];
  const result = migrateStoredAnswer(source, newCatalog, { ...options, approve: step => { approvals.push(`${step.from.version}:${step.to.version}`); return true; } });
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.deepEqual(approvals, ['1:2', '2:3']);
  assert.equal(JSON.stringify(source), before);
  assert.equal(JSON.stringify(result.value.original), before);
  assert.equal(result.value.snapshot.view.catalog.version, '3');
  assert.deepEqual(result.value.snapshot.state.dirty, ['/value']);
  assert.deepEqual(result.value.snapshot.state.values, { value: 'Edited' });
  assert.equal(Object.isFrozen(result.value.snapshot.state), true);
  assert.notEqual(result.value.original, source);
});

test('the retained original preserves admitted source data before restore normalization', () => {
  const source = stored();
  const duplicated = { ...source, state: { ...source.state, dirty: ['/value', '/value'] } };
  const result = migrateStoredAnswer(duplicated, newCatalog, options);
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.deepEqual(result.value.original.state.dirty, ['/value', '/value']);
  assert.deepEqual(result.value.snapshot.state.dirty, ['/value']);
});

test('unsupported, unapproved, ambiguous, cyclic and overlong migrations fail closed', () => {
  for (const override of [
    { catalogs: [], migrations: [] },
    { approve: undefined },
    { approve: () => false },
    { maxSteps: 1 },
    { maxSteps: Infinity },
    { migrations: [route('1', '2'), route('1', '3')] },
    { migrations: [route('1', '2'), route('2', '1')] },
    { migrations: [route('1', 'missing')] },
    { catalogs: [oldCatalog, catalog('1'), middleCatalog] },
  ]) assert.equal(migrateStoredAnswer(stored(), newCatalog, { ...options, ...override }).ok, false);
  const same = migrateStoredAnswer(stored(), oldCatalog, { catalogs: [], migrations: [] });
  assert.equal(same.ok, true); if (same.ok) assert.deepEqual(same.value.steps, []);
});

test('migrations revalidate complete snapshots and cannot erase edits or change identities', () => {
  const mutations: ((input: LyraGenSnapshot) => unknown)[] = [
    input => ({ ...input, view: { ...input.view, catalog: newCatalog, revision: 8 } }),
    input => ({ ...input, view: { ...input.view, catalog: { id: 'answers', version: '3' }, surfaceId: 'other' }, state: { ...input.state, surfaceId: 'other' } }),
    input => createSnapshot({ ...input.view, catalog: { id: 'answers', version: '3' }, root: { ...input.view.root, id: 'other' } }),
    input => ({ ...input, view: { ...input.view, catalog: { id: 'answers', version: '3' } }, state: { ...input.state, dirty: [] } }),
    input => ({ ...input, view: { ...input.view, catalog: { id: 'answers', version: '3' } }, state: { ...input.state, values: { value: 'Lost' } } }),
    input => ({ ...input, view: { ...input.view, catalog: { id: 'answers', version: '3' }, root: { ...input.view.root, props: { value: 42 } } } }),
    () => { throw new Error('Private transport detail.'); },
    input => ({ ...input, view: { ...input.view, catalog: { id: 'answers', version: '2' } } }),
  ];
  for (const migrate of mutations) assert.equal(migrateStoredAnswer(stored(), newCatalog, { ...options, migrations: [route('1', '3', migrate)] }).ok, false);
});

test('seeded stored answers retain arbitrary dirty text across approved catalog upgrades', () => {
  fc.assert(fc.property(fc.string({ maxLength: 256 }), text => {
    const source = stored(text);
    const result = migrateStoredAnswer(source, newCatalog, options);
    assert.equal(result.ok, true); if (!result.ok) return;
    assert.deepEqual(result.value.snapshot.state.values, { value: text });
    assert.deepEqual(result.value.snapshot.state.dirty, source.state.dirty);
    assert.equal(result.value.original.view.catalog.version, '1');
  }), { seed: 1729, numRuns: 200 });
});

test('host callbacks cannot change the captured migration ceiling or registered route metadata', () => {
  const mutableOptions = { ...options, maxSteps: 1, approve: () => { mutableOptions.maxSteps = 16; return true; } };
  const bounded = migrateStoredAnswer(stored(), newCatalog, mutableOptions);
  assert.equal(bounded.ok, false); if (!bounded.ok) assert.equal(bounded.diagnostics[0]?.code, 'answer.limit');
  const next = { from: { id: 'answers', version: '2' }, to: { id: 'answers', version: '3' }, migrate: (input: LyraGenSnapshot) => ({ ...input, view: { ...input.view, catalog: { id: 'answers', version: '3' } } }) };
  const result = migrateStoredAnswer(stored(), newCatalog, { ...options, migrations: [route('1', '2'), next], approve: () => { next.to.version = 'unregistered'; return true; } });
  assert.equal(result.ok, true); if (result.ok) assert.equal(result.value.snapshot.view.catalog.version, '3');
});
