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
  parseNpmPackOutput,
  parseChangesetText,
  validateTarEntries,
  validateTarEntryTypes,
  versionBump,
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

test('normalizes flattened and compact inherited CEM surfaces equivalently', () => {
  const manifestFixture = (flattened) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: {},
    },
    manifest: {
      schemaVersion: '1.0.0',
      modules: [
        {
          path: 'src/base.ts',
          declarations: [{
            kind: 'class',
            name: 'BaseControl',
            members: [{ kind: 'field', name: 'disabled', type: { text: 'boolean' } }],
            attributes: [{ name: 'disabled', fieldName: 'disabled', type: { text: 'boolean' } }],
            events: [{ name: 'lr-change', type: { text: 'CustomEvent<{ value: string }>' } }],
          }],
        },
        {
          path: 'src/child.ts',
          declarations: [{
            kind: 'class',
            name: 'ChildControl',
            customElement: true,
            tagName: 'lr-child-control',
            superclass: { name: 'BaseControl', module: '/src/base.js' },
            members: [
              ...(flattened
                ? [{
                  kind: 'field',
                  name: 'disabled',
                  type: { text: 'boolean' },
                  inheritedFrom: { name: 'BaseControl', module: 'src/base.ts' },
                }]
                : []),
              { kind: 'field', name: 'value', type: { text: 'string' } },
            ],
            attributes: [
              ...(flattened
                ? [{
                  name: 'disabled',
                  fieldName: 'disabled',
                  type: { text: 'boolean' },
                  inheritedFrom: { name: 'BaseControl', module: 'src/base.ts' },
                }]
                : []),
              { name: 'value', fieldName: 'value', type: { text: 'string' } },
            ],
            ...(flattened
              ? {
                events: [{
                  name: 'lr-change',
                  type: { text: 'CustomEvent<{ value: string }>' },
                  inheritedFrom: { name: 'BaseControl', module: 'src/base.ts' },
                }],
              }
              : {}),
          }],
        },
      ],
    },
    declarations: {},
  });

  assert.deepEqual(
    normalizePublicApi(manifestFixture(false)),
    normalizePublicApi(manifestFixture(true)),
  );
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

test('follows named re-exports and export stars into declaration shapes', () => {
  const declarationFixture = (detailType) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { '.': { types: './dist/lyra.d.ts', default: './dist/lyra.js' } },
    },
    manifest: { modules: [] },
    declarations: {
      named: "export * from './events.js';\nexport type { PublicOptions } from './options.js';\n",
      files: {
        'dist/lyra.d.ts': "export * from './events.js';\nexport type { PublicOptions } from './options.js';\n",
        'dist/events.d.ts': `type ChangeDetail = ${detailType};\nexport interface LyraSampleEventMap { 'lr-change': CustomEvent<ChangeDetail>; }\n`,
        'dist/options.d.ts': "export interface PublicOptions { readonly mode?: 'quiet' | 'loud'; }\n",
      },
      packageFiles: ['dist/lyra.d.ts', 'dist/lyra.js', 'dist/events.d.ts', 'dist/options.d.ts'],
    },
  });

  const before = normalizePublicApi(declarationFixture("{ mode: 'quiet' | 'loud' }"));
  const narrowed = normalizePublicApi(declarationFixture("{ mode: 'quiet' }"));
  const changes = diffPublicApi(before, narrowed);

  assert.ok(before.entries['named-export:LyraSampleEventMap']);
  assert.ok(before.entries['named-export:PublicOptions']);
  assert.ok(
    changes.some(
      (change) =>
        change.id.includes('named-export:LyraSampleEventMap') &&
        change.id.includes('ChangeDetail') &&
        change.bump === 'major',
    ),
  );
});

test('tracks generic constraints and defaults on public declarations', () => {
  const declarationFixture = (constraint, defaultType) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { '.': { types: './dist/lyra.d.ts', default: './dist/lyra.js' } },
    },
    manifest: { modules: [] },
    declarations: {
      named: `export interface Box<T extends ${constraint} = ${defaultType}> { value: T; }\n` +
        `export declare function identity<T extends ${constraint} = ${defaultType}>(value: T): T;\n`,
    },
  });

  const before = normalizePublicApi(declarationFixture('string', "'default'"));
  const after = normalizePublicApi(declarationFixture('unknown', 'string'));
  const changes = diffPublicApi(before, after);

  assert.ok(
    changes.some(
      (change) =>
        change.id.includes('named-export:Box:type-parameters') && change.bump === 'major',
    ),
  );
  assert.ok(
    changes.some(
      (change) =>
        change.id.includes('named-export:identity') &&
        change.id.includes('type-parameters') &&
        change.bump === 'major',
    ),
  );
});

