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
        change.id === 'named-export:LyraSampleEventMap:dependencies' &&
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
  assert.equal(before.entries['package-export:./components/a.d.ts:default'], undefined);
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

test('treats conditional export key order as part of the supported route contract', () => {
  const fixture = (rootExport) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { '.': rootExport },
    },
    manifest: { modules: [] },
    declarations: {
      named: 'export {};\n',
      files: { 'dist/lyra.d.ts': 'export {};\n' },
      packageFiles: ['dist/lyra.d.ts', 'dist/lyra.js'],
    },
  });
  const changes = diffPublicApi(
    normalizePublicApi(fixture({ types: './dist/lyra.d.ts', default: './dist/lyra.js' })),
    normalizePublicApi(fixture({ default: './dist/lyra.js', types: './dist/lyra.d.ts' })),
  );
  assert.deepEqual(changes.map(({ id, bump }) => ({ id, bump })), [{
    id: 'package-export:.:root:condition-order',
    bump: 'major',
  }]);
});

test('recognizes root conditional-export sugar as the package root', () => {
  const fixture = (rootExport) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: rootExport,
    },
    manifest: { modules: [] },
    declarations: {
      named: 'export {};\n',
      files: { 'dist/lyra.d.ts': 'export {};\n' },
      packageFiles: ['dist/lyra.d.ts', 'dist/lyra.js'],
    },
  });
  const before = normalizePublicApi(
    fixture({ types: './dist/lyra.d.ts', default: './dist/lyra.js' }),
  );
  assert.ok(before.entries['package-export:.:types']);
  assert.ok(before.entries['package-export:.:default']);
  assert.equal(before.entries['package-export:types:default'], undefined);
  const changes = diffPublicApi(
    before,
    normalizePublicApi(fixture({ default: './dist/lyra.js', types: './dist/lyra.d.ts' })),
  );
  assert.deepEqual(changes.map(({ id, bump }) => ({ id, bump })), [{
    id: 'package-export:.:root:condition-order',
    bump: 'major',
  }]);
});

test('classifies declaration changes behind explicit non-root subpaths as breaking', () => {
  const fixture = (valueType) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: {
        '.': { types: './dist/lyra.d.ts', default: './dist/lyra.js' },
        './utility.js': {
          types: './dist/utility.d.ts',
          default: './dist/utility.js',
        },
      },
    },
    manifest: { modules: [] },
    declarations: {
      named: 'export {};\n',
      files: {
        'dist/lyra.d.ts': 'export {};\n',
        'dist/utility.d.ts': `export interface UtilityOptions { value: ${valueType}; }\n`,
      },
      packageFiles: [
        'dist/lyra.d.ts',
        'dist/lyra.js',
        'dist/utility.d.ts',
        'dist/utility.js',
      ],
    },
  });

  const before = normalizePublicApi(fixture('string'));
  const after = normalizePublicApi(fixture('number'));
  const changes = diffPublicApi(before, after);

  assert.ok(before.entries['subpath-export:./utility.js:UtilityOptions']);
  assert.ok(
    changes.some(
      (change) =>
        change.id === 'subpath-export:./utility.js:UtilityOptions:contract'
        && change.bump === 'major',
    ),
  );
});

test('tracks additive and breaking declaration surfaces behind wildcard subpaths', () => {
  const fixture = (helperSource) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './utilities/*': './dist/utilities/*' },
    },
    manifest: { modules: [] },
    declarations: {
      files: { 'dist/utilities/helper.d.ts': helperSource },
      packageFiles: ['dist/utilities/helper.d.ts', 'dist/utilities/helper.js'],
    },
  });

  const before = normalizePublicApi(fixture(
    'export interface UtilityOptions { value: string; }\n',
  ));
  const additive = normalizePublicApi(fixture(
    'export interface UtilityOptions { value: string; }\nexport type UtilityMode = \'safe\';\n',
  ));
  const breaking = normalizePublicApi(fixture('export {};\n'));
  const addedChanges = diffPublicApi(before, additive);
  const removedChanges = diffPublicApi(before, breaking);

  assert.ok(before.entries['subpath-export:./utilities/helper.js:UtilityOptions']);
  assert.ok(
    addedChanges.some(
      (change) =>
        change.id === 'subpath-export:./utilities/helper.js:UtilityMode'
        && change.bump === 'minor',
    ),
  );
  assert.ok(
    removedChanges.some(
      (change) =>
        change.id === 'subpath-export:./utilities/helper.js:UtilityOptions'
        && change.bump === 'major',
    ),
  );
});

test('tracks divergent declaration contracts for every supported export condition', () => {
  const fixture = (requireType) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: {
        './dual.js': {
          import: {
            types: './dist/dual-import.d.ts',
            default: './dist/dual-import.js',
          },
          require: {
            types: './dist/dual-require.d.ts',
            default: './dist/dual-require.js',
          },
        },
      },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/dual-import.d.ts': 'export interface Options { value: string; }\n',
        'dist/dual-require.d.ts': `export interface Options { value: ${requireType}; }\n`,
      },
      packageFiles: [
        'dist/dual-import.d.ts',
        'dist/dual-import.js',
        'dist/dual-require.d.ts',
        'dist/dual-require.js',
      ],
    },
  });

  const changes = diffPublicApi(
    normalizePublicApi(fixture('string')),
    normalizePublicApi(fixture('number')),
  );

  assert.ok(
    changes.some(
      (change) =>
        change.id === 'subpath-export:./dual.js:require.types:Options:contract'
        && change.bump === 'major',
    ),
  );
  assert.equal(
    changes.some((change) => change.id.includes(':import.types:')),
    false,
  );
});

