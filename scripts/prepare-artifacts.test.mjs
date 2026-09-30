import assert from 'node:assert/strict';
import test from 'node:test';
import { assertGeneratedAddition, assertPreparationInputs, assertSourcePath } from './prepare-artifacts-paths.mjs';

const tracked = { kind: 'blob', mode: '100644' };

test('release preparation rejects publication capture and unknown modes', () => {
  assert.doesNotThrow(() => assertPreparationInputs());
  assert.doesNotThrow(() => assertPreparationInputs('source', '{"version":"24.1.0"}'));
  assert.doesNotThrow(() => assertPreparationInputs('release', ''));
  assert.throws(() => assertPreparationInputs('release', '{}'), /cannot capture a publication/u);
  assert.throws(() => assertPreparationInputs('relese', ''), /Unknown preparation mode/u);
});

test('only tracked pending Markdown changeset deletions pass in release mode', () => {
  const options = { mode: 'release', tracked, deleted: true };
  assert.doesNotThrow(() => assertSourcePath('.changeset/quiet-rivers.md', options));
  for (const invalid of [
    { ...options, mode: 'source' },
    { ...options, deleted: false },
    { ...options, tracked: undefined },
    { ...options, tracked: { kind: 'blob', mode: '120000' } },
    { ...options, tracked: { kind: 'tree', mode: '040000' } },
  ]) {
    assert.throws(() => assertSourcePath('.changeset/quiet-rivers.md', invalid), /Non-source path/u);
  }
  for (const file of [
    '.changeset/README.md', '.changeset/config.json', '.changeset/.hidden.md',
    '.changeset/nested/release.md', '.changeset/../release.md', '.changeset//release.md',
    '.github/workflows/release.yml', '.env',
  ]) {
    assert.throws(() => assertSourcePath(file, options), /Non-source path/u, file);
  }
  assert.throws(() => assertGeneratedAddition('.changeset/new-release.md'), /Unexpected generated addition/u);
});

test('generated source allowlists retain path, build-output and secret-file boundaries', () => {
  assert.doesNotThrow(() => assertGeneratedAddition('packages/lyra-ui/llms/components/lr-button.md'));
  assert.doesNotThrow(() => assertSourcePath('.claude-plugin/marketplace.json'));
  assert.doesNotThrow(() => assertSourcePath('packages/lyra-ui/package.json'));
  for (const file of [
    '/outside.md', '../outside.md', 'packages/lyra-ui/../../outside.md',
    'packages/lyra-ui/dist/button.js', 'packages/lyra-ui/node_modules/peer.js',
    'packages/lyra-ui/.private/token.json', 'packages/lyra-ui/release.key',
    'packages/lyra-ui/release.pem', 'packages/lyra-ui/build.log',
  ]) {
    assert.throws(() => assertSourcePath(file, { mode: 'release' }), /Non-source path/u, file);
  }
  assert.throws(() => assertGeneratedAddition('scripts/new-authored-script.mjs'), /Unexpected generated addition/u);
});