test('does not promote private class dependencies into the named public API', () => {
  const fixture = (secretType) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { '.': './dist/lyra.js' },
    },
    manifest: { modules: [] },
    declarations: {
      named: "export { PublicClass } from './public.js';\n",
      files: {
        'dist/lyra.d.ts': "export { PublicClass } from './public.js';\n",
        'dist/public.d.ts': `interface InternalOptions { secret: ${secretType}; }\nexport declare class PublicClass { private options: InternalOptions; value: string; }\n`,
      },
    },
  });

  assert.deepEqual(
    normalizePublicApi(fixture('string')),
    normalizePublicApi(fixture('number')),
  );
});

test('expands wildcard package exports against the actual package file inventory', () => {
  const fixture = (packageFiles) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './components/*': './dist/components/*' },
    },
    manifest: { modules: [] },
    declarations: { packageFiles },
  });
  const before = normalizePublicApi(fixture(['dist/components/a.js']));
  const after = normalizePublicApi(fixture(['dist/components/a.js', 'dist/components/b.js']));
  const changes = diffPublicApi(before, after);

  assert.ok(before.entries['package-export:./components/a.js:default']);
  assert.ok(changes.some((change) => change.id === 'package-export:./components/b.js:default'));
  assert.equal(minimumRequiredBump(changes), 'minor');

  const explicitOverride = normalizePublicApi({
    ...fixture(['dist/components/a.js', 'dist/special-a.js']),
    packageJson: {
      ...fixture([]).packageJson,
      exports: {
        './components/*': './dist/components/*',
        './components/a.js': './dist/special-a.js',
      },
    },
  });
  assert.equal(
    explicitOverride.entries['package-export:./components/a.js:default'].value,
    './dist/special-a.js',
  );
});

test('treats a public event cancelability change as breaking', () => {
  const beforeFixture = structuredClone(baseline);
  const afterFixture = structuredClone(baseline);
  beforeFixture.manifest.modules[0].declarations[0].events[0].cancelable = true;
  afterFixture.manifest.modules[0].declarations[0].events[0].cancelable = false;

  const changes = diffPublicApi(
    normalizePublicApi(beforeFixture),
    normalizePublicApi(afterFixture),
  );
  assert.ok(
    changes.some(
      (change) => change.id === 'cem:lr-sample:event:lr-change:cancelable' && change.bump === 'major',
    ),
  );
});

test('treats removal of a public CSS custom state as breaking', () => {
  const beforeFixture = structuredClone(baseline);
  const afterFixture = structuredClone(baseline);
  beforeFixture.manifest.modules[0].declarations[0].cssStates = [{ name: 'busy' }];

  const changes = diffPublicApi(
    normalizePublicApi(beforeFixture),
    normalizePublicApi(afterFixture),
  );
  assert.ok(
    changes.some(
      (change) => change.id === 'cem:lr-sample:css-state:busy' && change.bump === 'major',
    ),
  );
});

test('does not mistake non-cancelable event prose for a cancelable contract', () => {
  for (const spelling of ['non-cancelable', 'noncancelable', 'non cancelable']) {
    const beforeFixture = structuredClone(baseline);
    const afterFixture = structuredClone(baseline);
    beforeFixture.manifest.modules[0].declarations[0].events[0].description =
      `This event is ${spelling}.`;
    afterFixture.manifest.modules[0].declarations[0].events[0].description =
      'This event is cancelable.';

    const changes = diffPublicApi(
      normalizePublicApi(beforeFixture),
      normalizePublicApi(afterFixture),
    );
    assert.ok(
      changes.some(
        (change) =>
          change.id === 'cem:lr-sample:event:lr-change:cancelable' && change.bump === 'major',
      ),
      spelling,
    );
  }
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
