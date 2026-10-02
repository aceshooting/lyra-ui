import assert from 'node:assert/strict';
import test from 'node:test';
import { baseline, additive, breaking } from './public-api-diff-test-fixtures.mjs';
import { diffPublicApi, minimumRequiredBump, normalizePublicApi, normalizeType } from './public-api-diff.mjs';

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

function inheritedMethodFixture(ownMembers, baseMembers = 'disconnectedCallback(): void;', middleMembers = '') {
  return {
    packageJson: {
      name: '@aceshooting/lyra-ui', version: '1.0.0',
      exports: { './sample.js': './dist/sample.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/base.d.ts': `export declare class Base<T> { ${baseMembers} }`,
        'dist/sample.d.ts': `import { Base as Parent } from './base.js';
          declare class Middle extends Parent<string> { ${middleMembers} }
          export declare class Sample extends Middle { ${ownMembers} }
          export type Props = Partial<Sample>;`,
      },
      packageFiles: ['dist/base.d.ts', 'dist/sample.d.ts', 'dist/sample.js'],
    },
  };
}

test('identical inherited method overrides do not add API or change reachable contracts', () => {
  const baseMembers = 'connectedCallback(): void; disconnectedCallback(): void;';
  const before = normalizePublicApi(inheritedMethodFixture('private pendingFrame;', baseMembers));
  const after = normalizePublicApi(inheritedMethodFixture(
    'private pendingFrame; private cancelFrame; disconnectedCallback(): void;', baseMembers,
  ));
  assert.deepEqual(diffPublicApi(before, after), []);
  assert.deepEqual(diffPublicApi(after, before), []);
});

test('inherited method normalization retains new methods and changed signatures', () => {
  for (const ownMembers of [
    'newMethod(): void;',
    'disconnectedCallback(reason: string): void;',
    'disconnectedCallback(): string;',
    'protected disconnectedCallback(): void;',
    'static disconnectedCallback(): void;',
    'disconnectedCallback(): void; disconnectedCallback(reason: string): void;',
  ]) {
    const before = normalizePublicApi(inheritedMethodFixture(''));
    const after = normalizePublicApi(inheritedMethodFixture(ownMembers));
    assert.ok(diffPublicApi(before, after).length > 0, ownMembers);
  }
});

test('an intervening declaration blocks matching a more distant ancestor method', () => {
  const before = normalizePublicApi(inheritedMethodFixture('', 'disconnectedCallback(): void;',
    'protected disconnectedCallback(): void;'));
  const after = normalizePublicApi(inheritedMethodFixture('disconnectedCallback(): void;',
    'disconnectedCallback(): void;', 'protected disconnectedCallback(): void;'));
  assert.ok(diffPublicApi(before, after).length > 0);
});

test('method normalization does not equate unresolved scoped types or generic parameters', () => {
  const fixture = (own) => {
    const input = inheritedMethodFixture(own, 'read(): T;');
    input.declarations.files['dist/sample.d.ts'] += "\ntype T = 'narrow';";
    return normalizePublicApi(input);
  };
  const before = fixture('');
  const after = fixture('read(): T;');
  assert.ok(diffPublicApi(before, after).length > 0);
});

test('changed overrides retain breaking signature and visibility classification', () => {
  const before = normalizePublicApi(inheritedMethodFixture('disconnectedCallback(): void;'));
  for (const ownMembers of [
    'disconnectedCallback(reason: string): void;',
    'disconnectedCallback(): string;',
    'protected disconnectedCallback(): void;',
  ]) {
    const after = normalizePublicApi(inheritedMethodFixture(ownMembers));
    assert.equal(minimumRequiredBump(diffPublicApi(before, after)), 'major', ownMembers);
  }
});

test('base method changes remain breaking through an unchanged explicit override', () => {
  const before = normalizePublicApi(inheritedMethodFixture('disconnectedCallback(): void;'));
  const after = normalizePublicApi(inheritedMethodFixture('disconnectedCallback(): void;',
    'disconnectedCallback(reason: string): void;'));
  assert.equal(minimumRequiredBump(diffPublicApi(before, after)), 'major');
});

