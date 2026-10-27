import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { BOUNDARY_DIAGNOSTIC_CODES, classifyDiagnostic, ISOLATABLE_DIAGNOSTIC_CODES, ISOLATABLE_SCHEMA_CODES, LYRA_GEN_ISOLATED_TYPE } from './isolation.js';
import { createAction, createSurfaceState, validateView } from './runtime.js';
import type { LyraGenNode, LyraGenView } from './types.js';
import { isolationCatalog as catalog } from '../test/fixtures/isolation/catalog.js';

const corpusDirectory = join(dirname(fileURLToPath(import.meta.url)), '../../test/fixtures/isolation/v1');
interface Case { readonly name: string; readonly file: string; readonly strict: 'accept' | 'reject'; readonly isolate: 'accept' | 'isolated' | 'reject'; readonly isolatedIds: readonly string[]; readonly code: string | null }
const manifest = JSON.parse(readFileSync(join(corpusDirectory, 'manifest.json'), 'utf8')) as { readonly version: number; readonly cases: readonly Case[] };
const load = (file: string): LyraGenView => JSON.parse(readFileSync(join(corpusDirectory, file), 'utf8')) as LyraGenView;
const find = (node: LyraGenNode, id: string): LyraGenNode | undefined => { if (node.id === id) return node; for (const child of node.children ?? []) { const hit = find(child, id); if (hit) return hit; } return undefined; };

test('classifier: isolatable codes are explicit, schema codes only under props, everything else is boundary', () => {
  for (const code of ISOLATABLE_DIAGNOSTIC_CODES) assert.equal(classifyDiagnostic(code), 'isolatable', code);
  for (const code of ISOLATABLE_SCHEMA_CODES) { assert.equal(classifyDiagnostic(code, '/props/x'), 'isolatable', code); assert.equal(classifyDiagnostic(code, '/action/payload/x'), 'boundary', code); assert.equal(classifyDiagnostic(code), 'boundary', code); }
  for (const code of BOUNDARY_DIAGNOSTIC_CODES) assert.equal(classifyDiagnostic(code, '/props/x'), 'boundary', code);
  assert.equal(classifyDiagnostic('something.unheard-of', '/props/x'), 'boundary');
  assert.equal(classifyDiagnostic('block.expansion'), 'boundary');
  assert.equal(classifyDiagnostic('block.invalid'), 'isolatable');
  assert.equal(LYRA_GEN_ISOLATED_TYPE, 'lyra-gen:isolated');
});

test('fault corpus v1 is versioned, unique and covers every explicit isolatable code', () => {
  assert.equal(manifest.version, 1);
  assert.equal(new Set(manifest.cases.map(entry => entry.name)).size, manifest.cases.length);
  const covered = new Set(manifest.cases.filter(entry => entry.isolate === 'isolated').map(entry => entry.code));
  for (const code of ISOLATABLE_DIAGNOSTIC_CODES.filter(code => !code.startsWith('block.'))) assert.ok(covered.has(code), `corpus lacks ${code}`);
  assert.ok(covered.has('schema.type') && covered.has('schema.enum'));
});

for (const entry of manifest.cases) {
  test(`fault corpus v1: ${entry.name}`, () => {
    const view = load(entry.file);
    const strict = validateView(view, catalog);
    assert.equal(strict.ok, entry.strict === 'accept');
    if (!strict.ok && entry.code) assert.ok(strict.diagnostics.some(diagnostic => diagnostic.code === entry.code), `strict reports ${entry.code}`);
    const isolate = validateView(view, catalog, { recovery: 'isolate' });
    if (entry.isolate === 'reject') {
      assert.equal(isolate.ok, false);
      assert.deepEqual(isolate.diagnostics, strict.diagnostics, 'boundary rejection is identical to strict');
      return;
    }
    assert.equal(isolate.ok, true); if (!isolate.ok) return;
    if (entry.isolate === 'accept') { assert.deepEqual(isolate, strict); assert.equal(isolate.isolated, undefined); return; }
    assert.deepEqual(isolate.isolated!.map(item => item.nodeId), entry.isolatedIds);
    assert.ok(isolate.diagnostics.length > 0 && isolate.diagnostics.every(diagnostic => diagnostic.severity === 'warning'));
    assert.deepEqual(isolate.diagnostics.map(diagnostic => diagnostic.code), isolate.isolated!.flatMap(item => item.diagnostics.map(diagnostic => diagnostic.code)));
    assert.ok(isolate.isolated!.every(item => item.diagnostics.every(diagnostic => diagnostic.severity === 'error')));
    for (const item of isolate.isolated!) {
      const node: LyraGenNode | undefined = find(isolate.value.root, item.nodeId);
      assert.deepEqual(node, { id: item.nodeId, type: LYRA_GEN_ISOLATED_TYPE });
      assert.ok(Object.isFrozen(node));
      assert.equal(item.path.startsWith('/root/children/'), true);
    }
    // Only the isolated nodes differ: every other id survives unchanged.
    const ids = (node: LyraGenNode): string[] => [node.id, ...(node.children ?? []).flatMap(ids)];
    const kept = new Set(ids(isolate.value.root));
    for (const id of ids(view.root)) assert.equal(kept.has(id) || entry.isolatedIds.some(isolated => isolated === id) || !!find(view.root, id), true);
    assert.ok(entry.isolatedIds.every(id => kept.has(id)));
  });
}

test('state and actions: surviving siblings keep owners and actions, isolated ones are dropped', () => {
  const entry = manifest.cases.find(item => item.name === 'sibling-state-survives')!;
  const result = validateView(load(entry.file), catalog, { recovery: 'isolate' });
  assert.equal(result.ok, true); if (!result.ok) return;
  const state = createSurfaceState(result.value);
  assert.deepEqual(Object.keys(state.owners), ['/keep']);
  assert.equal(createAction(result.value, 'btn', catalog).ok, true);
  const dropped = validateView(load('isolated-action-dropped.json'), catalog, { recovery: 'isolate' });
  assert.equal(dropped.ok, true); if (!dropped.ok) return;
  assert.equal(createAction(dropped.value, 'bad', catalog).ok, false);
  assert.equal(Object.isFrozen(dropped.value.root), true);
});

test('isolated results can be re-validated as returned, but never as serialized input', () => {
  const result = validateView(load('unknown-component.json'), catalog, { recovery: 'isolate' });
  assert.equal(result.ok, true); if (!result.ok) return;
  const again = validateView(result.value, catalog);
  assert.equal(again.ok, true);
  assert.deepEqual(again.ok && again.isolated?.map(item => item.nodeId), ['bad']);
  assert.equal(validateView(JSON.parse(JSON.stringify(result.value)), catalog, { recovery: 'isolate' }).ok, false);
});