test('tracks inline import types and ignores local import-alias spelling', () => {
  const fixture = ({ alias = 'LocalOptions', value = 'string', inline = false } = {}) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/consumer.d.ts': inline
          ? "export declare function use(value: import('./types.js').Options): void;\n"
          : `import type { Options as ${alias} } from './types.js';\nexport declare function use(value: ${alias}): void;\n`,
        'dist/types.d.ts': `export interface Options { value: ${value}; }\n`,
      },
      packageFiles: [
        'dist/consumer.d.ts',
        'dist/consumer.js',
        'dist/types.d.ts',
        'dist/types.js',
      ],
    },
  });

  const aliasChanges = diffPublicApi(
    normalizePublicApi(fixture({ alias: 'LocalOptions' })),
    normalizePublicApi(fixture({ alias: 'RenamedLocally' })),
  );
  assert.deepEqual(aliasChanges, []);

  const importTypeChanges = diffPublicApi(
    normalizePublicApi(fixture({ inline: true, value: 'string' })),
    normalizePublicApi(fixture({ inline: true, value: 'number' })),
  );
  assert.ok(
    importTypeChanges.some(
      (change) =>
        change.id === 'subpath-export:./consumer.js:use:dependencies'
        && change.bump === 'major',
    ),
  );
});

test('keeps dependency contracts bound to each public route', () => {
  const fixture = (aTarget) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: {
        './a.js': './dist/a.js',
        './b.js': './dist/b.js',
        './c.js': './dist/c.js',
      },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/a.d.ts': `import type { Options } from './${aTarget}.js';\nexport declare function use(value: Options): void;\n`,
        'dist/b.d.ts': "import type { Options } from './number.js';\nexport declare function use(value: Options): void;\n",
        'dist/c.d.ts': "import type { Options } from './string.js';\nexport declare function use(value: Options): void;\n",
        'dist/string.d.ts': 'export interface Options { value: string; }\n',
        'dist/number.d.ts': 'export interface Options { value: number; }\n',
      },
      packageFiles: [
        'dist/a.d.ts', 'dist/a.js', 'dist/b.d.ts', 'dist/b.js', 'dist/c.d.ts', 'dist/c.js',
        'dist/string.d.ts', 'dist/string.js', 'dist/number.d.ts', 'dist/number.js',
      ],
    },
  });
  const changes = diffPublicApi(
    normalizePublicApi(fixture('string')),
    normalizePublicApi(fixture('number')),
  );
  assert.deepEqual(changes.map(({ id, bump }) => ({ id, bump })), [{
    id: 'subpath-export:./a.js:use:dependencies',
    bump: 'major',
  }]);
});

test('keeps dependency identities bound within one exported signature', () => {
  const fixture = ({ leftType, rightType }) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/consumer.d.ts': "import type { Left } from './left.js';\nimport type { Right } from './right.js';\nexport declare function use(left: Left, right: Right): void;\n",
        'dist/left.d.ts': `export interface Left { value: ${leftType}; }\n`,
        'dist/right.d.ts': `export interface Right { value: ${rightType}; }\n`,
      },
      packageFiles: [
        'dist/consumer.d.ts', 'dist/consumer.js',
        'dist/left.d.ts', 'dist/left.js',
        'dist/right.d.ts', 'dist/right.js',
      ],
    },
  });
  const changes = diffPublicApi(
    normalizePublicApi(fixture({ leftType: 'string', rightType: 'number' })),
    normalizePublicApi(fixture({ leftType: 'number', rightType: 'string' })),
  );
  assert.deepEqual(changes.map(({ id, bump }) => ({ id, bump })), [{
    id: 'subpath-export:./consumer.js:use:dependencies',
    bump: 'major',
  }]);
});

test('distinguishes same-named dependencies imported from different modules', () => {
  const fixture = ({ firstType, secondType }) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/consumer.d.ts': "import type { Hidden as A } from './first.js';\nimport type { Hidden as B } from './second.js';\nexport declare function use(left: A, right: B): void;\n",
        'dist/first.d.ts': `export interface Hidden { value: ${firstType}; }\n`,
        'dist/second.d.ts': `export interface Hidden { value: ${secondType}; }\n`,
      },
      packageFiles: [
        'dist/consumer.d.ts', 'dist/consumer.js',
        'dist/first.d.ts', 'dist/first.js',
        'dist/second.d.ts', 'dist/second.js',
      ],
    },
  });
  const changes = diffPublicApi(
    normalizePublicApi(fixture({ firstType: 'string', secondType: 'number' })),
    normalizePublicApi(fixture({ firstType: 'number', secondType: 'string' })),
  );
  assert.deepEqual(changes.map(({ id, bump }) => ({ id, bump })), [{
    id: 'subpath-export:./consumer.js:use:dependencies',
    bump: 'major',
  }]);
});

test('resolves namespace-import members and canonicalizes aliases in generic and heritage types', () => {
  const namespaceFixture = (valueType) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/consumer.d.ts': "import type * as Types from './types.js';\nexport declare function use(value: Types.Options): void;\n",
        'dist/types.d.ts': `export interface Options { value: ${valueType}; }\n`,
      },
      packageFiles: ['dist/consumer.d.ts', 'dist/consumer.js', 'dist/types.d.ts', 'dist/types.js'],
    },
  });
  const namespaceChanges = diffPublicApi(
    normalizePublicApi(namespaceFixture('string')),
    normalizePublicApi(namespaceFixture('number')),
  );
  assert.ok(namespaceChanges.some(
    (change) => change.id === 'subpath-export:./consumer.js:use:dependencies',
  ));

  const aliasFixture = (alias) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/consumer.d.ts': `import type { Options as ${alias} } from './types.js';\nexport interface Box<T extends ${alias} = ${alias}> extends ${alias} {}\n`,
        'dist/types.d.ts': 'export interface Options { value: string; }\n',
      },
      packageFiles: ['dist/consumer.d.ts', 'dist/consumer.js', 'dist/types.d.ts', 'dist/types.js'],
    },
  });
  assert.deepEqual(
    diffPublicApi(
      normalizePublicApi(aliasFixture('LocalOptions')),
      normalizePublicApi(aliasFixture('RenamedOptions')),
    ),
    [],
  );
});