test('inherited overload groups compare as a whole and retain removals', () => {
  const overloads = 'read(): string; read(index: number): string;';
  const before = normalizePublicApi(inheritedMethodFixture('', overloads));
  const identical = normalizePublicApi(inheritedMethodFixture(overloads, overloads));
  assert.deepEqual(diffPublicApi(before, identical), []);
  const narrowed = normalizePublicApi(inheritedMethodFixture('read(): string;', overloads));
  assert.equal(minimumRequiredBump(diffPublicApi(before, narrowed)), 'major');
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

test('treats a real multi-argument generated framework prop type gaining one event as minor', () => {
  // A faithful reproduction of the real generated shape that broke: LyraReactElementProps<Host,
  // PropsUnion, {}, EventMap, EventsUnion, CssPropsUnion, AttrAliases> gaining one member in the
  // EventsUnion argument only.
  const changes = diffPublicApi(
    typeSnapshot(
      "LyraReactElementProps<LyraHeatmap,'accessibleCells'|'annotations'|'data',{},LyraHeatmapEventMap,'lr-cell-click','--lr-heatmap-scale-hi'|'--lr-heatmap-scale-lo',{'cell-size'?:LyraHeatmap['cellSize']}>",
    ),
    typeSnapshot(
      "LyraReactElementProps<LyraHeatmap,'accessibleCells'|'annotations'|'data',{},LyraHeatmapEventMap,'lr-cell-click'|'lr-matrix-geometry-change','--lr-heatmap-scale-hi'|'--lr-heatmap-scale-lo',{'cell-size'?:LyraHeatmap['cellSize']}>",
    ),
  );

  assert.equal(changes[0].bump, 'minor');
});

test('treats the generated framework prop type gaining its first event as minor', () => {
  const changes = diffPublicApi(
    typeSnapshot(
      "LyraReactElementProps<LyraTimeline,'items',{}, {},never,'--lr-timeline-gap',{}>",
    ),
    typeSnapshot(
      "LyraReactElementProps<LyraTimeline,'collision'|'items',{},LyraTimelineEventMap,'lr-cluster-activate','--lr-timeline-cluster-size'|'--lr-timeline-gap',{}>",
    ),
  );

  assert.equal(changes[0].bump, 'minor');
});

test('keeps an arbitrary generic changing from an empty object to a named type breaking', () => {
  const changes = diffPublicApi(
    typeSnapshot('Arbitrary<{},never>'),
    typeSnapshot("Arbitrary<RequiredMap,'event'>"),
  );

  assert.equal(changes[0].bump, 'major');
});

test('resolves a unique type alias before classifying a public member widening', () => {
  const fixture = (memberType, aliasType) => ({
    packageJson: {
      name: '@aceshooting/lyra-ui',
      version: '1.0.0',
      exports: { '.': { types: './dist/lyra.d.ts', default: './dist/lyra.js' } },
    },
    manifest: { modules: [] },
    declarations: {
      named: `${aliasType ? `export type ZoomValue = ${aliasType};\n` : ''}` +
        `export interface HeatmapOptions { radius?: ${memberType}; }\n`,
    },
  });
  const changes = diffPublicApi(
    normalizePublicApi(fixture('number')),
    normalizePublicApi(fixture('ZoomValue', 'number | readonly (readonly [number, number])[]')),
  );

  assert.equal(minimumRequiredBump(changes), 'minor');
  assert.equal(
    changes.some((change) =>
      change.id.includes('HeatmapOptions') && change.bump === 'major'),
    false,
  );
});

test('keeps an ambiguous type alias replacement breaking', () => {
  const before = typeSnapshot('number');
  const after = typeSnapshot('Value');
  after.typeAliases = { Value: ['number|string', 'number|boolean'] };

  assert.equal(diffPublicApi(before, after)[0].bump, 'major');
});

function tupleElementAliasFixture(tuple, {
  alias = '(typeof TAGS)[number]',
  parameters = '',
  extraExports = '',
  payload = 'string | number',
} = {}) {
  return {
    packageJson: {
      name: '@aceshooting/lyra-ui', version: '1.0.0',
      exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
    },
    manifest: { modules: [] },
    declarations: {
      namedEntry: 'dist/index.d.ts',
      named: `export type { Tag } from './tags.js';
        export type { EventMap, FrameworkProps } from './consumer.js'; ${extraExports}`,
      files: {
        'dist/tags.d.ts': `export declare const TAGS: ${tuple};
          export type Tag${parameters} = ${alias};`,
        'dist/consumer.d.ts': `import type { Tag } from './tags.js';
          export interface EventMap { loaded: CustomEvent<{ tag: Tag; value: ${payload} }>; }
          export type FrameworkProps = { onLoaded?: (event: EventMap['loaded']) => void };`,
      },
      packageFiles: ['dist/index.d.ts', 'dist/index.js', 'dist/tags.d.ts', 'dist/consumer.d.ts'],
    },
  };
}

test('projects readonly string tuple elements without propagating tuple insertion breaks', () => {
  const before = normalizePublicApi(tupleElementAliasFixture("readonly ['lr-a', 'lr-c']"));
  const after = normalizePublicApi(tupleElementAliasFixture("readonly ['lr-a', 'lr-b', 'lr-c']"));
  const changes = diffPublicApi(before, after);
  assert.equal(after.entries['named-export:Tag:type'].value, normalizeType('"lr-a"|"lr-b"|"lr-c"'));
  assert.deepEqual(after.typeAliases.Tag, [after.entries['named-export:Tag:type'].value]);
  assert.equal(minimumRequiredBump(changes), 'minor');
  for (const name of ['EventMap', 'FrameworkProps']) {
    assert.ok(changes.some((change) =>
      change.id === `named-export:${name}:dependencies` && change.bump === 'minor'));
  }
  assert.equal(minimumRequiredBump(diffPublicApi(after, before)), 'major');
});

test('tuple element unions ignore ordering and repeated literal elements', () => {
  const before = normalizePublicApi(tupleElementAliasFixture("readonly ['lr-a', 'lr-c']"));
  const after = normalizePublicApi(tupleElementAliasFixture("readonly ['lr-c', 'lr-a', 'lr-c']"));
  assert.deepEqual(diffPublicApi(before, after), []);
  assert.deepEqual(diffPublicApi(after, before), []);
});

test('tuple projection resolves import aliases and namespace-qualified variables', () => {
  for (const [declaration, query] of [
    ["import { TAGS as Registry } from './registry.js';", 'Registry'],
    ["import * as Registry from './registry.js';", 'Registry.TAGS'],
    ['declare namespace Registry { const TAGS: TUPLE; }', 'Registry.TAGS'],
  ]) {
    const fixture = (tuple) => {
      const input = tupleElementAliasFixture(tuple);
      input.declarations.files['dist/registry.d.ts'] = `export declare const TAGS: ${tuple};`;
      input.declarations.files['dist/tags.d.ts'] = `${declaration.replace('TUPLE', tuple)}
        export type Tag = (typeof ${query})[number];`;
      input.declarations.packageFiles.push('dist/registry.d.ts');
      return normalizePublicApi(input);
    };
    assert.equal(minimumRequiredBump(diffPublicApi(
      fixture("readonly ['lr-a', 'lr-c']"),
      fixture("readonly ['lr-a', 'lr-b', 'lr-c']"),
    )), 'minor', query);
  }
});

test('tuple projection preserves raw tuple and fixed-index contracts', () => {
  for (const options of [
    { extraExports: "export { TAGS } from './tags.js';" },
    { alias: 'typeof TAGS' },
    { alias: '(typeof TAGS)[1]' },
    { alias: "(typeof TAGS)['length']" },
    { alias: '{ element: (typeof TAGS)[number]; tuple: typeof TAGS }' },
  ]) {
    const changes = diffPublicApi(
      normalizePublicApi(tupleElementAliasFixture("readonly ['lr-a', 'lr-c']", options)),
      normalizePublicApi(tupleElementAliasFixture("readonly ['lr-a', 'lr-b', 'lr-c']", options)),
    );
    assert.equal(minimumRequiredBump(changes), 'major', JSON.stringify(options));
  }
});

test('tuple projection retains conservative dependencies for unsupported tuple shapes', () => {
  for (const [before, after, options] of [
    ['readonly []', "readonly ['lr-a']", {}],
    ["['lr-a', 'lr-c']", "['lr-a', 'lr-b', 'lr-c']", {}],
    ["readonly ['lr-a', string]", "readonly ['lr-a', 'lr-b', string]", {}],
    ["readonly ['lr-a', ...string[]]", "readonly ['lr-a', 'lr-b', ...string[]]", {}],
    ["readonly ['lr-a', 'lr-c'?]", "readonly ['lr-a', 'lr-b', 'lr-c'?]", {}],
    ["readonly ['lr-a', 'lr-c']", "readonly ['lr-a', 'lr-b', 'lr-c']", { parameters: '<T = unknown>' }],
  ]) {
    assert.equal(minimumRequiredBump(diffPublicApi(
      normalizePublicApi(tupleElementAliasFixture(before, options)),
      normalizePublicApi(tupleElementAliasFixture(after, options)),
    )), 'major', before);
  }
});

test('tuple element additions do not hide narrowing elsewhere in a reachable event contract', () => {
  const before = normalizePublicApi(tupleElementAliasFixture("readonly ['lr-a', 'lr-c']"));
  const after = normalizePublicApi(tupleElementAliasFixture("readonly ['lr-a', 'lr-b', 'lr-c']", {
    payload: 'string',
  }));
  const changes = diffPublicApi(before, after);
  assert.equal(minimumRequiredBump(changes), 'major');
  assert.ok(changes.some((change) =>
    change.id === 'named-export:FrameworkProps:dependencies' && change.bump === 'major'));
});

test('tuple projection leaves unresolved references and duplicate declarations unprojected', () => {
  const unresolved = normalizePublicApi(tupleElementAliasFixture("readonly ['lr-a']", {
    alias: '(typeof Missing)[number]',
  }));
  assert.equal(unresolved.entries['named-export:Tag:type'].value, normalizeType('(typeof Missing)[number]'));
  const fixture = (tuple) => {
    const input = tupleElementAliasFixture(tuple);
    input.declarations.files['dist/tags.d.ts'] += `\nexport declare const TAGS: ${tuple};`;
    return normalizePublicApi(input);
  };
  const before = fixture("readonly ['lr-a', 'lr-c']");
  const after = fixture("readonly ['lr-a', 'lr-b', 'lr-c']");
  assert.equal(after.entries['named-export:Tag:type'].value, normalizeType('(typeof TAGS)[number]'));
  assert.equal(minimumRequiredBump(diffPublicApi(before, after)), 'major');
});

test('tuple projection does not select one ambiguous star re-export authority', () => {
  const fixture = (tuple) => {
    const input = tupleElementAliasFixture(tuple);
    input.declarations.files['dist/tags.d.ts'] = `import { TAGS } from './registry.js';
      export type Tag = (typeof TAGS)[number];`;
    input.declarations.files['dist/registry.d.ts'] = "export * from './a.js'; export * from './b.js';";
    input.declarations.files['dist/a.d.ts'] = `export declare const TAGS: ${tuple};`;
    input.declarations.files['dist/b.d.ts'] = "export declare const TAGS: readonly ['other'];";
    return normalizePublicApi(input);
  };
  const before = fixture("readonly ['lr-a', 'lr-c']");
  const after = fixture("readonly ['lr-a', 'lr-b', 'lr-c']");
  assert.equal(after.entries['named-export:Tag:type'].value, normalizeType('(typeof TAGS)[number]'));
  assert.equal(minimumRequiredBump(diffPublicApi(before, after)), 'major');
});

test('treats a leading-bar single-member union gaining a member as minor', () => {
  const changes = diffPublicApi(
    typeSnapshot("| 'lr-cell-click'"),
    typeSnapshot("| 'lr-cell-click'\n  | 'lr-matrix-geometry-change'"),
  );

  assert.equal(changes[0].bump, 'minor');
});

test('treats a generic argument widening from one leading-bar event to two as minor', () => {
  // Mirrors the real generated shape: LyraReactElementProps<Host, PropsUnion, {}, EventMap,
  // EventsUnion, CssPropsUnion, AttrAliases> -- only the events-union argument changes.
  const changes = diffPublicApi(
    typeSnapshot("Wrap<Host,'a'|'b',{},EventMap,| 'lr-cell-click','--x',{'a'?:X}>"),
    typeSnapshot(
      "Wrap<Host,'a'|'b',{},EventMap,| 'lr-cell-click'\n  | 'lr-matrix-geometry-change','--x',{'a'?:X}>",
    ),
  );

  assert.equal(changes[0].bump, 'minor');
});

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

function callableFixture(options, { extra = '', parameters = undefined, result = 'void', metadata = {} } = {}) {
  const args = parameters ?? [{ name: 'options', type: { text: options }, optional: true }];
  return {
    packageJson: { name: '@aceshooting/lyra-ui', version: '1.0.0', exports: {
      '.': { types: './dist/lyra.d.ts', default: './dist/lyra.js' },
    } },
    manifest: { modules: [{ path: 'sample.js', declarations: [{ kind: 'class', name: 'Sample',
      customElement: true, tagName: 'lr-sample', members: [{ kind: 'method', name: 'open',
        parameters: args, return: { type: { text: result } }, ...metadata,
      }],
    }] }] },
    declarations: { named: `export class Sample { open(options?: ${options}): ${result}; ${extra} }` },
  };
}

test('recognizes optional method option additions in CEM and reachable declaration contracts', () => {
  const changes = diffPublicApi(
    normalizePublicApi(callableFixture('{ target?: HTMLElement }')),
    normalizePublicApi(callableFixture('{ target?: HTMLElement; boundary?: Element }')),
  );
  assert.equal(minimumRequiredBump(changes), 'minor');
  assert.equal(changes.some((change) => change.bump === 'major'), false);
});

test('retains method narrowing, required options, return, defaults and metadata breaks', () => {
  const original = normalizePublicApi(callableFixture('{ target?: HTMLElement }'));
  for (const next of [
    callableFixture('{ target?: HTMLButtonElement }'),
    callableFixture('{ target: HTMLElement }'),
    callableFixture('{ target?: HTMLElement; boundary: Element }'),
    callableFixture('{ target?: HTMLElement; boundary?: Element }', { result: 'string' }),
    callableFixture('{ target?: HTMLElement; boundary?: Element }', { result: 'void | string' }),
    callableFixture('{ target?: HTMLElement; boundary?: Element }', { metadata: { reflects: true } }),
    callableFixture('{ target?: HTMLElement; boundary?: Element }', { parameters: [
      { name: 'options', type: { text: '{ target?: HTMLElement; boundary?: Element }' }, optional: true, default: '{}' },
    ] }),
    callableFixture('{ target?: HTMLElement; boundary?: Element }', { parameters: [
      { name: 'options', type: { text: '{ target?: HTMLElement; boundary?: Element }' } },
    ] }),
  ]) assert.equal(minimumRequiredBump(diffPublicApi(original, normalizePublicApi(next))), 'major');
});

test('matches method overloads individually without concealing a removed or narrowed overload', () => {
  const fixture = (methods) => ({
    packageJson: { name: '@aceshooting/lyra-ui', version: '1.0.0', exports: {
      '.': { types: './dist/lyra.d.ts', default: './dist/lyra.js' },
    } },
    manifest: { modules: [] },
    declarations: { named: `export class Sample { ${methods} }` },
  });
  const old = normalizePublicApi(fixture('open(value: string): void; open(value: number): void;'));
  const added = normalizePublicApi(fixture('open(value: string): void; open(value: number): void; open(value: boolean): void;'));
  assert.equal(minimumRequiredBump(diffPublicApi(old, added)), 'minor');
  const removed = normalizePublicApi(fixture('open(value: string | number): void;'));
  assert.equal(minimumRequiredBump(diffPublicApi(old, removed)), 'major');
  const narrowed = normalizePublicApi(fixture('open(value: string): void; open(value: 1): void;'));
  assert.equal(minimumRequiredBump(diffPublicApi(old, narrowed)), 'major');
});

test('accepts optional positional parameters but rejects parameter and method removals', () => {
  const fixture = (parameters, signature) => {
    const input = callableFixture('string', { parameters });
    input.declarations.named = `export class Sample { ${signature} }`;
    return normalizePublicApi(input);
  };
  const value = { name: 'value', type: { text: 'string' } };
  const boundary = { name: 'boundary', type: { text: 'Element' }, optional: true };
  const before = fixture([value], 'open(value: string): void;');
  assert.equal(minimumRequiredBump(diffPublicApi(before,
    fixture([value, boundary], 'open(value: string, boundary?: Element): void;'))), 'minor');
  assert.equal(minimumRequiredBump(diffPublicApi(before,
    fixture([], 'open(): void;'))), 'major');
  const removed = callableFixture('string');
  removed.manifest.modules[0].declarations[0].members = [];
  removed.declarations.named = 'export class Sample {}';
  assert.equal(minimumRequiredBump(diffPublicApi(before, normalizePublicApi(removed))), 'major');
});

test('does not erase method generic constraints or defaults when matching signatures', () => {
  const fixture = (generic) => normalizePublicApi({
    packageJson: { name: '@aceshooting/lyra-ui', version: '1.0.0', exports: {
      '.': { types: './dist/lyra.d.ts', default: './dist/lyra.js' },
    } }, manifest: { modules: [] },
    declarations: { named: `export class Sample { open<${generic}>(value: T): void; }` },
  });
  const before = fixture("T extends string = 'a'");
  for (const generic of ["T extends string = 'b'", 'T extends number = 1']) {
    assert.equal(minimumRequiredBump(diffPublicApi(before, fixture(generic))), 'major');
  }
});

test('does not assume covariance of generic callback parameters', () => {
  const fixture = (type) => {
    const input = callableFixture(type, { parameters: [{ name: 'callback', type: { text: type } }] });
    input.declarations.named = `type Sink<T> = (value: T) => void; export class Sample { open(callback: ${type}): void; }`;
    return normalizePublicApi(input);
  };
  assert.equal(minimumRequiredBump(diffPublicApi(fixture("Sink<'a'>"), fixture("Sink<'a' | 'b'>"))), 'major');
});

test('keeps required-to-rest parameter changes breaking', () => {
  const fixture = (parameter) => normalizePublicApi({
    packageJson: { name: '@aceshooting/lyra-ui', version: '1.0.0', exports: {
      '.': { types: './dist/lyra.d.ts', default: './dist/lyra.js' },
    } }, manifest: { modules: [] },
    declarations: { named: `export class Sample { open(${parameter}): void; }` },
  });
  assert.equal(minimumRequiredBump(diffPublicApi(fixture('value: string'), fixture('...value: string[]'))), 'major');
});

test('rechecks reachable contracts when snapshots change between comparisons', () => {
  const before = reachableSnapshot('before', { edgeCount: 1, reachable: { 'mod#Row': 'c1' } }, {
    c1: { 'mod#Row:member:a': memberEntry('string') },
  });
  const after = reachableSnapshot('after', { edgeCount: 1, reachable: { 'mod#Row': 'c2' } }, {
    c2: { 'mod#Row:member:a': memberEntry('string'), 'mod#Row:member:b': memberEntry('number') },
  });
  assert.equal(minimumRequiredBump(diffPublicApi(before, after)), 'minor');
  delete after.contracts.c2['mod#Row:member:a'];
  assert.equal(minimumRequiredBump(diffPublicApi(before, after)), 'major');
});


function declarationCommentFixture(geometryMembers) {
  return {
    packageJson: {
      name: '@aceshooting/lyra-ui', version: '1.0.0',
      exports: { '.': './dist/geometry.js' },
    },
    manifest: { modules: [] },
    declarations: {
      named: "export type { Geometry, GeometryEvents } from './geometry.js';",
      files: {
        'dist/bounds.d.ts': 'export interface Bounds { value: number; }',
        'dist/geometry.d.ts': `import type { Bounds as ImportedBounds } from './bounds.js';
          export type Geometry = { ${geometryMembers} };
          export interface GeometryEvents { 'lr-geometry-change': CustomEvent<Geometry>; }
          declare global {
            interface HTMLElementEventMap { 'lr-geometry-change': CustomEvent<Geometry>; }
          }`,
      },
      packageFiles: ['dist/bounds.d.ts', 'dist/geometry.d.ts', 'dist/geometry.js'],
    },
  };
}

test('declaration comments do not become members or alter reachable type contracts', () => {
  const clean = declarationCommentFixture(`
    cellSize: number;
    cellWidth?: number;
    nested?: { bounds: ImportedBounds };
    literal?: '/* literal; { < > } */';
    url?: 'https://example.test/cell;size';
    staticTemplate?: \`/* static; */ // tail\`;
    label?: \`cell-\${string}\`;
  `);
  const documented = declarationCommentFixture(`
    /** Cell pitch; café 🚀; unmatched { < ' punctuation. */
    cellSize: /* inline; } > */ number;
    /** Painted bounds; omitted for default cells. */ cellWidth?: number;
    // Nested bounds; unmatched } > ' punctuation.
    nested?: { /* Coordinates; } < */ bounds: ImportedBounds };
    literal?: '/* literal; { < > } */';
    url?: 'https://example.test/cell;size';
    staticTemplate?: \`/* static; */ // tail\`;
    label?: \`cell-\${/* interpolation; } > */ string}\`;
  `);
  const before = normalizePublicApi(clean);
  const after = normalizePublicApi(documented);
  assert.deepEqual(after, before);
  assert.deepEqual(diffPublicApi(before, after), []);
  assert.deepEqual(diffPublicApi(after, before), []);
  assert.ok(after.entries['named-export:Geometry:property:cellWidth']);
  assert.ok(Object.keys(after.entries).every((key) => !key.includes('omitted for default cells')));
});

test('commented optional type members remain additive through event dependencies', () => {
  const before = normalizePublicApi(declarationCommentFixture(`
    cellSize: number;
    /** Custom painted bounds; omitted for the default separators. */ cellWidth?: number;
  `));
  const after = normalizePublicApi(declarationCommentFixture(`
    cellSize: number;
    /** Vertical row pitch; omitted when it equals cellSize. */ rowHeight?: number;
    /** Painted bounds; present for rectangular rows, omitted for default cells. */ cellWidth?: number;
  `));
  const changes = diffPublicApi(before, after);
  assert.equal(minimumRequiredBump(changes), 'minor');
  assert.ok(changes.every((change) => change.bump !== 'major'));
  assert.ok(after.entries['named-export:Geometry:property:rowHeight']);
  assert.equal(minimumRequiredBump(diffPublicApi(after, before)), 'major');
});

test('ignoring declaration comments preserves real member and literal breaking changes', () => {
  const members = `
    /** Custom painted bounds; omitted for default cells. */ cellWidth?: number;
    literal: '/* original; */';
    url: 'https://example.test/original;';
    template: \`/* original; */ // original;\`;
  `;
  const before = normalizePublicApi(declarationCommentFixture(members));
  for (const changed of [
    members.replace('cellWidth?: number;', 'cellWidth?: string;'),
    members.replace('cellWidth?: number;', ''),
    members.replace('/* original; */', '/* changed; */'),
    members.replace('https://example.test/original;', 'https://example.test/changed;'),
    members.replace('template: `/* original; */', 'template: `/* changed; */'),
    members.replace('// original;', '// changed;'),
  ]) {
    assert.equal(
      minimumRequiredBump(diffPublicApi(before, normalizePublicApi(declarationCommentFixture(changed)))),
      'major',
      changed,
    );
  }
});
