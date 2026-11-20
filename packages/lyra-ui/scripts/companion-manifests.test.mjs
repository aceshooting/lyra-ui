import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COMPANION_MANIFESTS, companionForTag, mergeManifests } from './companion-manifests.mjs';

test('names each companion element once, with a family and import path', () => {
  const tags = COMPANION_MANIFESTS.flatMap((companion) => companion.tags);
  assert.equal(new Set(tags).size, tags.length);
  for (const companion of COMPANION_MANIFESTS) {
    assert.match(companion.importPath, new RegExp(`^${companion.package}/`, 'u'));
    assert.match(companion.classImportPath, new RegExp(`^${companion.package}/`, 'u'));
    assert.ok(companion.family && companion.status && companion.since);
  }
  assert.equal(companionForTag('lr-gen-view')?.directory, 'lyra-gen');
  assert.equal(companionForTag('lr-button'), undefined);
});

test('merges companion modules after the base, under their package directory', () => {
  const merged = mergeManifests(
    { schemaVersion: '2.0.0', modules: [{ path: 'src/a.ts' }] },
    [{ directory: 'lyra-x', manifest: { modules: [{ path: 'src/b.ts' }] } }],
  );
  assert.deepEqual(merged.modules.map((module) => module.path), ['src/a.ts', 'lyra-x/src/b.ts']);
});