test('tracks nested namespace members through namespace and inline imports', () => {
  const fixture = ({ valueType, inline }) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/consumer.d.ts': inline
          ? "export declare function use(value: import('./types.js').Outer.Inner.Options): void;\n"
          : "import type * as Types from './types.js';\nexport declare function use(value: Types.Outer.Inner.Options): void;\n",
        'dist/types.d.ts': `export namespace Outer { export namespace Inner { export interface Options { value: ${valueType}; } } }\n`,
      },
      packageFiles: [
        'dist/consumer.d.ts', 'dist/consumer.js', 'dist/types.d.ts', 'dist/types.js',
      ],
    },
  });

  for (const inline of [false, true]) {
    const changes = diffPublicApi(
      normalizePublicApi(fixture({ inline, valueType: 'string' })),
      normalizePublicApi(fixture({ inline, valueType: 'number' })),
    );
    assert.deepEqual(changes.map(({ id, bump }) => ({ id, bump })), [{
      id: 'subpath-export:./consumer.js:use:dependencies',
      bump: 'major',
    }]);
  }
});

test('tracks the complete exported surface of qualifier-less module import types', () => {
  const fixture = (valueType) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/consumer.d.ts': "export declare const moduleApi: typeof import('./types.js');\n",
        'dist/types.d.ts': `export declare const answer: ${valueType};\n`,
      },
      packageFiles: [
        'dist/consumer.d.ts', 'dist/consumer.js', 'dist/types.d.ts', 'dist/types.js',
      ],
    },
  });

  const changes = diffPublicApi(
    normalizePublicApi(fixture('string')),
    normalizePublicApi(fixture('number')),
  );
  assert.deepEqual(changes.map(({ id, bump }) => ({ id, bump })), [{
    id: 'subpath-export:./consumer.js:moduleApi:dependencies',
    bump: 'major',
  }]);
});

test('tracks transitive declaration dependencies without expanding every path', () => {
  const fixture = (valueType) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/consumer.d.ts': "import type { A } from './types.js';\nexport declare function use(value: A): void;\n",
        'dist/types.d.ts': `export interface A { nested: B; }\nexport interface B { value: ${valueType}; }\n`,
      },
      packageFiles: [
        'dist/consumer.d.ts', 'dist/consumer.js', 'dist/types.d.ts', 'dist/types.js',
      ],
    },
  });

  const changes = diffPublicApi(
    normalizePublicApi(fixture('string')),
    normalizePublicApi(fixture('number')),
  );
  assert.deepEqual(changes.map(({ id, bump }) => ({ id, bump })), [{
    id: 'subpath-export:./consumer.js:use:dependencies',
    bump: 'major',
  }]);
});

test('terminates cyclic declaration dependency graphs deterministically', () => {
  const fixture = () => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/consumer.d.ts': "import type { A } from './types.js';\nexport declare function use(value: A): void;\n",
        'dist/types.d.ts': 'export interface A { b: B; }\nexport interface B { a: A; }\n',
      },
      packageFiles: [
        'dist/consumer.d.ts', 'dist/consumer.js', 'dist/types.d.ts', 'dist/types.js',
      ],
    },
  });

  assert.deepEqual(normalizePublicApi(fixture()), normalizePublicApi(fixture()));
});

test('uses stable declaration identities when unrelated private declarations move offsets', () => {
  const fixture = (prefix) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/consumer.d.ts': "import type { Options } from './types.js';\nexport declare function use(value: Options): void;\n",
        'dist/types.d.ts': `${prefix}export interface Options { value: string; }\n`,
      },
      packageFiles: ['dist/consumer.d.ts', 'dist/consumer.js', 'dist/types.d.ts', 'dist/types.js'],
    },
  });
  assert.deepEqual(
    diffPublicApi(
      normalizePublicApi(fixture('')),
      normalizePublicApi(fixture('interface PrivatePrefix { ignored: true; }\n')),
    ),
    [],
  );
});

test('tracks local, dotted, nested, and re-exported namespace leaves', () => {
  const fixture = (shape, valueType) => {
    const files = {
      'dist/consumer.d.ts': '',
      'dist/types.d.ts': '',
    };
    if (shape === 'local') {
      files['dist/consumer.d.ts'] =
        `declare namespace Local { export namespace Inner { export interface Options { value: ${valueType}; } } }\n` +
        'export { Local as API };\n';
    } else if (shape === 'dotted') {
      files['dist/consumer.d.ts'] =
        `export namespace API.Inner { export interface Options { value: ${valueType}; } }\n`;
    } else {
      files['dist/consumer.d.ts'] = "export { Source as API } from './types.js';\n";
      files['dist/types.d.ts'] =
        `export namespace Source { export namespace Inner { export interface Options { value: ${valueType}; } } }\n`;
    }
    return {
      packageJson: {
        name: '@aceshooting/lyra-ui',
        version: '8.0.0',
        exports: { './consumer.js': './dist/consumer.js' },
      },
      manifest: { modules: [] },
      declarations: {
        files,
        packageFiles: [
          'dist/consumer.d.ts', 'dist/consumer.js', 'dist/types.d.ts', 'dist/types.js',
        ],
      },
    };
  };

  for (const shape of ['local', 'dotted', 're-exported']) {
    const changes = diffPublicApi(
      normalizePublicApi(fixture(shape, 'string')),
      normalizePublicApi(fixture(shape, 'number')),
    );
    assert.ok(
      changes.some(
        (change) => change.id.startsWith('subpath-export:./consumer.js:API:')
          && change.bump === 'major',
      ),
      shape,
    );
  }
});

