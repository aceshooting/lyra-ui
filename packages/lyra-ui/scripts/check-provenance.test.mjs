import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectTrackedTextFiles,
  findProvenanceFindings,
  isTrackedTextPath,
} from './check-provenance.mjs';

function labels(file, source) {
  return findProvenanceFindings({ file, source }).map((finding) => finding.label);
}

test('detects internal identifiers, tooling references, and process labels in tracked contexts', () => {
  assert.deepEqual(labels('packages/lyra-ui/src/example.ts', '// Keep fr_abcdefghijklmnopqrstuv pending.'), [
    'internal issue reference',
  ]);
  assert.deepEqual(labels('packages/lyra-ui/src/example.ts', "const locale = 'fr_FR';"), []);
  assert.deepEqual(labels('notes.md', 'See docs/superpowers/plans/widget.md.'), [
    'local-only tooling reference',
  ]);
  assert.deepEqual(labels('notes.md', 'The earlier audit finding required this workaround.'), [
    'internal audit or review process',
  ]);
  assert.deepEqual(labels('.changeset/example.md', 'Complete the full-library review sweep.'), [
    'internal audit or review process',
  ]);

  for (const value of ['Task C137', 'Family B31', 'Tier 2', 'Batch 60', 'Round 4']) {
    assert.deepEqual(labels('packages/lyra-ui/src/example.test.ts', `// ${value}: verified.`), [
      'internal work label',
    ], value);
  }
});

test('detects explanatory commit provenance without treating every digest as prose', () => {
  assert.deepEqual(
    labels('packages/lyra-ui/src/example.ts', '// This was corrected in 4ddf1fbd.'),
    ['explanatory commit provenance'],
  );
  assert.deepEqual(
    labels('docs/example.md', 'The regression introduced by `31ab9e7` required the fallback.'),
    ['explanatory commit provenance'],
  );

  for (const [file, source] of [
    ['packages/lyra-ui/CHANGELOG.md', '- 4ddf1fbd: Correct breakpoint handling.'],
    ['docs/component-quality.md', '- Capture source commit: f9998fd0a9180ca8f641ba9ca871b71d29d3f4fc'],
    ['packages/lyra-flags/THIRD_PARTY_NOTICES.md', '- Commit: `8998f5dd683424a73e2314a8c1f1e359c19e8742` (2025-09-12)'],
    ['packages/lyra-ui/scripts/fixtures/upstream-tags.json', '  "commit": "8998f5dd683424a73e2314a8c1f1e359c19e8742"'],
    ['packages/lyra-ui/scripts/fixtures/example.json', '  "sha256": "31ab9e7c4b7d2dac49d7e6af509af63a71f0b45a"'],
    ['.github/workflows/ci.yml', 'uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7'],
  ]) {
    assert.deepEqual(labels(file, source), [], `${file}: ${source}`);
  }
});

test('detects realistic personal paths while allowing portable and explicit example paths', () => {
  for (const value of [
    '/Users/alexandra-morrison/Projects/lyra-ui/index.ts',
    '/home/jane.doe/work/lyra-ui/index.ts',
    String.raw`C:\Users\Jane.Doe\Projects\lyra-ui\index.ts`,
    '/mnt/00000000-0000-4000-8000-000000000000/git/lyra-ui/index.ts',
  ]) {
    assert.deepEqual(labels('packages/lyra-ui/src/example.stories.ts', value), [
      'personal local filesystem path',
    ], value);
  }

  for (const value of [
    '/Users/example/project/index.ts',
    '/home/node/app/index.js',
    '/tmp/lyra-ui/index.ts',
    '/workspace/lyra-ui/index.ts',
  ]) {
    assert.deepEqual(labels('packages/lyra-ui/src/example.stories.ts', value), [], value);
  }
});

test('permits ordinary product vocabulary, release review prose, and decorative section marks', () => {
  const source = [
    'Run a human review pass before release.',
    'The release review covers the public API.',
    'A task queue belongs to the agent-tools family.',
    'The size tier applies to every control in the batch progress view.',
    'The archive reader performs a byte-for-byte round trip.',
    "icon: html`<span>§</span>`,",
  ].join('\n');
  assert.deepEqual(labels('packages/lyra-ui/src/example.test.ts', source), []);
  assert.deepEqual(labels('packages/lyra-ui/src/example.test.ts', '// Follow §3.4 of the plan.'), [
    'internal section reference',
  ]);
});

test('discovers only tracked textual files and excludes the policy fixtures themselves', () => {
  assert.equal(isTrackedTextPath('packages/lyra-ui/src/example.ts'), true);
  assert.equal(isTrackedTextPath('packages/lyra-ui/visual-baselines/example.png'), false);
  assert.equal(isTrackedTextPath('packages/lyra-ui/custom-elements.json'), false);
  assert.equal(isTrackedTextPath('packages/lyra-ui/llms/components/lr-example.md'), false);
  assert.equal(isTrackedTextPath('packages/lyra-ui/scripts/check-provenance.test.mjs'), false);
  assert.deepEqual(
    collectTrackedTextFiles({
      root: process.cwd(),
      listTracked: () => [
        'packages/lyra-ui/src/example.ts',
        'packages/lyra-ui/visual-baselines/example.png',
        'packages/lyra-ui/scripts/check-provenance.mjs',
      ].join('\0'),
    }),
    [],
    'the injected paths do not exist under the fixture root and are filtered safely',
  );
});
