import assert from 'node:assert/strict';
import test from 'node:test';
import { baseline } from './public-api-diff-test-fixtures.mjs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { normalizePublicApi, normalizeType, readPackageApi } from './public-api-diff.mjs';

test('reads a typed non-component package from its root declaration entries', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-public-api-flags-'));
  try {
    writeFileSync(
      path.join(root, 'package.json'),
      `${JSON.stringify({
        name: '@aceshooting/lyra-flags',
        version: '2.2.0',
        files: ['index.js', 'index.d.ts', 'standard.js', 'standard.d.ts'],
        exports: {
          '.': { types: './index.d.ts', default: './index.js' },
          './standard': { types: './standard.d.ts', default: './standard.js' },
        },
      })}\n`,
    );
    writeFileSync(path.join(root, 'index.js'), 'export const flagUrl = () => undefined;\n');
    writeFileSync(path.join(root, 'index.d.ts'), 'export declare function flagUrl(code: string): Promise<string | undefined>;\n');
    writeFileSync(path.join(root, 'standard.js'), 'export const flagUrl = () => undefined;\n');
    writeFileSync(
      path.join(root, 'standard.d.ts'),
      'export declare function flagUrl(code: string): Promise<string | undefined>;\n',
    );

    const input = readPackageApi(root);
    const snapshot = normalizePublicApi(input);

    assert.equal(input.manifest.modules.length, 0);
    assert.ok(snapshot.entries['named-export:flagUrl']);
    assert.ok(snapshot.entries['subpath-export:./standard:flagUrl']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

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

// A single-member union formatted with a leading bar -- exactly how the generated framework prop
// types write every union, including a component's OWN event-name union when it currently has
// only one event ("| 'lr-cell-click'") -- retained a literal leading "|" in its normalized form,
// because normalizeType's union branch only fires when splitting produces MORE than one non-empty
// part; filtering the empty segment before the leading bar collapses a genuine one-member union
// back down to length 1, so it falls through to the plain-string path with the bar still attached.
// That extra "|" then reappears as a bogus empty-string atom when typeAtoms() re-splits the
// normalized text, desyncing the atom-count comparison the moment a second member is added and
// making the whole addition read as a removal-plus-unrelated-addition instead of a widening.
// Real-world trigger: <lr-heatmap> gaining lr-matrix-geometry-change as its second event.
// normalizeBalancedChildren() recursed into a generic instantiation's bracket content
// (`Foo<Arg1, Arg2, Arg3>`) by handing the WHOLE comma-separated argument list to normalizeType()
// as one blob. Top-level union splitting inside that blob can't see the argument boundaries, so
// one argument's bare union (e.g. a props-name union) merges with a DIFFERENT argument's bare
// union (e.g. a CSS custom-property union) into a single alphabetized bag of atoms, and every
// non-union argument (an object literal, a bare type reference) gets swallowed into whichever
// atom it happened to land next to at a comma boundary. The generated framework prop types are
// exactly `LyraReactElementProps<Host, PropsUnion, {}, EventMap, EventsUnion, CssPropsUnion,
// AttrAliases>` -- seven arguments, several of them bare unions -- so this fires on real
// component declarations, not just contrived fixtures, and desyncs an otherwise-correct additive
// diff (e.g. a component's event union gaining a member) into an unrecognizable, unmatched mess
// that isTypeWidening can't classify as widening.
test('normalizeType keeps each generic argument independent, not merged across commas', () => {
  const before = normalizeType("Wrap<Host,'a'|'b',{},EventMap,'x','p'|'q',{'k'?:V}>");
  // Argument boundaries must survive: the 'a'|'b' props union and the 'p'|'q' css union must NOT
  // merge into one bag, and the bare 'x' event argument and the {'k'?:V} object argument must not
  // be absorbed into either union.
  assert.equal(before, "Wrap<Host,'a'|'b',{},EventMap,'x','p'|'q',{'k'?:V}>");
});

test('normalizeType strips a leading bar from a single-member union', () => {
  assert.equal(normalizeType("| 'lr-cell-click'"), normalizeType("'lr-cell-click'"));
});