test('includes the default export in qualifier-less typeof-import module contracts', () => {
  const fixture = (valueType) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/consumer.d.ts': "export declare const moduleApi: typeof import('./types.js');\n",
        'dist/types.d.ts':
          `declare const answer: ${valueType};\nexport default answer;\nexport declare const stable: true;\n`,
      },
      packageFiles: [
        'dist/consumer.d.ts', 'dist/consumer.js', 'dist/types.d.ts', 'dist/types.js',
      ],
    },
  });

  const changes = diffPublicApi(
    normalizePublicApi(fixture('string')),
    normalizePublicApi(fixture('number')),
  );
  assert.deepEqual(changes.map(({ id, bump }) => ({ id, bump })), [{
    id: 'subpath-export:./consumer.js:moduleApi:dependencies',
    bump: 'major',
  }]);
});

test('tracks distinct declaration variants selected by root export conditions', () => {
  const fixture = (requireType) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: {
        import: { types: './dist/root-import.d.ts', default: './dist/root-import.js' },
        require: { types: './dist/root-require.d.ts', default: './dist/root-require.js' },
      },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/root-import.d.ts': 'export interface Options { value: string; }\n',
        'dist/root-require.d.ts': `export interface Options { value: ${requireType}; }\n`,
      },
      packageFiles: [
        'dist/root-import.d.ts', 'dist/root-import.js',
        'dist/root-require.d.ts', 'dist/root-require.js',
      ],
    },
  });

  const changes = diffPublicApi(
    normalizePublicApi(fixture('string')),
    normalizePublicApi(fixture('number')),
  );
  assert.ok(changes.some(
    (change) =>
      change.id === 'subpath-export:.:require.types:Options:contract'
      && change.bump === 'major',
  ));
  assert.equal(changes.some((change) => change.id.includes(':import.types:Options:contract')), false);
});

test('tracks export-star namespace declarations and their nested leaves', () => {
  const fixture = (valueType) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/consumer.d.ts': "export * as API from './types.js';\n",
        'dist/types.d.ts':
          `export namespace Inner { export interface Options { value: ${valueType}; } }\n`,
      },
      packageFiles: [
        'dist/consumer.d.ts', 'dist/consumer.js', 'dist/types.d.ts', 'dist/types.js',
      ],
    },
  });

  const changes = diffPublicApi(
    normalizePublicApi(fixture('string')),
    normalizePublicApi(fixture('number')),
  );
  assert.ok(changes.some(
    (change) => change.id === 'subpath-export:./consumer.js:API:dependencies'
      && change.bump === 'major',
  ));
});

test('tracks default class, function, and value declaration contracts', () => {
  const cases = [
    [
      'class',
      (valueType) => `export default class Service { value: ${valueType}; }\n`,
    ],
    [
      'function',
      (valueType) => `export default function create(): ${valueType};\n`,
    ],
    [
      'value',
      (valueType) => `declare const value: ${valueType};\nexport default value;\n`,
    ],
  ];

  for (const [label, declaration] of cases) {
    const fixture = (valueType) => ({
      packageJson: {
        name: '@aceshooting/lyra-ui',
        version: '8.0.0',
        exports: { './default.js': './dist/default.js' },
      },
      manifest: { modules: [] },
      declarations: {
        files: { 'dist/default.d.ts': declaration(valueType) },
        packageFiles: ['dist/default.d.ts', 'dist/default.js'],
      },
    });
    const changes = diffPublicApi(
      normalizePublicApi(fixture('string')),
      normalizePublicApi(fixture('number')),
    );
    assert.ok(changes.some(
      (change) => change.id === 'subpath-export:./default.js:default:contract'
        && change.bump === 'major',
    ), label);
  }
});

test('normalizes equivalent resolved import path spellings', () => {
  const fixture = ({ source, imported = 'Options', facade = false }) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/consumer.d.ts':
          `import type { ${imported} as LocalOptions } from '${source}';\n` +
          `export declare function use(value: LocalOptions, inline: import('${source}').${imported}): void;\n`,
        'dist/types.d.ts': 'export interface Options { value: string; }\n',
        ...(facade
          ? { 'dist/facade.d.ts': "export { Options as PublicOptions } from './types.js';\n" }
          : {}),
      },
      packageFiles: [
        'dist/consumer.d.ts', 'dist/consumer.js', 'dist/types.d.ts', 'dist/types.js',
        ...(facade ? ['dist/facade.d.ts', 'dist/facade.js'] : []),
      ],
    },
  });

  assert.deepEqual(
    diffPublicApi(
      normalizePublicApi(fixture({ source: './types.js' })),
      normalizePublicApi(fixture({ source: './nested/../types.js' })),
    ),
    [],
  );
  assert.deepEqual(
    diffPublicApi(
      normalizePublicApi(fixture({ source: './types.js' })),
      normalizePublicApi(fixture({
        source: './facade.js',
        imported: 'PublicOptions',
        facade: true,
      })),
    ),
    [],
  );
});

