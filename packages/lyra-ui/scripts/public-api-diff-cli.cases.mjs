import assert from 'node:assert/strict';
import test from 'node:test';
import { baseline, additive, breaking } from './public-api-diff-test-fixtures.mjs';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  applyReviewedExceptions, diffPublicApi, evaluateSemverGate, normalizePublicApi,
  parseChangesetText, parseNpmPackOutput, runCli, validateTarEntries,
  validateTarEntryTypes, versionBump,
} from './public-api-diff.mjs';

test('scopes default reviewed exceptions to the package being checked and honors an explicit path', (context) => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-api-exception-scope-'));
  context.mock.method(console, 'log', () => {});
  try {
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      name: '@example/companion', version: '1.0.0', types: './index.d.ts',
      exports: { '.': { types: './index.d.ts', default: './index.js' } },
    }));
    writeFileSync(path.join(root, 'index.js'), 'export const value = 1;\n');
    writeFileSync(path.join(root, 'index.d.ts'), 'export declare const value: number;\n');
    const args = ['--baseline', root, '--current', root, '--changesets', root];
    assert.equal(runCli(args), 0, 'a companion package must not inherit this script package\'s exceptions');
    mkdirSync(path.join(root, 'scripts'));
    writeFileSync(path.join(root, 'scripts/public-api-semver-exceptions.json'), JSON.stringify({
      exceptions: [{
        changeId: 'companion-review', requiredBump: 'major', allowedBump: 'patch',
        before: 'before', after: 'after', reason: 'Reviewed companion API change',
        reviewer: 'Test reviewer', reviewedOn: '2026-09-07',
      }],
    }));
    assert.throws(() => runCli(args), /Reviewed API exception companion-review does not match/);
    const explicitPath = path.join(root, 'explicit-exceptions.json');
    writeFileSync(explicitPath, JSON.stringify({ exceptions: [] }));
    assert.equal(runCli(['--exceptions', explicitPath, ...args]), 0);
    assert.equal(runCli([...args, '--exceptions', explicitPath]), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('parses the highest Changeset bump for one package', () => {
  const first = parseChangesetText(`---\n"@aceshooting/lyra-ui": patch\n"@aceshooting/lyra-flags": minor\n---\n\nFix it.\n`);
  const second = parseChangesetText(`---\n'@aceshooting/lyra-ui': major\n---\n\nBreak it.\n`);

  assert.deepEqual(first, new Map([
    ['@aceshooting/lyra-flags', 'minor'],
    ['@aceshooting/lyra-ui', 'patch'],
  ]));
  assert.equal(second.get('@aceshooting/lyra-ui'), 'major');
});

test('accepts SemVer build metadata without treating it as a release bump', () => {
  assert.equal(versionBump('8.0.0+build.1', '8.0.0+build.2'), 'none');
  assert.equal(versionBump('8.0.0-rc.1+build.1', '8.0.0-rc.1+build.2'), 'none');
  assert.throws(() => versionBump('08.0.0', '8.0.0'), /must be a semver version/);
});

test('fails when Changesets understate the normalized API diff', () => {
  const additiveChanges = diffPublicApi(normalizePublicApi(baseline), normalizePublicApi(additive));
  const breakingChanges = diffPublicApi(normalizePublicApi(baseline), normalizePublicApi(breaking));

  assert.deepEqual(
    evaluateSemverGate({
      changes: additiveChanges,
      baselineVersion: '8.0.0',
      currentVersion: '8.0.0',
      changesetBump: 'patch',
    }),
    { required: 'minor', declared: 'patch', passes: false },
  );
  assert.deepEqual(
    evaluateSemverGate({
      changes: breakingChanges,
      baselineVersion: '8.0.0',
      currentVersion: '8.0.0',
      changesetBump: 'minor',
    }),
    { required: 'major', declared: 'minor', passes: false },
  );
  assert.deepEqual(
    evaluateSemverGate({
      changes: breakingChanges,
      baselineVersion: '7.8.1',
      currentVersion: '8.0.0',
      changesetBump: 'none',
    }),
    { required: 'major', declared: 'major', passes: true },
  );
});

test('allows only exact, reviewed exceptions and rejects stale exception entries', () => {
  const changes = diffPublicApi(normalizePublicApi(baseline), normalizePublicApi(breaking));
  const target = changes.find((change) => change.id === 'cem:lr-sample:member:field:mode:default');
  const exception = {
    changeId: target.id,
    before: target.before,
    after: target.after,
    requiredBump: 'major',
    allowedBump: 'patch',
    reason: 'The old documented default was never observable.',
    reviewer: 'release-maintainer',
    reviewedOn: '2026-08-02'
  };

  const adjusted = applyReviewedExceptions(changes, { exceptions: [exception] });
  assert.equal(adjusted.find((change) => change.id === target.id).bump, 'patch');
  assert.equal(adjusted.find((change) => change.id === target.id).exception.reason, exception.reason);

  assert.throws(
    () => applyReviewedExceptions(changes, { exceptions: [{ ...exception, reviewer: '' }] }),
    /reviewer/,
  );
  assert.throws(
    () => applyReviewedExceptions(changes, { exceptions: [{ ...exception, after: 'not-the-change' }] }),
    /does not match any current API change/,
  );
});

test('validates npm pack output and rejects unsafe published-package archives', () => {
  assert.equal(
    parseNpmPackOutput('[{"filename":"aceshooting-lyra-ui-7.8.1.tgz"}]'),
    'aceshooting-lyra-ui-7.8.1.tgz',
  );
  // Some npm versions (observed: 12.0.2) report `npm pack --json` as an object keyed by package
  // name rather than an array -- `Object.values()` normalizes it to the same single-element shape.
  assert.equal(
    parseNpmPackOutput('{"@aceshooting/lyra-ui":{"filename":"aceshooting-lyra-ui-7.8.1.tgz"}}'),
    'aceshooting-lyra-ui-7.8.1.tgz',
  );
  assert.throws(() => parseNpmPackOutput('[]'), /exactly one tarball/);
  assert.throws(() => parseNpmPackOutput('{}'), /exactly one tarball/);
  assert.doesNotThrow(() =>
    validateTarEntries(['package/package.json', 'package/dist/lyra.js']),
  );
  assert.throws(() => validateTarEntries(['../outside']), /unsafe archive entry/);
  assert.throws(() => validateTarEntries(['/absolute']), /unsafe archive entry/);
  assert.throws(() => validateTarEntries(['not-package/file']), /unsafe archive entry/);
  assert.doesNotThrow(() =>
    validateTarEntryTypes([
      'drwxr-xr-x 0/0 0 2026-08-02 00:00 package/',
      '-rw-r--r-- 0/0 42 2026-08-02 00:00 package/package.json',
    ]),
  );
  assert.throws(
    () => validateTarEntryTypes(['lrwxrwxrwx 0/0 0 2026-08-02 00:00 package/link -> /tmp']),
    /link or special-file/,
  );
});
