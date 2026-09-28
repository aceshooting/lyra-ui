import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
      'llms/forms.md:1 cites new in 12.1.0, but release history has no 12.1.0 heading',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('accepts canonical major history while still rejecting unknown versions and unrelated markdown', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-doc-versions-archive-'));
  try {
    mkdirSync(path.join(root, 'docs/changelog'), { recursive: true });
    writeFileSync(path.join(root, 'CHANGELOG.md'), '# Changelog\n\n## 12.0.0\n\nReleased.\n');
    writeFileSync(path.join(root, 'docs/changelog/v8.md'), '# Version 8 release history\n\n## 8.0.0\n\nReleased.\n');
    writeFileSync(path.join(root, 'docs/changelog/notes.md'), '## 11.9.0\nNot a release archive.\n');
    writeFileSync(path.join(root, 'README.md'), 'New in 8.0.0. New in 12.0.0. New in 12.1.0. New in 11.9.0.\n');
    const result = checkDocVersionReferences(root);
    assert.equal(result.releasesChecked, 2);
    assert.deepEqual(result.findings, [
      'README.md:1 cites new in 11.9.0, but release history has no 11.9.0 heading',
      'README.md:1 cites new in 12.1.0, but release history has no 12.1.0 heading',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects empty archives and links that escape the release archive directory', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-doc-versions-archive-path-'));
  try {
    mkdirSync(path.join(root, 'docs/changelog'), { recursive: true });
    writeFileSync(path.join(root, 'CHANGELOG.md'), '# Changelog\n\n## 12.0.0\n');
    writeFileSync(path.join(root, 'docs/changelog/v7.md'), '# No release headings\n');
    writeFileSync(path.join(root, 'outside.md'), '## 8.0.0\n');
    symlinkSync('../../outside.md', path.join(root, 'docs/changelog/v8.md'));
    writeFileSync(path.join(root, 'README.md'), 'New in 8.0.0. New in 12.0.0.\n');
    const result = checkDocVersionReferences(root);
    assert.equal(result.releasesChecked, 1);
    assert.deepEqual(result.findings, [
      'README.md:1 cites new in 8.0.0, but release history has no 8.0.0 heading',
      'docs/changelog/v7.md contains zero release-version headings',
      'docs/changelog/v8.md must be a regular release archive file',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects archive headings outside their declared old major and future archive files', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-doc-versions-bad-archive-'));
  try {
    mkdirSync(path.join(root, 'docs/changelog'), { recursive: true });
    writeFileSync(path.join(root, 'CHANGELOG.md'), '# Changelog\n\n## 12.0.0\n');
    writeFileSync(path.join(root, 'docs/changelog/v8.md'), '# Version 8 release history\n\n## 12.1.0\n');
    writeFileSync(path.join(root, 'docs/changelog/v13.md'), '# Version 13 release history\n\n## 13.0.0\n');
    writeFileSync(path.join(root, 'README.md'), 'New in 12.0.0. New in 12.1.0. New in 13.0.0.\n');
    const result = checkDocVersionReferences(root);
    assert.equal(result.releasesChecked, 1);
    assert.ok(result.findings.some((finding) => finding.includes('v8.md') && finding.includes('outside archive major 8')));
    assert.ok(result.findings.some((finding) => finding.includes('v13.md') && finding.includes('older than current major 12')));
    assert.ok(result.findings.some((finding) => finding.includes('cites new in 12.1.0')));
    assert.ok(result.findings.some((finding) => finding.includes('cites new in 13.0.0')));
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