test('keeps deep dependencies associated with structurally identical owners', () => {
  const fixture = ({ leftType, rightType }) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/consumer.d.ts':
          "import type { Owner as Left } from './left/owner.js';\n" +
          "import type { Owner as Right } from './right/owner.js';\n" +
          'export declare function use(left: Left, right: Right): void;\n',
        'dist/left/owner.d.ts':
          "import type { Leaf } from './leaf.js';\nexport interface Owner { value: Leaf; }\n",
        'dist/right/owner.d.ts':
          "import type { Leaf } from './leaf.js';\nexport interface Owner { value: Leaf; }\n",
        'dist/left/leaf.d.ts': `export interface Leaf { value: ${leftType}; }\n`,
        'dist/right/leaf.d.ts': `export interface Leaf { value: ${rightType}; }\n`,
      },
      packageFiles: [
        'dist/consumer.d.ts', 'dist/consumer.js',
        'dist/left/owner.d.ts', 'dist/left/owner.js',
        'dist/right/owner.d.ts', 'dist/right/owner.js',
        'dist/left/leaf.d.ts', 'dist/right/leaf.d.ts',
      ],
    },
  });

  const changes = diffPublicApi(
    normalizePublicApi(fixture({ leftType: 'string', rightType: 'number' })),
    normalizePublicApi(fixture({ leftType: 'number', rightType: 'string' })),
  );
  assert.deepEqual(changes.map(({ id, bump }) => ({ id, bump })), [{
    id: 'subpath-export:./consumer.js:use:dependencies',
    bump: 'major',
  }]);
});

test('keeps same-named namespace leaves bound to their full identity paths', () => {
  const fixture = ({ leftType, rightType }) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/consumer.d.ts':
          'export declare function use(left: API.Left.Options, right: API.Right.Options): void;\n' +
          `export namespace API {\n` +
          `  export namespace Left { export interface Options { value: ${leftType}; } }\n` +
          `  export namespace Right { export interface Options { value: ${rightType}; } }\n` +
          '}\n',
      },
      packageFiles: ['dist/consumer.d.ts', 'dist/consumer.js'],
    },
  });

  const changes = diffPublicApi(
    normalizePublicApi(fixture({ leftType: 'string', rightType: 'number' })),
    normalizePublicApi(fixture({ leftType: 'number', rightType: 'string' })),
  );
  assert.ok(changes.some(
    (change) => change.id === 'subpath-export:./consumer.js:use:dependencies'
      && change.bump === 'major',
  ));
});

test('alpha-normalizes generic binders while preserving their lexical scope', () => {
  const fixture = (source) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './generics.js': './dist/generics.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: { 'dist/generics.d.ts': source },
      packageFiles: ['dist/generics.d.ts', 'dist/generics.js'],
    },
  });
  const before = [
    'export interface Box<T extends object = Record<string, never>> {',
    '  map<U extends T>(value: T, mapper: <V extends U>(item: V) => T): U;',
    '}',
    'export type Keys<T> = { [K in keyof T as K extends string ? K : never]: T[K] };',
    'export type Element<T> = T extends Array<infer U> ? U : T;',
  ].join('\n');
  const renamed = [
    'export interface Box<A extends object = Record<string, never>> {',
    '  map<B extends A>(value: A, mapper: <C extends B>(item: C) => A): B;',
    '}',
    'export type Keys<X> = { [P in keyof X as P extends string ? P : never]: X[P] };',
    'export type Element<Y> = Y extends Array<infer I> ? I : Y;',
  ].join('\n');
  assert.deepEqual(
    diffPublicApi(normalizePublicApi(fixture(before)), normalizePublicApi(fixture(renamed))),
    [],
  );

  const rebound = renamed.replace('(value: A, mapper:', '(value: B, mapper:');
  assert.ok(diffPublicApi(
    normalizePublicApi(fixture(renamed)),
    normalizePublicApi(fixture(rebound)),
  ).some((change) => change.bump === 'major'));
});

test('excludes inline-import dependencies reachable only through private class members', () => {
  const fixture = (secretType) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './service.js': './dist/service.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/service.d.ts':
          "export declare class Service { private secret: import('./secret.js').Secret; value: string; }\n",
        'dist/secret.d.ts': `export interface Secret { value: ${secretType}; }\n`,
      },
      packageFiles: [
        'dist/service.d.ts', 'dist/service.js', 'dist/secret.d.ts', 'dist/secret.js',
      ],
    },
  });

  assert.deepEqual(
    diffPublicApi(
      normalizePublicApi(fixture('string')),
      normalizePublicApi(fixture('number')),
    ),
    [],
  );
});

test('normalizes cyclic diamond graphs deterministically with bounded serialization', () => {
  const files = {
    'dist/consumer.d.ts':
      "import type { Root } from './root.js';\nexport declare function use(value: Root): void;\n",
    'dist/root.d.ts':
      'export interface Root { left: Left; right: Right; }\n' +
      'export interface Left { shared: Shared; }\n' +
      'export interface Right { shared: Shared; }\n' +
      'export interface Shared { root?: Root; value: string; }\n',
  };
  const fixture = (orderedFiles) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: orderedFiles,
      packageFiles: ['dist/consumer.d.ts', 'dist/consumer.js', 'dist/root.d.ts'],
    },
  });
  const forward = normalizePublicApi(fixture(files));
  const reversed = normalizePublicApi(fixture(Object.fromEntries(Object.entries(files).reverse())));
  assert.deepEqual(forward, reversed);
  assert.ok(JSON.stringify(forward).length < 30_000);
  assert.ok(Object.keys(forward.dependencies).length <= 5);
});

test('keeps many public roots over one deep graph serialization-linear', () => {
  const roots = Array.from(
    { length: 120 },
    (_, index) => `export interface Root${index} { value: Common0; }`,
  );
  const chain = Array.from(
    { length: 80 },
    (_, index) => index === 79
      ? `interface Common${index} { value: string; }`
      : `interface Common${index} { next: Common${index + 1}; }`,
  );
  const normalized = normalizePublicApi({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './roots.js': './dist/roots.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: { 'dist/roots.d.ts': [...roots, ...chain].join('\n') },
      packageFiles: ['dist/roots.d.ts', 'dist/roots.js'],
    },
  });

  assert.equal(Object.keys(normalized.dependencies).length, 120);
  assert.ok(JSON.stringify(normalized).length < 500_000);
});

