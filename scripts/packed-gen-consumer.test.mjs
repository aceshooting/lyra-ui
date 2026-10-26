import assert from 'node:assert/strict';
import test from 'node:test';
import { genTypedEntrypoints, REQUIRED_GEN_FILES, validatePackedGenManifest } from './packed-gen-consumer.mjs';

const manifest = () => ({
  name: '@aceshooting/lyra-gen', type: 'module', license: 'MIT',
  peerDependencies: { '@aceshooting/lyra-ui': '^30.2.0' },
  sideEffects: ['./dist/gen-view.js', './dist/dashboard-binding.js'],
  exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' }, './*.js': { types: './dist/*.d.ts', default: './dist/*.js' }, './package.json': './package.json' },
});
const files = [...REQUIRED_GEN_FILES, 'dist/runtime.js', 'dist/runtime.d.ts', 'dist/adapters/a2ui.js', 'dist/adapters/a2ui.d.ts', 'dist/dashboard-binding.js', 'dist/dashboard-binding.d.ts'];
test('every wildcard module, including nested adapters, receives a concrete typed entrypoint', () => {
  const entries = validatePackedGenManifest(manifest(), files, '30.2.0');
  assert.ok(entries.includes('./runtime.js'));
  assert.ok(entries.includes('./adapters/a2ui.js'));
  assert.ok(!entries.some(entry => entry.includes('*')));
  assert.equal(entries.length, new Set(entries).size);
});
test('packing rejects leaked workspace ranges, missing docs/types, fixtures and erased side effects', () => {
  assert.throws(() => validatePackedGenManifest({ ...manifest(), dependencies: { lit: 'workspace:*' } }, files, '30.2.0'), /workspace/u);
  assert.throws(() => validatePackedGenManifest(manifest(), files.filter(file => file !== 'CHANGELOG.md'), '30.2.0'), /CHANGELOG/u);
  assert.throws(() => validatePackedGenManifest(manifest(), [...files, 'dist/runtime.test.js'], '30.2.0'), /development/u);
  assert.throws(() => validatePackedGenManifest(manifest(), [...files, 'examples/fixtures/private-case.json'], '30.2.0'), /unreviewed fixture/u);
  assert.throws(() => validatePackedGenManifest({ ...manifest(), sideEffects: [] }, files, '30.2.0'));
  assert.throws(() => genTypedEntrypoints(manifest(), files.filter(file => file !== 'dist/adapters/a2ui.d.ts')), /declaration/u);
  assert.throws(() => validatePackedGenManifest(manifest(), files, '31.0.0'), /peer/u);
});

test('the archive retains host guides and runnable examples', () => {
  for (const required of [
    'docs/approval.md', 'docs/rendering.md', 'docs/stored-answer-migrations.md',
    'docs/recovery-and-diagnostics.md', 'docs/threat-matrix.md',
    'docs/navigation.md', 'examples/navigation.ts',
    'docs/server-transport.md', 'examples/server-transport.mjs',
    'examples/recordings/chat-review.v1.json', 'examples/saved-dashboard/README.md',
  ]) {
    assert.throws(() => validatePackedGenManifest(manifest(), files.filter(file => file !== required), '30.2.0'), error => error instanceof Error && error.message.includes(required));
  }
});
