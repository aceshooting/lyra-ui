import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkDocVersionReferences } from './check-doc-version-references.mjs';

test('rejects a new-in stamp for a version absent from the changelog', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-doc-versions-'));
  try {
    mkdirSync(path.join(root, 'llms'));
    writeFileSync(path.join(root, 'CHANGELOG.md'), '# Changelog\n\n## 12.0.0\n\nReleased.\n');
    writeFileSync(
      path.join(root, 'llms', 'forms.md'),
      'The `future` property is new in 12.1.0.\n',
    );

    assert.deepEqual(checkDocVersionReferences(root).findings, [
      'llms/forms.md:1 cites new in 12.1.0, but CHANGELOG.md has no 12.1.0 heading',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('accepts every current shipped new-in stamp', () => {
  const result = checkDocVersionReferences();
  assert.deepEqual(result.findings, []);
  assert.ok(result.referencesChecked > 0);
  assert.ok(result.filesChecked > 0);
  assert.ok(result.releasesChecked > 0);
});

test('fails closed when the documentation scan becomes vacuous', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-doc-versions-empty-'));
  try {
    writeFileSync(path.join(root, 'CHANGELOG.md'), '# Changelog\n\n## 12.0.0\n\nReleased.\n');
    writeFileSync(path.join(root, 'README.md'), 'No release annotations here.\n');
    assert.deepEqual(checkDocVersionReferences(root).findings, [
      'documentation scan found zero "new in X.Y.Z" version references',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