test('tracks global and external-module augmentation contracts', () => {
  const fixture = ({ windowType = 'string', tag = 'lr-x', vueType = 'string' } = {}) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './augmentations.js': './dist/augmentations.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/augmentations.d.ts': [
          'export declare class X {}',
          `declare global { interface Window { lyraValue: ${windowType}; } }`,
          `declare global { interface HTMLElementTagNameMap { '${tag}': X; } }`,
          `declare module 'vue' { interface GlobalComponents { LrX: ${vueType}; } }`,
        ].join('\n'),
      },
      packageFiles: ['dist/augmentations.d.ts', 'dist/augmentations.js'],
    },
  });

  for (const after of [
    { windowType: 'number' },
    { tag: 'lr-y' },
    { vueType: 'number' },
  ]) {
    const changes = diffPublicApi(
      normalizePublicApi(fixture()),
      normalizePublicApi(fixture(after)),
    );
    assert.ok(changes.some(
      (change) => change.id.startsWith('augmentation:') && change.bump === 'major',
    ), JSON.stringify(after));
  }

  const additive = structuredClone(fixture());
  additive.declarations.files['dist/augmentations.d.ts'] +=
    "\ndeclare global { interface Window { lyraAdded?: boolean; } }\n";
  const additiveChanges = diffPublicApi(
    normalizePublicApi(fixture()),
    normalizePublicApi(additive),
  );
  assert.ok(additiveChanges.some(
    (change) => change.id.startsWith('augmentation:') && change.bump === 'minor',
  ));
  assert.equal(additiveChanges.some((change) => change.bump === 'major'), false);
});

test('preserves unresolved external import authorities in public signatures', () => {
  const fixture = (peer, privateOnly = false) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/consumer.d.ts': privateOnly
          ? `import type { Options } from '${peer}';\nexport declare class Service { private options: Options; value: string; }\n`
          : `import type { Options } from '${peer}';\nexport declare function use(value: Options): void;\n`,
      },
      packageFiles: ['dist/consumer.d.ts', 'dist/consumer.js'],
    },
  });

  const changes = diffPublicApi(
    normalizePublicApi(fixture('peer-a')),
    normalizePublicApi(fixture('peer-b')),
  );
  assert.ok(changes.some(
    (change) => change.id === 'subpath-export:./consumer.js:use:contract'
      && change.bump === 'major',
  ));
  assert.deepEqual(
    diffPublicApi(
      normalizePublicApi(fixture('peer-a', true)),
      normalizePublicApi(fixture('peer-b', true)),
    ),
    [],
  );
});

test('collects augmentations from the reachable side-effect-import and re-export closure', () => {
  const fixture = (mode, valueType) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { '.': './dist/index.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/index.d.ts': mode === 'import'
          ? "import './globals.js';\nexport interface X { value: string; }\n"
          : "export * from './globals.js';\nexport interface X { value: string; }\n",
        'dist/globals.d.ts':
          `export {};\ndeclare global { interface Window { transitivelyVisible: ${valueType}; } }\n`,
        'dist/unreachable.d.ts':
          'export {};\ndeclare global { interface Window { ignored: string; } }\n',
      },
      packageFiles: [
        'dist/index.d.ts', 'dist/index.js', 'dist/globals.d.ts', 'dist/unreachable.d.ts',
      ],
    },
  });

  for (const mode of ['import', 're-export']) {
    const before = normalizePublicApi(fixture(mode, 'string'));
    const changes = diffPublicApi(before, normalizePublicApi(fixture(mode, 'number')));
    assert.ok(changes.some(
      (change) => change.id.startsWith('augmentation:') && change.bump === 'major',
    ), mode);
    const changedUnreachable = fixture(mode, 'string');
    changedUnreachable.declarations.files['dist/unreachable.d.ts'] =
      'export {};\ndeclare global { interface Window { ignored: number; } }\n';
    assert.deepEqual(
      before,
      normalizePublicApi(changedUnreachable),
      `${mode} unreachable declarations must stay private`,
    );
  }
});

test('preserves unresolved external re-export authorities', () => {
  const fixture = (statement) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: { 'dist/consumer.d.ts': `${statement}\n` },
      packageFiles: ['dist/consumer.d.ts', 'dist/consumer.js'],
    },
  });
  const statements = [
    (peer) => `export { Options } from '${peer}';`,
    (peer) => `export { default } from '${peer}';`,
    (peer) => `export * as API from '${peer}';`,
    (peer) => `export * from '${peer}';`,
  ];
  for (const statement of statements) {
    const changes = diffPublicApi(
      normalizePublicApi(fixture(statement('peer-a'))),
      normalizePublicApi(fixture(statement('peer-b'))),
    );
    assert.ok(changes.some((change) => change.bump === 'major'), statement('peer-a'));
  }
});

