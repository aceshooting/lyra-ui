#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyReviewedExceptions,
  diffPublicApi,
  evaluateSemverGate,
  minimumRequiredBump,
  normalizePublicApi,
  normalizeType,
  parseChangesetText,
} from './public-api-diff.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(scriptsDir, 'fixtures', 'public-api');
const readFixture = (name) =>
  JSON.parse(readFileSync(path.join(fixtureDir, `${name}.json`), 'utf8'));

const baseline = readFixture('baseline');
const additive = readFixture('additive');
const breaking = readFixture('breaking');

test('normalizes source ordering, descriptions, paths, and union ordering out of the API', () => {
  const reordered = structuredClone(baseline);
  reordered.manifest.modules[0].path = 'src/a-different-layout/sample.ts';
  const declaration = reordered.manifest.modules[0].declarations[0];
  declaration.description = 'Entirely different prose.';
  declaration.members.reverse();
  declaration.events[0].type.text = "CustomEvent<{ mode: 'loud' | 'quiet' }>";
  reordered.declarations.named = reordered.declarations.named.split('\n').reverse().join('\n');

  assert.deepEqual(normalizePublicApi(reordered), normalizePublicApi(baseline));
  assert.equal(normalizeType("'loud' | ('quiet')"), normalizeType("'quiet'|'loud'"));
});

test('classifies additive CEM, export, framework, and named-export surface as minor', () => {
  const changes = diffPublicApi(normalizePublicApi(baseline), normalizePublicApi(additive));
  assert.equal(minimumRequiredBump(changes), 'minor');
  assert.ok(changes.some((change) => change.id === 'package-export:./theme.js:default'));
  assert.ok(changes.some((change) => change.id === 'cem:lr-sample:member:field:count'));
  assert.ok(changes.some((change) => change.id === 'cem:lr-sample:event:lr-open'));
  assert.ok(changes.some((change) => change.id === 'named-export:invalidateLyraTheme'));
  assert.ok(changes.some((change) => change.id.includes('framework:vue')));
  assert.ok(changes.every((change) => change.bump !== 'major'));
});

test('classifies removals, narrowing, defaults, events, and reflection changes as major', () => {
  const changes = diffPublicApi(normalizePublicApi(baseline), normalizePublicApi(breaking));
  assert.equal(minimumRequiredBump(changes), 'major');

  const majorIds = new Set(changes.filter((change) => change.bump === 'major').map((change) => change.id));
  assert.ok(majorIds.has('package-export:./custom-elements.json:default'));
  assert.ok(majorIds.has('cem:lr-sample:member:field:mode:type'));
  assert.ok(majorIds.has('cem:lr-sample:member:field:mode:default'));
  assert.ok(majorIds.has('cem:lr-sample:member:field:mode:reflects'));
  assert.ok(majorIds.has('cem:lr-sample:event:lr-change'));
  assert.ok(majorIds.has('cem:lr-sample:css-part:base'));
  assert.ok(majorIds.has('named-export:SampleMode'));
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