test('binds augmentations and external re-export authorities to public declaration variants', () => {
  const augmentationFixture = (owner) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: {
        './a.js': './dist/a.js',
        './b.js': './dist/b.js',
      },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/a.d.ts': owner === 'a'
          ? 'export {}; declare global { interface Window { routeOwned: string; } }\n'
          : 'export {};\n',
        'dist/b.d.ts': owner === 'b'
          ? 'export {}; declare global { interface Window { routeOwned: string; } }\n'
          : 'export {};\n',
      },
      packageFiles: ['dist/a.d.ts', 'dist/a.js', 'dist/b.d.ts', 'dist/b.js'],
    },
  });
  const moved = diffPublicApi(
    normalizePublicApi(augmentationFixture('a')),
    normalizePublicApi(augmentationFixture('b')),
  );
  assert.ok(moved.some(
    (change) => change.id.startsWith('augmentation:./a.js:') && change.bump === 'major',
  ));
  assert.ok(moved.some(
    (change) => change.id.startsWith('augmentation:./b.js:') && change.bump === 'minor',
  ));

  const authorityFixture = (requirePeer) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: {
        import: { types: './dist/import.d.ts', default: './dist/import.js' },
        require: { types: './dist/require.d.ts', default: './dist/require.js' },
      },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/import.d.ts': "export { Options } from 'peer-a';\n",
        'dist/require.d.ts': `export { Options } from '${requirePeer}';\n`,
      },
      packageFiles: [
        'dist/import.d.ts', 'dist/import.js', 'dist/require.d.ts', 'dist/require.js',
      ],
    },
  });
  const authorityChanges = diffPublicApi(
    normalizePublicApi(authorityFixture('peer-b')),
    normalizePublicApi(authorityFixture('peer-c')),
  );
  assert.ok(authorityChanges.some(
    (change) => change.id.includes(':require.types:') && change.bump === 'major',
  ));
  assert.equal(authorityChanges.some((change) => change.id.includes(':import.types:')), false);
});

test('deduplicates byte-equivalent TypeScript declaration merges', () => {
  const fixture = (source) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './x.js': './dist/x.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: { 'dist/x.d.ts': source },
      packageFiles: ['dist/x.d.ts', 'dist/x.js'],
    },
  });

  for (const source of [
    'export interface X { same: string; }\nexport interface X { same: string; }\n',
    'export {};\ndeclare global { interface Window { same: string; } interface Window { same: string; } }\n',
    'export declare function f(x: string): void;\nexport declare function f(x: string): void;\n',
  ]) {
    assert.doesNotThrow(() => normalizePublicApi(fixture(source)), source);
  }

  assert.throws(
    () => normalizePublicApi(fixture(
      'export interface X { same: string; }\nexport interface X { same: number; }\n',
    )),
    /Duplicate normalized public API entry|Conflicting merged public declaration entry/,
  );
});

test('fails closed on unsupported public TypeScript declaration forms', () => {
  const fixture = (source) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '8.0.0',
      exports: { './x.js': './dist/x.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: { 'dist/x.d.ts': source },
      packageFiles: ['dist/x.d.ts', 'dist/x.js'],
    },
  });

  for (const source of [
    'interface Window { lyra: string; }\n',
    'declare var LyraGlobal: string;\n',
    'export as namespace Lyra;\n',
    'declare const Lyra: { value: string }; export = Lyra;\n',
  ]) {
    assert.throws(
      () => normalizePublicApi(fixture(source)),
      /Unsupported public declaration form/,
      source,
    );
  }
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

// A `:dependencies` entry fingerprints the set of declarations transitively REACHABLE from a public
// export, reduced to an edge count (the full closure is deliberately not retained -- see
// `reachableContractValue`'s comment about hundreds of megabytes). It was classified as an
// unconditional `major`, which made the gate unusable for additive releases: adding one property to
// a widely-composed base class rewrites the fingerprint of every subclass and every subpath that
// re-exports it. In 11.0.0 that produced 287 "breaking" changes, none of which removed or altered a
// single public member.
function dependencySnapshot(version, digest, edgeCount) {
  return {
    packageName: '@aceshooting/lyra-ui',
    version,
    entries: {
      'named-export:LyraSample:dependencies': {
        surface: 'named-export',
        semantic: 'dependency-contract-ref',
        value: digest,
        label: 'named-export:LyraSample reachable declaration contract',
      },
    },
    contracts: {},
    dependencies: { [digest]: { edgeCount } },
  };
}

test('treats a GROWN reachable-declaration graph as minor, not breaking', () => {
  const changes = diffPublicApi(
    dependencySnapshot('1.0.0', 'digest-before', 10),
    dependencySnapshot('1.0.0', 'digest-after', 12),
  );

  assert.equal(changes.length, 1);
  assert.equal(changes[0].bump, 'minor');
  assert.equal(minimumRequiredBump(changes), 'minor');
});

test('keeps a SHRUNK reachable-declaration graph breaking', () => {
  const changes = diffPublicApi(
    dependencySnapshot('1.0.0', 'digest-before', 12),
    dependencySnapshot('1.0.0', 'digest-after', 10),
  );

  assert.equal(changes[0].bump, 'major');
});

test('keeps an equal-sized but rewired reachable graph breaking', () => {
  // Same edge count, different digest: one edge could have been swapped for another, which can
  // hide a removal. Nothing in the retained fingerprint can tell the two apart, so stay strict.
  const changes = diffPublicApi(
    dependencySnapshot('1.0.0', 'digest-before', 11),
    dependencySnapshot('1.0.0', 'digest-after', 11),
  );

  assert.equal(changes[0].bump, 'major');
});

test('keeps a dependency change breaking when either edge count is unknown', () => {
  const before = dependencySnapshot('1.0.0', 'digest-before', 10);
  const after = dependencySnapshot('1.0.0', 'digest-after', 12);
  delete after.dependencies['digest-after'];

  const changes = diffPublicApi(before, after);
  assert.equal(changes[0].bump, 'major');
});

// The generated framework prop types are a union of an object type with many string literals:
// `{'begin-at-zero'?: ...; ...} | 'area' | 'beginAtZero' | ...`. Adding one component property
// widens BOTH halves at once -- the object gains an optional attribute key and the union gains a
// literal. `isTypeWidening` required every old atom to survive verbatim, so the mutated object atom
// looked like a removal and the whole type read as breaking. That single gap accounted for the 39
// `:type` majors and the 39 `:contract` majors in the 10.0.1 -> 11.0.0 diff.
function typeSnapshot(value) {
  return {
    packageName: '@aceshooting/lyra-ui',
    version: '1.0.0',
    entries: {
      'named-export:Sample:type': {
        surface: 'named-export',
        semantic: 'type',
        value,
        label: 'named-export:Sample',
      },
    },
    contracts: {},
    dependencies: {},
  };
}

test('treats a union whose object member widened AND which gained a literal as minor', () => {
  const changes = diffPublicApi(
    typeSnapshot("{'a'?:string}|'x'"),
    typeSnapshot("{'a'?:string;'b'?:number}|'x'|'y'"),
  );

  assert.equal(changes[0].bump, 'minor');
});

test('keeps a union breaking when an old member vanished with no widened counterpart', () => {
  const changes = diffPublicApi(
    typeSnapshot("{'a'?:string}|'x'|'gone'"),
    typeSnapshot("{'a'?:string;'b'?:number}|'x'|'y'"),
  );

  assert.equal(changes[0].bump, 'major');
});

test('keeps a union breaking when its object member NARROWED', () => {
  const changes = diffPublicApi(
    typeSnapshot("{'a'?:string;'b'?:number}|'x'"),
    typeSnapshot("{'a'?:string}|'x'|'y'"),
  );

  assert.equal(changes[0].bump, 'major');
});

// Fingerprint granularity redesign. The edge digest embeds each endpoint's CONTRACT hash, so adding
// a member to any reachable declaration rewrites the fingerprint while leaving the edge COUNT
// unchanged -- which the count comparison could only call `major`. That was the whole remaining
// false-positive class: 24 of 24 majors on an additive change. The snapshot now also retains a
// per-declaration `reachable` map (identity -> contract id), interned exactly like the digest, so a
// changed fingerprint can be explained declaration by declaration and each one classified on its
// own merits through `declarationContractBump`.
function reachableSnapshot(digest, definition, contracts) {
  return {
    packageName: '@aceshooting/lyra-ui',
    version: '1.0.0',
    entries: {
      'named-export:LyraSample:dependencies': {
        surface: 'named-export',
        semantic: 'dependency-contract-ref',
        value: digest,
        label: 'named-export:LyraSample reachable declaration contract',
      },
    },
    contracts,
    dependencies: { [digest]: definition },
  };
}

const memberEntry = (value) => ({ surface: 'named-export', semantic: 'type', value, label: 'm' });

test('classifies a reachable declaration gaining a member as minor', () => {
  const changes = diffPublicApi(
    reachableSnapshot('before', { edgeCount: 7, reachable: { 'mod#Row': 'c1' } }, {
      c1: { 'mod#Row:member:a': memberEntry('string') },
    }),
    reachableSnapshot('after', { edgeCount: 7, reachable: { 'mod#Row': 'c2' } }, {
      c2: {
        'mod#Row:member:a': memberEntry('string'),
        'mod#Row:member:b': memberEntry('number'),
      },
    }),
  );

  assert.equal(changes[0].bump, 'minor');
});

test('classifies a reachable declaration LOSING a member as major', () => {
  const changes = diffPublicApi(
    reachableSnapshot('before', { edgeCount: 7, reachable: { 'mod#Row': 'c1' } }, {
      c1: {
        'mod#Row:member:a': memberEntry('string'),
        'mod#Row:member:b': memberEntry('number'),
      },
    }),
    reachableSnapshot('after', { edgeCount: 7, reachable: { 'mod#Row': 'c2' } }, {
      c2: { 'mod#Row:member:a': memberEntry('string') },
    }),
  );

  assert.equal(changes[0].bump, 'major');
});

test('classifies a declaration becoming UNREACHABLE as major', () => {
  const changes = diffPublicApi(
    reachableSnapshot('before', {
      edgeCount: 7,
      reachable: { 'mod#Row': 'c1', 'mod#Gone': 'c1' },
    }, { c1: { 'mod#Row:member:a': memberEntry('string') } }),
    reachableSnapshot('after', { edgeCount: 6, reachable: { 'mod#Row': 'c1' } }, {
      c1: { 'mod#Row:member:a': memberEntry('string') },
    }),
  );

  assert.equal(changes[0].bump, 'major');
});

test('classifies a newly reachable declaration as minor', () => {
  const changes = diffPublicApi(
    reachableSnapshot('before', { edgeCount: 6, reachable: { 'mod#Row': 'c1' } }, {
      c1: { 'mod#Row:member:a': memberEntry('string') },
    }),
    reachableSnapshot('after', {
      edgeCount: 7,
      reachable: { 'mod#Row': 'c1', 'mod#Added': 'c1' },
    }, { c1: { 'mod#Row:member:a': memberEntry('string') } }),
  );

  assert.equal(changes[0].bump, 'minor');
});

test('falls back to the edge count when a snapshot predates the reachable map', () => {
  // A baseline produced by an older release has no `reachable`, so the comparison degrades to the
  // count rule rather than failing or silently passing.
  const changes = diffPublicApi(
    reachableSnapshot('before', { edgeCount: 7 }, {}),
    reachableSnapshot('after', { edgeCount: 9 }, {}),
  );
  assert.equal(changes[0].bump, 'minor');

  const shrunk = diffPublicApi(
    reachableSnapshot('before', { edgeCount: 9 }, {}),
    reachableSnapshot('after', { edgeCount: 7 }, {}),
  );
  assert.equal(shrunk[0].bump, 'major');
});
