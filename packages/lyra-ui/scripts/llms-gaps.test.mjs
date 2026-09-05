#!/usr/bin/env node
// Standalone tests for scripts/llms-gaps.mjs -- plain `node:assert`, not wired into
// the wtr suite (this checker reads markdown text, it does not render components). Run directly:
// `node scripts/llms-gaps.test.mjs`.
// `mentionsName` replaced a plain `section.text.includes(n)` substring check that produced a
// confirmed false pass: `lr-graph-query-builder`'s `label`/`hint`/`error` CSS *parts* were reported
// as "documented" purely because those exact words already occurred elsewhere in the section as
// *property* names ("the `label` property") -- a coincidental substring, not real documentation of
// the parts. The same substring bug independently false-passed a `change` *event* (a real, undocu-
// mented member) because `change` is a literal substring of the unrelated `lr-change` event name and
// of ordinary prose ("since changed"), and a `click()` *method* because `click` is a substring of
// `click-to-start`/`click-to-stop`. Both cases are reproduced below as regression fixtures.

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectGaps,
  contractBlockMentionsName,
  contractDeclarationBlock,
  exportedContractNames,
  inheritsAllPublicSurface,
  mentionsName,
  ownsToken,
} from './llms-gaps.mjs';
import {
  publicSourceContractModules,
  sourceContractCensus,
  sourceContractKey,
  validateSourceContractBaseline,
} from './llms-source-contracts.mjs';

// Quiet by default (it runs inside the `pnpm lint` contract-policy chain); `--verbose` prints the
// per-case lines.
const verbose = process.argv.includes('--verbose');
let failures = 0;
let passes = 0;
function test(name, fn) {
  try {
    fn();
    passes += 1;
    if (verbose) console.log(`ok - ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(err instanceof Error ? err.stack : err);
  }
}

function withSourceContractFixture(files, fn) {
  const fixtureDir = mkdtempSync(path.join(os.tmpdir(), 'lyra-llms-contracts-'));
  try {
    for (const [relativePath, source] of Object.entries(files)) {
      const file = path.join(fixtureDir, relativePath);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, source);
    }
    return fn(fixtureDir);
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
}

function baselineOwner(contract, status = 'documented') {
  return {
    module: contract.module,
    exportName: contract.exportName,
    kind: contract.kind,
    fingerprint: contract.fingerprint,
    routes: contract.routes,
    ...(status === 'documented'
      ? {
          document: 'llms/shared.md',
          family: 'shared',
          locator: { kind: 'utility', name: 'fixture', declaration: contract.exportName },
        }
      : {}),
  };
}

// --- the bug: a name that is only a substring of unrelated prose or a different identifier --------
// (these must still count as a GAP -- i.e. mentionsName must return false, so `miss()` keeps them)

test('a name that is only a substring of a different, longer hyphenated identifier is NOT a mention', () => {
  // The real `change` event vs. the unrelated `lr-change` event -- the pre-fix regression.
  const text = 'Fired alongside `lr-change` for native form bindings.';
  assert.equal(mentionsName(text, 'change'), false);
});

test('a name that only occurs inside a hyphenated compound word is NOT a mention', () => {
  // The real `click()` method vs. prose describing UX behavior with compound words.
  const text = '`mode="toggle"` is click-to-start/click-to-stop with `aria-pressed`.';
  assert.equal(mentionsName(text, 'click'), false);
});

test('a name that only occurs as a substring inside a plain (non-hyphenated) word is NOT a mention', () => {
  const text = 'A mislabeled entry is dropped from the catalog.';
  assert.equal(mentionsName(text, 'label'), false);
});

test('a shorter token name is not satisfied by a longer hyphenated identifier that starts with it', () => {
  // `--lr-push-to-talk-size` must not count as a mention of `--lr-push-to-talk-size-large`, and
  // (the direction that actually matters here) the reverse: a shorter name is not satisfied merely
  // because a longer identifier sharing its prefix appears in the text.
  const text = 'See `--lr-push-to-talk-size-large` for the oversized variant.';
  assert.equal(mentionsName(text, '--lr-push-to-talk-size'), false);
});

// --- the correct shapes: a name that genuinely appears as itself must still be a mention -----------
// (mentionsName must return true, so `miss()` does NOT flag these as gaps)

test('a name surrounded by backticks (inline code) is a mention', () => {
  const text = '**Events:** `change` (`Event`, no detail) -- fired alongside `lr-change`.';
  assert.equal(mentionsName(text, 'change'), true);
});

test('a name immediately followed by `()` (a documented method call) is a mention', () => {
  const text = '- `click()` -- Programmatically starts or stops a take.';
  assert.equal(mentionsName(text, 'click'), true);
});

test('a name that is itself hyphenated is a mention only when it appears whole', () => {
  const text = '**CSS parts:** `base`, `label`, `hint`, `error`, `min-hops`, `max-hops`.';
  assert.equal(mentionsName(text, 'min-hops'), true);
  assert.equal(mentionsName(text, 'label'), true);
});

test('a CSS part must appear in the designated CSS parts block, not merely a slot or property list', () => {
  const text = [
    '**Slots:** `leading` — leading content.',
    '',
    '**Properties:** `meta: string`.',
    '',
    '**CSS parts:** `base`, `content`.',
    '',
    '**Themeable custom properties:** `--lr-fixture-color`.',
  ].join('\n');
  assert.equal(contractBlockMentionsName(text, 'CSS parts', 'base'), true);
  assert.equal(contractBlockMentionsName(text, 'CSS parts', 'leading'), false);
  assert.equal(contractBlockMentionsName(text, 'CSS parts', 'meta'), false);
  assert.equal(contractBlockMentionsName(text, 'CSS parts', '--lr-fixture-color'), false);
});

test('a name at the very start or end of the text is still a mention (no boundary character needed)', () => {
  assert.equal(mentionsName('label is the first word', 'label'), true);
  assert.equal(mentionsName('the last word is label', 'label'), true);
});

test('a `--lr-*` custom property name matches only its exact identifier, not a longer relative', () => {
  const text = 'Themeable: `--lr-push-to-talk-size` (default `var(--lr-size-3rem)`).';
  assert.equal(mentionsName(text, '--lr-push-to-talk-size'), true);
  assert.equal(mentionsName(text, '--lr-push-to-talk-size-large'), false);
});

test('a name containing a regex metacharacter is matched literally, not as a pattern', () => {
  // Defensive: no current manifest name contains one, but mentionsName must not throw or silently
  // over-match if a future name did (e.g. treating a literal `.` as "any character").
  assert.equal(mentionsName('aXb should not satisfy the literal dot', 'a.b'), false);
  assert.equal(mentionsName('the literal `a.b` appears here', 'a.b'), true);
});

test('a component-scoped token belongs to the longest matching tag, not every tag that prefixes it', () => {
  // `lr-tab`, `lr-tab-group` and `lr-tab-panel` share one directory, so they share one stylesheet
  // scan. A plain prefix match would bill every `--lr-tab-group-*` token to `lr-tab` as well and
  // demand it be documented in a section it has nothing to do with.
  const tags = ['lr-tab', 'lr-tab-group', 'lr-tab-panel'];
  assert.equal(ownsToken('lr-tab-group', '--lr-tab-group-hover-color', tags), true);
  assert.equal(ownsToken('lr-tab', '--lr-tab-group-hover-color', tags), false);
  assert.equal(ownsToken('lr-tab', '--lr-tab-indicator-size', tags), true);
  // An unrelated token belongs to nobody.
  assert.equal(ownsToken('lr-tab', '--lr-color-brand', tags), false);
});

test('an exact inheritance declaration documents a base component surface without copying every name', () => {
  const text = '**Inherits:** all public surface from `lr-input`.\n\nNative-time differences follow.';
  assert.equal(inheritsAllPublicSurface(text, 'lr-input'), true);
});

test('ordinary inheritance prose is not mistaken for the explicit whole-surface contract', () => {
  const text = 'This component inherits useful behavior from `lr-input`.';
  assert.equal(inheritsAllPublicSurface(text, 'lr-input'), false);
});

test('an inheritance declaration only covers the exact named base tag', () => {
  const text = '**Inherits:** all public surface from `lr-input`.';
  assert.equal(inheritsAllPublicSurface(text, 'lr-select'), false);
});

test('gap collection honors the exact Native Time inheritance declaration for inherited entries', () => {
  const manifest = {
    modules: [
      {
        path: 'src/components/forms/input/input.class.ts',
        declarations: [
          { kind: 'class', name: 'LyraInput', customElement: true, tagName: 'lr-input' },
        ],
      },
      {
        path: 'src/components/forms/input/native-time-input.class.ts',
        declarations: [
          {
            kind: 'class',
            name: 'LyraNativeTimeInput',
            customElement: true,
            tagName: 'lr-native-time-input',
            attributes: [
              {
                name: 'inherited-only-fixture',
                inheritedFrom: { name: 'LyraInput', module: 'src/components/forms/input/input.class.ts' },
              },
            ],
          },
        ],
      },
    ],
  };
  assert.equal(
    collectGaps(['forms'], manifest).some(({ tag, names }) =>
      tag === 'lr-native-time-input' && names.includes('inherited-only-fixture')),
    false,
  );

  manifest.modules[1].declarations[0].attributes[0].inheritedFrom.name = 'DifferentBase';
  assert.equal(
    collectGaps(['forms'], manifest).some(({ tag, names }) =>
      tag === 'lr-native-time-input' && names.includes('inherited-only-fixture')),
    true,
    'an unresolvable or different base is not hidden by the lr-input declaration',
  );
});

test('gap collection cannot false-pass an inherited event omitted by a compact manifest', () => {
  const manifest = {
    schemaVersion: '1.0.0',
    modules: [
      {
        path: 'src/components/forms/radio/radio.class.ts',
        declarations: [
          {
            kind: 'class',
            name: 'LyraRadio',
            customElement: true,
            tagName: 'lr-radio',
            events: [{ name: 'lr-inherited-fixture' }],
          },
        ],
      },
      {
        path: 'src/components/forms/radio/radio-button.class.ts',
        declarations: [
          {
            kind: 'class',
            name: 'LyraRadioButton',
            customElement: true,
            tagName: 'lr-radio-button',
            superclass: {
              name: 'LyraRadio',
              module: '/src/components/forms/radio/radio.class.js',
            },
          },
        ],
      },
    ],
  };

  assert.equal(
    collectGaps(['forms'], manifest).some(
      ({ tag, kind, names }) =>
        tag === 'lr-radio-button' &&
        kind === 'event' &&
        names.includes('lr-inherited-fixture'),
    ),
    true,
    'the child section must be checked against its effective inherited event surface',
  );
});

test('exported interface coverage includes fields and inline callback-option contracts', () => {
  const names = exportedContractNames(
    'fixture.ts',
    [
      'export interface FixtureOptions {',
      '  mode: string;',
      '  resolve?: (request: { value: string; retry?: boolean }) => void;',
      '}',
    ].join('\n'),
    'FixtureOptions',
  );

  assert.deepEqual(names, ['mode', 'resolve', 'request', 'value', 'retry']);
});

test('exported free-function coverage includes parameters and callback arguments', () => {
  const names = exportedContractNames(
    'fixture.ts',
    [
      'export function fixture(',
      '  bytes: number,',
      '  numberLabel: (value: number, fractionDigits: number) => string,',
      '): string { return numberLabel(bytes, 0); }',
    ].join('\n'),
    'fixture',
  );

  assert.deepEqual(names, ['bytes', 'numberLabel', 'value', 'fractionDigits']);
});

test('an exported declaration is checked only inside its own authored contract block', () => {
  const text = [
    '- `FixtureOptions { mode: string; resolve?: (request) => void }` — options.',
    '  The callback receives `request`.',
    '- `DifferentOptions { value: string }` — unrelated.',
  ].join('\n');

  const block = contractDeclarationBlock(text, 'FixtureOptions');
  assert.equal(mentionsName(block, 'mode'), true);
  assert.equal(mentionsName(block, 'request'), true);
  assert.equal(mentionsName(block, 'value'), false);
});

test('the source census follows public re-exports and fingerprints nested public signatures', () => {
  withSourceContractFixture(
    {
      'src/internal/fixture.ts': [
        'export interface FixtureOptions {',
        "  readonly mode?: 'compact' | 'full';",
        '  resolve?: (request: { value: string; retry?: boolean; nested?: { flag?: boolean } }) => void;',
        '  /** @internal */',
        '  internalOnly?(secret: string): void;',
        '}',
        'export function fixture(',
        "  { publicKey: localAlias = 'fallback', ...localRest }: { publicKey?: string },",
        '  callback: (options: { limit?: number }) => void,',
        '): void { void localAlias; void localRest; void callback; }',
        "export interface ListenerContracts { 'lr-ready': CustomEvent<void>; }",
        'interface Source { value: string; }',
        "export interface IndexedData { value: Source['value']; }",
      ].join('\n'),
      'src/utilities/fixture.ts': [
        "export { fixture } from '../internal/fixture.js';",
        "export type { FixtureOptions, IndexedData, ListenerContracts as RenamedEvents } from '../internal/fixture.js';",
      ].join('\n'),
    },
    (fixtureDir) => {
      const modules = {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      };
      const census = sourceContractCensus(fixtureDir, modules);
      assert.equal(census.length, 3, 'ordinary indexed-access fields are not EventMaps');
      const options = census.find(({ exportName }) => exportName === 'FixtureOptions');
      const fn = census.find(({ exportName }) => exportName === 'fixture');
      assert.deepEqual(
        options.names,
        ['mode', 'resolve', 'request', 'value', 'retry', 'nested', 'flag'],
      );
      assert.deepEqual(fn.names, ['publicKey', 'callback', 'options', 'limit']);
      assert.equal(fn.names.includes('localAlias'), false, 'local destructuring aliases are private');
      assert.deepEqual(options.routes, ['src/utilities/fixture.ts']);
      assert.deepEqual(options.utilityRoutes, ['src/utilities/fixture.ts']);

      const baseline = {
        schemaVersion: 1,
        documented: census.map((contract) => baselineOwner(contract)),
        legacy: [],
      };
      assert.deepEqual(validateSourceContractBaseline(census, baseline), []);

      const sourceFile = path.join(fixtureDir, 'src/internal/fixture.ts');
      const original = [
        'export interface FixtureOptions {',
        "  readonly mode?: 'compact' | 'full';",
        '  resolve?: (request: { value: string; retry?: boolean; nested?: { flag?: boolean } }) => void;',
        '  /** @internal */',
        '  internalOnly?(secret: string): void;',
        '}',
        'export function fixture(',
        "  { publicKey: localAlias = 'fallback', ...localRest }: { publicKey?: string },",
        '  callback: (options: { limit?: number }) => void,',
        '): void { void localAlias; void localRest; void callback; }',
        "export interface ListenerContracts { 'lr-ready': CustomEvent<void>; }",
        'interface Source { value: string; }',
        "export interface IndexedData { value: Source['value']; }",
      ].join('\n');
      writeFileSync(sourceFile, original.replace("'compact' | 'full'", 'number'));
      const typeDrift = sourceContractCensus(fixtureDir, modules);
      assert.ok(
        validateSourceContractBaseline(typeDrift, baseline).some((finding) =>
          finding.includes('documented public source contract signature changed'),
        ),
        'a type-only change must invalidate the signature fingerprint',
      );

      writeFileSync(sourceFile, original.replace('readonly mode?', 'readonly added?: Date;\n  readonly mode?'));
      const addedField = sourceContractCensus(fixtureDir, modules);
      assert.ok(
        validateSourceContractBaseline(addedField, baseline).some((finding) =>
          finding.includes('documented public source contract signature changed'),
        ),
        'a newly added interface field must invalidate the signature fingerprint',
      );

      writeFileSync(sourceFile, original.replace('secret: string', 'secret: number'));
      const internalDrift = sourceContractCensus(fixtureDir, modules);
      assert.deepEqual(
        validateSourceContractBaseline(internalDrift, baseline),
        [],
        '@internal members are absent from the shipped public contract',
      );

      writeFileSync(
        sourceFile,
        original
          .replace('...localRest', '...renamedRest')
          .replace('void localRest', 'void renamedRest'),
      );
      assert.deepEqual(
        validateSourceContractBaseline(sourceContractCensus(fixtureDir, modules), baseline),
        [],
        'an object-rest local binding rename is not public signature drift',
      );

      writeFileSync(
        sourceFile,
        original.replace("'compact' | 'full'", '"compact" | "full"'),
      );
      assert.deepEqual(
        validateSourceContractBaseline(sourceContractCensus(fixtureDir, modules), baseline),
        [],
        'quote spelling is not public signature drift',
      );

      writeFileSync(
        sourceFile,
        original.replace("'compact' | 'full'", "'full' | 'compact'"),
      );
      assert.deepEqual(
        validateSourceContractBaseline(sourceContractCensus(fixtureDir, modules), baseline),
        [],
        'union member order is not public signature drift',
      );
    },
  );
});

test('ordinary Event-valued data interfaces stay in the source-contract census', () => {
  withSourceContractFixture(
    {
      'src/utilities/fixture.ts': [
        'export interface EventPair {',
        '  source: MouseEvent;',
        '  replacement: CustomEvent<string>;',
        '}',
      ].join('\n'),
    },
    (fixtureDir) => {
      const census = sourceContractCensus(fixtureDir, {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      });
      assert.deepEqual(census.map(({ exportName }) => exportName), ['EventPair']);
      assert.deepEqual(census[0].names, ['source', 'replacement']);
    },
  );
});

test('free-function docs names include fields of an inline return object', () => {
  withSourceContractFixture(
    {
      'src/utilities/fixture.ts':
        'export function parse(input: string): { value: string; retry?: boolean } { return { value: input }; }',
    },
    (fixtureDir) => {
      const [contract] = sourceContractCensus(fixtureDir, {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      });
      assert.deepEqual(contract.names, ['input', 'value', 'retry']);
    },
  );
});

test('defaulted callback parameters retain their public callback argument names', () => {
  withSourceContractFixture(
    {
      'src/utilities/fixture.ts': [
        'export function formatFileSize(',
        '  bytes: number,',
        '  unitLabel: (unit: string) => string = (unit) => unit,',
        '  numberLabel: (value: number, fractionDigits: number) => string = (value) => String(value),',
        '): string { return numberLabel(bytes, 0) + unitLabel("B"); }',
      ].join('\n'),
    },
    (fixtureDir) => {
      const [contract] = sourceContractCensus(fixtureDir, {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      });
      assert.deepEqual(
        contract.names,
        ['bytes', 'unitLabel', 'unit', 'numberLabel', 'value', 'fractionDigits'],
      );
    },
  );

});

test('default-exported interfaces and functions enter the census under the default name', () => {
  withSourceContractFixture(
    {
      'src/utilities/options.ts': 'export default interface Options { value: string; }',
      'src/utilities/helper.ts':
        'export default function (input: string): string { return input; }',
    },
    (fixtureDir) => {
      const census = sourceContractCensus(fixtureDir, {
        componentModules: [],
        utilityModules: ['src/utilities/options.ts', 'src/utilities/helper.ts'],
      });
      assert.deepEqual(
        census.map(({ module, exportName, kind }) => [module, exportName, kind]),
        [
          ['src/utilities/helper.ts', 'default', 'function'],
          ['src/utilities/options.ts', 'default', 'interface'],
        ],
      );
    },
  );
});

test('same-name type and value declarations remain distinct census contracts', () => {
  withSourceContractFixture(
    {
      'src/utilities/fixture.ts': [
        'export interface Fixture { value: string; }',
        'export function Fixture(value: string): Fixture { return { value }; }',
      ].join('\n'),
    },
    (fixtureDir) => {
      const census = sourceContractCensus(fixtureDir, {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      });
      assert.deepEqual(census.map(({ exportName, kind }) => [exportName, kind]), [
        ['Fixture', 'function'],
        ['Fixture', 'interface'],
      ]);
    },
  );
});

test('type-query value dependencies and dependency identity edges affect fingerprints', () => {
  withSourceContractFixture(
    {
      'src/utilities/fixture.ts': [
        "const KEYS = ['a', 'b'] as const;",
        'type Key = (typeof KEYS)[number];',
        'interface A { a: string; }',
        'interface B { b: number; }',
        'export interface Options { key: Key; left: A; right: B; }',
      ].join('\n'),
    },
    (fixtureDir) => {
      const modules = {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      };
      const initial = sourceContractCensus(fixtureDir, modules);
      const baseline = {
        schemaVersion: 1,
        documented: initial.map((contract) => baselineOwner(contract)),
        legacy: [],
      };
      const file = path.join(fixtureDir, 'src/utilities/fixture.ts');
      writeFileSync(file, [
        "const KEYS = ['a', 'changed'] as const;",
        'type Key = (typeof KEYS)[number];',
        'interface A { a: string; }',
        'interface B { b: number; }',
        'export interface Options { key: Key; left: A; right: B; }',
      ].join('\n'));
      assert.ok(
        validateSourceContractBaseline(sourceContractCensus(fixtureDir, modules), baseline)
          .some((finding) => finding.includes('signature changed')),
        'a typeof-backed literal change must invalidate the effective signature',
      );

      writeFileSync(file, [
        "const KEYS = ['a', 'b'] as const;",
        'type Key = (typeof KEYS)[number];',
        'interface A { b: number; }',
        'interface B { a: string; }',
        'export interface Options { key: Key; left: A; right: B; }',
      ].join('\n'));
      assert.ok(
        validateSourceContractBaseline(sourceContractCensus(fixtureDir, modules), baseline)
          .some((finding) => finding.includes('signature changed')),
        'swapping dependency shapes must not preserve an anonymous dependency multiset',
      );
    },
  );
});

test('Omit and indexed-access dependencies use only their effective fields', () => {
  withSourceContractFixture(
    {
      'src/utilities/fixture.ts': [
        'interface Source { chosen: string; ignored: number; }',
        "type Narrow = Omit<Source, 'ignored'>;",
        'interface Derived extends Source { own: boolean; }',
        'type Alias = Derived;',
        "type Chosen = Source['chosen'];",
        'export interface Options extends Narrow { selected: Chosen; }',
        "export interface DirectOptions extends Omit<Source, 'ignored'> { own: boolean; }",
        "export interface TransitiveOptions extends Omit<Alias, 'ignored'> { local: Date; }",
      ].join('\n'),
    },
    (fixtureDir) => {
      const modules = {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      };
      const initial = sourceContractCensus(fixtureDir, modules);
      assert.deepEqual(
        initial.find(({ exportName }) => exportName === 'Options').names,
        ['selected', 'chosen'],
      );
      assert.deepEqual(
        initial.find(({ exportName }) => exportName === 'DirectOptions').names,
        ['own', 'chosen'],
      );
      assert.deepEqual(
        initial.find(({ exportName }) => exportName === 'TransitiveOptions').names,
        ['local', 'own', 'chosen'],
      );
      const baseline = {
        schemaVersion: 1,
        documented: initial.map((contract) => baselineOwner(contract)),
        legacy: [],
      };
      const file = path.join(fixtureDir, 'src/utilities/fixture.ts');
      writeFileSync(file, [
        'interface Source { chosen: string; ignored: bigint; }',
        "type Narrow = Omit<Source, 'ignored'>;",
        'interface Derived extends Source { own: boolean; }',
        'type Alias = Derived;',
        "type Chosen = Source['chosen'];",
        'export interface Options extends Narrow { selected: Chosen; }',
        "export interface DirectOptions extends Omit<Source, 'ignored'> { own: boolean; }",
        "export interface TransitiveOptions extends Omit<Alias, 'ignored'> { local: Date; }",
      ].join('\n'));
      assert.deepEqual(
        validateSourceContractBaseline(sourceContractCensus(fixtureDir, modules), baseline),
        [],
        'an omitted and unselected field cannot affect the effective public contract',
      );
      writeFileSync(file, [
        'interface Source { chosen: boolean; ignored: number; }',
        "type Narrow = Omit<Source, 'ignored'>;",
        'interface Derived extends Source { own: boolean; }',
        'type Alias = Derived;',
        "type Chosen = Source['chosen'];",
        'export interface Options extends Narrow { selected: Chosen; }',
        "export interface DirectOptions extends Omit<Source, 'ignored'> { own: boolean; }",
        "export interface TransitiveOptions extends Omit<Alias, 'ignored'> { local: Date; }",
      ].join('\n'));
      assert.ok(
        validateSourceContractBaseline(sourceContractCensus(fixtureDir, modules), baseline)
          .some((finding) => finding.includes('signature changed')),
      );
    },
  );
});

test('array-destructure binding names are implementation-local', () => {
  withSourceContractFixture(
    {
      'src/utilities/fixture.ts':
        'export function consume([first, ...localRest]: readonly string[]): void { void first; void localRest; }',
    },
    (fixtureDir) => {
      const modules = {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      };
      const initial = sourceContractCensus(fixtureDir, modules);
      assert.deepEqual(initial[0].names, []);
      const baseline = {
        schemaVersion: 1,
        documented: initial.map((contract) => baselineOwner(contract)),
        legacy: [],
      };
      writeFileSync(
        path.join(fixtureDir, 'src/utilities/fixture.ts'),
        'export function consume([renamed, ...renamedRest]: readonly string[]): void { void renamed; void renamedRest; }',
      );
      assert.deepEqual(
        validateSourceContractBaseline(sourceContractCensus(fixtureDir, modules), baseline),
        [],
      );
    },
  );
});

test('namespace source-contract exports fail closed instead of flattening or disappearing', () => {
  withSourceContractFixture(
    {
      'src/internal/contracts.ts': 'export interface Options { value: string; }',
      'src/utilities/fixture.ts': "export * as contracts from '../internal/contracts.js';",
    },
    (fixtureDir) => {
      assert.throws(
        () => sourceContractCensus(fixtureDir, {
          componentModules: [],
          utilityModules: ['src/utilities/fixture.ts'],
        }),
        /unsupported namespace source-contract export/u,
      );
    },
  );
});

test('an explicit named re-export overrides a colliding star export', () => {
  withSourceContractFixture(
    {
      'src/internal/star.ts': 'export interface Options { fromStar: string; }',
      'src/internal/explicit.ts': 'export interface Options { explicit: number; }',
      'src/utilities/fixture.ts': [
        "export * from '../internal/star.js';",
        "export { Options } from '../internal/explicit.js';",
      ].join('\n'),
    },
    (fixtureDir) => {
      const [contract] = sourceContractCensus(fixtureDir, {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      });
      assert.deepEqual(contract.names, ['explicit']);
      assert.equal(contract.module, 'src/internal/explicit.ts');
    },
  );
});

test('removing one of several public routes invalidates the source-contract baseline', () => {
  withSourceContractFixture(
    {
      'src/internal/contracts.ts': 'export interface Options { value: string; }',
      'src/utilities/first.ts': "export type { Options } from '../internal/contracts.js';",
      'src/utilities/second.ts': "export type { Options } from '../internal/contracts.js';",
    },
    (fixtureDir) => {
      const initial = sourceContractCensus(fixtureDir, {
        componentModules: [],
        utilityModules: ['src/utilities/first.ts', 'src/utilities/second.ts'],
      });
      const baseline = {
        schemaVersion: 1,
        documented: initial.map((contract) => baselineOwner(contract)),
        legacy: [],
      };
      const withoutSecondRoute = sourceContractCensus(fixtureDir, {
        componentModules: [],
        utilityModules: ['src/utilities/first.ts'],
      });
      assert.ok(
        validateSourceContractBaseline(withoutSecondRoute, baseline).some((finding) =>
          finding.includes('public source-contract routes changed')),
      );
    },
  );
});

test('a legacy route change requires promotion to documented enrollment', () => {
  withSourceContractFixture(
    {
      'src/internal/contracts.ts': 'export interface Options { value: string; }',
      'src/components/first.ts': "export type { Options } from '../internal/contracts.js';",
      'src/components/second.ts': "export type { Options } from '../internal/contracts.js';",
    },
    (fixtureDir) => {
      const initial = sourceContractCensus(fixtureDir, {
        componentModules: ['src/components/first.ts', 'src/components/second.ts'],
        utilityModules: [],
      });
      const baseline = {
        schemaVersion: 1,
        documented: [],
        legacy: initial.map((contract) => baselineOwner(contract, 'legacy')),
      };
      const changed = sourceContractCensus(fixtureDir, {
        componentModules: ['src/components/first.ts'],
        utilityModules: [],
      });
      assert.ok(
        validateSourceContractBaseline(changed, baseline).some((finding) =>
          finding.includes('legacy public source contract changed; promote it to documented enrollment')),
      );
    },
  );
});

test('overload docs use public signature names, never implementation bindings', () => {
  withSourceContractFixture(
    {
      'src/utilities/fixture.ts': [
        'export function overloaded(input: string): string;',
        'export function overloaded(value: string): string { return value; }',
      ].join('\n'),
    },
    (fixtureDir) => {
      const [contract] = sourceContractCensus(fixtureDir, {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      });
      assert.deepEqual(contract.names, ['input']);
    },
  );
});

test('a local declaration rename behind a stable public alias is not signature drift', () => {
  withSourceContractFixture(
    {
      'src/internal/fixture.ts': [
        'export function localHelper(value: string): string { return value; }',
      ].join('\n'),
      'src/utilities/fixture.ts': [
        "export { localHelper as publicHelper } from '../internal/fixture.js';",
      ].join('\n'),
    },
    (fixtureDir) => {
      const modules = {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      };
      const initial = sourceContractCensus(fixtureDir, modules);
      const baseline = {
        schemaVersion: 1,
        documented: initial.map((contract) => baselineOwner(contract)),
        legacy: [],
      };
      writeFileSync(
        path.join(fixtureDir, 'src/internal/fixture.ts'),
        'export function renamedHelper(value: string): string { return value; }',
      );
      writeFileSync(
        path.join(fixtureDir, 'src/utilities/fixture.ts'),
        "export { renamedHelper as publicHelper } from '../internal/fixture.js';",
      );
      assert.deepEqual(
        validateSourceContractBaseline(sourceContractCensus(fixtureDir, modules), baseline),
        [],
      );
    },
  );
});

test('call-signature overload order remains part of an interface fingerprint', () => {
  withSourceContractFixture(
    {
      'src/utilities/fixture.ts': [
        'export interface Callable {',
        "  (input: string): 'specific';",
        "  (input: unknown): 'fallback';",
        '}',
      ].join('\n'),
    },
    (fixtureDir) => {
      const modules = {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      };
      const initial = sourceContractCensus(fixtureDir, modules);
      const baseline = {
        schemaVersion: 1,
        documented: initial.map((contract) => baselineOwner(contract)),
        legacy: [],
      };
      writeFileSync(
        path.join(fixtureDir, 'src/utilities/fixture.ts'),
        [
          'export interface Callable {',
          "  (input: unknown): 'fallback';",
          "  (input: string): 'specific';",
          '}',
        ].join('\n'),
      );
      assert.ok(
        validateSourceContractBaseline(sourceContractCensus(fixtureDir, modules), baseline).some(
          (finding) => finding.includes('signature changed'),
        ),
      );
    },
  );
});

test('effective interface signatures include imported non-reexported bases and type literals', () => {
  withSourceContractFixture(
    {
      'src/internal/base.ts': [
        'export interface TraversalOptions { maxElements?: number; maxDepth?: number; }',
        'export type CallbackOptions = { retry?: boolean; };',
      ].join('\n'),
      'src/utilities/fixture.ts': [
        "import type { CallbackOptions, TraversalOptions } from '../internal/base.js';",
        'export interface FixtureOptions extends TraversalOptions {',
        '  maxPasses?: number;',
        '  callback?: (options: CallbackOptions) => void;',
        '}',
      ].join('\n'),
    },
    (fixtureDir) => {
      const modules = {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      };
      const initial = sourceContractCensus(fixtureDir, modules);
      assert.deepEqual(
        initial[0].names,
        ['maxPasses', 'callback', 'options', 'maxElements', 'maxDepth'],
      );
      const baseline = {
        schemaVersion: 1,
        documented: initial.map((contract) => baselineOwner(contract)),
        legacy: [],
      };
      writeFileSync(
        path.join(fixtureDir, 'src/internal/base.ts'),
        [
          'export interface TraversalOptions { maxElements?: bigint; maxDepth?: number; }',
          'export type CallbackOptions = { retry?: boolean; };',
        ].join('\n'),
      );
      assert.ok(
        validateSourceContractBaseline(sourceContractCensus(fixtureDir, modules), baseline).some(
          (finding) => finding.includes('signature changed'),
        ),
      );
    },
  );
});

test('inherited generic value contracts affect fingerprints without copying their fields into docs', () => {
  withSourceContractFixture(
    {
      'src/utilities/fixture.ts': [
        'interface Definition { tag: string; hidden?: boolean; }',
        'export interface Registry extends ReadonlyMap<string, Definition> { label?: string; }',
      ].join('\n'),
    },
    (fixtureDir) => {
      const modules = {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      };
      const initial = sourceContractCensus(fixtureDir, modules);
      assert.deepEqual(initial[0].names, ['label']);
      const baseline = {
        schemaVersion: 1,
        documented: initial.map((contract) => baselineOwner(contract)),
        legacy: [],
      };
      writeFileSync(
        path.join(fixtureDir, 'src/utilities/fixture.ts'),
        [
          'interface Definition { tag: number; hidden?: boolean; }',
          'export interface Registry extends ReadonlyMap<string, Definition> { label?: string; }',
        ].join('\n'),
      );
      assert.ok(
        validateSourceContractBaseline(sourceContractCensus(fixtureDir, modules), baseline)
          .some((finding) => finding.includes('signature changed')),
      );
    },
  );
});

test('typed function-valued consts use their declared callable type, not initializer bindings', () => {
  withSourceContractFixture(
    {
      'src/utilities/fixture.ts': [
        'export type SnapFunction = (options: { pos: number }) => number;',
        'export const SNAP: SnapFunction = ({ pos }) => pos;',
      ].join('\n'),
    },
    (fixtureDir) => {
      const modules = {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      };
      const initial = sourceContractCensus(fixtureDir, modules);
      assert.deepEqual(initial[0].names, ['options', 'pos']);
      const baseline = {
        schemaVersion: 1,
        documented: initial.map((contract) => baselineOwner(contract)),
        legacy: [],
      };
      writeFileSync(
        path.join(fixtureDir, 'src/utilities/fixture.ts'),
        [
          'export type SnapFunction = (options: { pos: number }) => number;',
          'export const SNAP: SnapFunction = ({ pos: localPosition }) => localPosition;',
        ].join('\n'),
      );
      assert.deepEqual(
        validateSourceContractBaseline(sourceContractCensus(fixtureDir, modules), baseline),
        [],
      );
    },
  );
});

test('the source census derives every explicit component package route from inventory', () => {
  const modules = publicSourceContractModules('/unused-fixture-root', {
    components: [
      {
        tag: 'lr-fixture',
        family: 'utility',
        classModule: 'src/components/utility/fixture/fixture.class.ts',
        registrationModule: 'src/components/utility/fixture/fixture.ts',
      },
    ],
  });
  assert.ok(modules.componentModules.includes('src/components/utility/fixture/fixture.class.ts'));
  assert.ok(modules.componentModules.includes('src/components/utility/fixture/fixture.ts'));
  assert.ok(modules.componentModules.includes('src/components/lr-fixture.ts'));
  assert.ok(modules.componentModules.includes('src/components/utility/index.ts'));
});

test('the source census derives root, AI, and wildcard owners from package exports', () => {
  withSourceContractFixture(
    {
      'package.json': JSON.stringify({
        exports: {
          '.': { types: './dist/lyra.d.ts', default: './dist/lyra.js' },
          './ai': './dist/ai/index.js',
          './ai/*': './dist/ai/*',
        },
      }),
      'src/lyra.ts': 'export interface RootContract { value: string; }',
      'src/ai/index.ts': 'export interface AiContract { model: string; }',
      'src/ai/adapters/provider.ts': 'export function adapt(value: string): string { return value; }',
      'src/ai/adapters/provider.test.ts': 'export interface TestOnlyContract { hidden: true; }',
    },
    (fixtureDir) => {
      const modules = publicSourceContractModules(fixtureDir, { components: [] });
      assert.ok(modules.componentModules.includes('src/lyra.ts'));
      assert.ok(modules.componentModules.includes('src/ai/index.ts'));
      assert.ok(modules.componentModules.includes('src/ai/adapters/provider.ts'));
      assert.equal(
        modules.componentModules.includes('src/ai/adapters/provider.test.ts'),
        false,
      );
    },
  );
});

test('the source-contract baseline fails closed for new, renamed, stale, and duplicate owners', () => {
  withSourceContractFixture(
    {
      'src/components/fixture.ts': 'export interface LegacyContract { value: string; }',
      'src/utilities/fixture.ts': 'export function fixture(value: string): void { void value; }',
      'src/utilities/new-helper.ts': [
        'export interface NewUtilityOptions { enabled?: boolean; }',
        'export const newHelper = ({ enabled: publicEnabled }: NewUtilityOptions): void => {',
        '  void publicEnabled;',
        '};',
      ].join('\n'),
    },
    (fixtureDir) => {
      const initial = sourceContractCensus(fixtureDir, {
        componentModules: ['src/components/fixture.ts'],
        utilityModules: ['src/utilities/fixture.ts'],
      });
      const legacy = initial.find(({ exportName }) => exportName === 'LegacyContract');
      const utility = initial.find(({ exportName }) => exportName === 'fixture');
      const baseline = {
        schemaVersion: 1,
        documented: [baselineOwner(utility)],
        legacy: [baselineOwner(legacy, 'legacy')],
      };
      assert.deepEqual(validateSourceContractBaseline(initial, baseline), []);

      const withNewUtility = sourceContractCensus(fixtureDir, {
        componentModules: ['src/components/fixture.ts'],
        utilityModules: ['src/utilities/fixture.ts', 'src/utilities/new-helper.ts'],
      });
      const utilityFindings = validateSourceContractBaseline(withNewUtility, baseline);
      assert.ok(
        utilityFindings.some((finding) =>
          finding.includes('uncatalogued public source contract') && finding.includes('newHelper'),
        ),
        'an exported arrow-function utility must enter the census',
      );
      assert.ok(
        utilityFindings.some((finding) =>
          finding.includes('lacks documented enrollment') && finding.includes('newHelper'),
        ),
      );

      writeFileSync(
        path.join(fixtureDir, 'src/components/fixture.ts'),
        [
          'export interface RenamedContract { value: string; }',
          'export interface AddedContract { callback?: (options: { retry?: boolean }) => void; }',
        ].join('\n'),
      );
      const renamed = sourceContractCensus(fixtureDir, {
        componentModules: ['src/components/fixture.ts'],
        utilityModules: ['src/utilities/fixture.ts'],
      });
      const renamedFindings = validateSourceContractBaseline(renamed, baseline);
      assert.ok(renamedFindings.some((finding) => finding.includes('RenamedContract')));
      assert.ok(renamedFindings.some((finding) => finding.includes('AddedContract')));
      assert.ok(renamedFindings.some((finding) => finding.includes('stale public source-contract baseline owner')));

      const duplicateBaseline = {
        ...baseline,
        legacy: [...baseline.legacy, baseline.documented[0]],
      };
      assert.ok(
        validateSourceContractBaseline(initial, duplicateBaseline).some((finding) =>
          finding.includes('duplicate source-contract baseline owner'),
        ),
      );
    },
  );
});

test('a changed legacy declaration must be promoted instead of silently re-baselined', () => {
  withSourceContractFixture(
    { 'src/components/fixture.ts': 'export interface LegacyContract { value: string; }' },
    (fixtureDir) => {
      const modules = {
        componentModules: ['src/components/fixture.ts'],
        utilityModules: [],
      };
      const initial = sourceContractCensus(fixtureDir, modules);
      const baseline = {
        schemaVersion: 1,
        documented: [],
        legacy: initial.map((contract) => baselineOwner(contract, 'legacy')),
      };
      writeFileSync(
        path.join(fixtureDir, 'src/components/fixture.ts'),
        'export interface LegacyContract { value: number; }',
      );
      const changed = sourceContractCensus(fixtureDir, modules);
      assert.ok(
        validateSourceContractBaseline(changed, baseline).some((finding) =>
          finding.includes('promote it to documented enrollment'),
        ),
      );
    },
  );
});

test('public functions require explicit returns and ignore implementation-only refactors', () => {
  withSourceContractFixture(
    { 'src/utilities/fixture.ts': "export const inferred = () => ({ value: 'ready' });" },
    (fixtureDir) => {
      const modules = {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      };
      assert.throws(
        () => sourceContractCensus(fixtureDir, modules),
        /requires an explicit return annotation/u,
      );
    },
  );

  withSourceContractFixture(
    {
      'src/utilities/fixture.ts': [
        'export function stable(value: string): string {',
        '  const local = value;',
        '  return local;',
        '}',
      ].join('\n'),
    },
    (fixtureDir) => {
      const modules = {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      };
      const initial = sourceContractCensus(fixtureDir, modules);
      const baseline = {
        schemaVersion: 1,
        documented: initial.map((contract) => baselineOwner(contract)),
        legacy: [],
      };
      writeFileSync(
        path.join(fixtureDir, 'src/utilities/fixture.ts'),
        [
          'export function stable(value: string): string {',
          '  let renamedLocal = value;',
          '  return renamedLocal;',
          '}',
        ].join('\n'),
      );
      assert.deepEqual(
        validateSourceContractBaseline(sourceContractCensus(fixtureDir, modules), baseline),
        [],
      );
    },
  );
});

test('callable dependencies reached through typeof also require explicit returns', () => {
  withSourceContractFixture(
    {
      'src/utilities/fixture.ts': [
        "const factory = () => ({ value: 'ready' });",
        'type Result = ReturnType<typeof factory>;',
        'export interface Options { result: Result; }',
      ].join('\n'),
    },
    (fixtureDir) => {
      assert.throws(
        () => sourceContractCensus(fixtureDir, {
          componentModules: [],
          utilityModules: ['src/utilities/fixture.ts'],
        }),
        /requires an explicit return annotation/u,
      );
    },
  );
});

test('typeof value dependencies fail closed unless their inferred type is syntactically complete', () => {
  for (const source of [
    [
      "const API = { make: () => ({ before: 1 }) };",
      'export interface Options { api: typeof API; }',
    ].join('\n'),
    [
      'function make(): { before: number } { return { before: 1 }; }',
      'const API = make();',
      'export interface Options { api: typeof API; }',
    ].join('\n'),
  ]) {
    withSourceContractFixture(
      { 'src/utilities/fixture.ts': source },
      (fixtureDir) => {
        assert.throws(
          () => sourceContractCensus(fixtureDir, {
            componentModules: [],
            utilityModules: ['src/utilities/fixture.ts'],
          }),
          /typeof value dependency requires an explicit or syntactically complete type/u,
        );
      },
    );
  }

  withSourceContractFixture(
    {
      'src/utilities/fixture.ts': [
        "const API = Object.freeze({ value: 'ready' } as const);",
        'export interface Options { api: typeof API; }',
      ].join('\n'),
    },
    (fixtureDir) => {
      assert.equal(sourceContractCensus(fixtureDir, {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      }).length, 1);
    },
  );
});

test('keyof typeof fingerprints static keys without requiring implementation-only value inference', () => {
  withSourceContractFixture(
    {
      'src/utilities/fixture.ts': [
        'function make(): { value: string } { return { value: "ready" }; }',
        'const API = Object.freeze({ before: make() });',
        'type ApiKey = keyof typeof API;',
        'export interface Options { key: ApiKey; }',
      ].join('\n'),
    },
    (fixtureDir) => {
      const modules = {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      };
      const initial = sourceContractCensus(fixtureDir, modules);
      const baseline = {
        schemaVersion: 1,
        documented: initial.map((contract) => baselineOwner(contract)),
        legacy: [],
      };
      const file = path.join(fixtureDir, 'src/utilities/fixture.ts');
      writeFileSync(file, [
        'function make(): { changed: number } { return { changed: 1 }; }',
        'const API = Object.freeze({ before: make() });',
        'type ApiKey = keyof typeof API;',
        'export interface Options { key: ApiKey; }',
      ].join('\n'));
      assert.deepEqual(
        validateSourceContractBaseline(sourceContractCensus(fixtureDir, modules), baseline),
        [],
        'value-only changes do not alter a keyof-only public contract',
      );
      writeFileSync(file, [
        'function make(): { value: string } { return { value: "ready" }; }',
        'const API = Object.freeze({ after: make() });',
        'type ApiKey = keyof typeof API;',
        'export interface Options { key: ApiKey; }',
      ].join('\n'));
      assert.ok(
        validateSourceContractBaseline(sourceContractCensus(fixtureDir, modules), baseline)
          .some((finding) => finding.includes('signature changed')),
      );
    },
  );
});

test('computed public keys fail closed when their consumer spelling is not syntactically literal', () => {
  withSourceContractFixture(
    {
      'src/utilities/fixture.ts': [
        "const PUBLIC_KEY = 'before' as const;",
        'export function use({[PUBLIC_KEY]: local}: Record<string, string>): void { void local; }',
      ].join('\n'),
    },
    (fixtureDir) => {
      assert.throws(
        () => sourceContractCensus(fixtureDir, {
          componentModules: [],
          utilityModules: ['src/utilities/fixture.ts'],
        }),
        /unsupported computed public key/u,
      );
    },
  );

  withSourceContractFixture(
    {
      'src/utilities/fixture.ts':
        "export function use({['before']: local}: { before: string }): void { void local; }",
    },
    (fixtureDir) => {
      const [contract] = sourceContractCensus(fixtureDir, {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      });
      assert.deepEqual(contract.names, ['before']);
    },
  );
});

test('local unique-symbol brands are fingerprinted without becoming authored field names', () => {
  withSourceContractFixture(
    {
      'src/utilities/fixture.ts': [
        "const FIRST_BRAND: unique symbol = Symbol('fixture');",
        'export interface Branded { readonly [FIRST_BRAND]: true; value: string; }',
      ].join('\n'),
    },
    (fixtureDir) => {
      const modules = {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      };
      const [initial] = sourceContractCensus(fixtureDir, modules);
      assert.deepEqual(initial.names, ['value']);

      writeFileSync(
        path.join(fixtureDir, 'src/utilities/fixture.ts'),
        [
          "const RENAMED_BRAND: unique symbol = Symbol('fixture');",
          'export interface Branded { readonly [RENAMED_BRAND]: true; value: string; }',
        ].join('\n'),
      );
      const [renamed] = sourceContractCensus(fixtureDir, modules);
      assert.equal(renamed.fingerprint, initial.fingerprint);

      writeFileSync(
        path.join(fixtureDir, 'src/utilities/fixture.ts'),
        [
          "const RENAMED_BRAND: unique symbol = Symbol('fixture');",
          'export interface Branded { readonly [RENAMED_BRAND]: false; value: string; }',
        ].join('\n'),
      );
      const [changed] = sourceContractCensus(fixtureDir, modules);
      assert.notEqual(changed.fingerprint, initial.fingerprint);
    },
  );

  withSourceContractFixture(
    {
      'src/utilities/fixture.ts': [
        "export const PUBLIC_BRAND: unique symbol = Symbol('fixture');",
        'export interface Branded { readonly [PUBLIC_BRAND]: true; value: string; }',
      ].join('\n'),
    },
    (fixtureDir) => {
      assert.throws(
        () => sourceContractCensus(fixtureDir, {
          componentModules: [],
          utilityModules: ['src/utilities/fixture.ts'],
        }),
        /unsupported computed public key/u,
      );
    },
  );
});

test('the private unique-symbol menu protocols do not enter the public source-contract census', () => {
  const packageDir = fileURLToPath(new URL('../', import.meta.url));
  const census = sourceContractCensus(packageDir, {
    componentModules: ['src/components/layout/menu/menu-shared.ts'],
    utilityModules: [],
  });

  assert.deepEqual(census, []);
});

test('the private unique-symbol reorder protocols do not enter the public source-contract census', () => {
  const packageDir = fileURLToPath(new URL('../', import.meta.url));
  const census = sourceContractCensus(packageDir, {
    componentModules: ['src/components/layout/reorder-list/reorder-owner.ts'],
    utilityModules: [],
  });

  assert.deepEqual(census, []);
});

test('well-known symbol members retain their consumer-facing computed name', () => {
  withSourceContractFixture(
    {
      'src/utilities/fixture.ts':
        'export interface IterableLike { [Symbol.iterator](): Iterator<string>; }',
    },
    (fixtureDir) => {
      const [contract] = sourceContractCensus(fixtureDir, {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      });
      assert.deepEqual(contract.names, ['Symbol.iterator']);
    },
  );
});

test('source-contract documentation mappings fail on missing sections and missing utility bullets', () => {
  const component = {
    module: 'src/components/fixture.ts',
    exportName: 'FixtureOptions',
    kind: 'interface',
    fingerprint: 'component-fixture',
    names: ['mode'],
    routes: ['src/components/fixture.ts'],
    utilityRoutes: [],
  };
  const utility = {
    module: 'src/utilities/helper.ts',
    exportName: 'helper',
    kind: 'function',
    fingerprint: 'utility-fixture',
    names: ['options', 'retry'],
    routes: ['src/utilities/helper.ts'],
    utilityRoutes: ['src/utilities/helper.ts'],
  };
  const baseline = {
    schemaVersion: 1,
    documented: [
      {
        ...baselineOwner(component),
        document: 'llms/fixture.md',
        family: 'fixture',
        locator: { kind: 'component', tag: 'lr-fixture', declaration: 'FixtureOptions' },
      },
      baselineOwner(utility),
    ],
    legacy: [],
  };
  const gaps = collectGaps([], { modules: [] }, {
    census: [component, utility],
    baseline,
    documents: {
      'llms/fixture.md': '## `lr-other`\n\nNo fixture contract.',
      'llms/shared.md': '- **`different-helper`** — no fixture contract.',
    },
  });
  assert.ok(
    gaps.some(({ tag, names }) =>
      tag === 'lr-fixture' &&
      names.some((name) => name.includes('missing contract locator for FixtureOptions'))),
  );
  assert.ok(
    gaps.some(({ tag, names }) =>
      tag === 'fixture' &&
      names.some((name) => name.includes('missing contract locator for helper'))),
  );
});

test('utility docs require each exact declaration, including zero-parameter functions', () => {
  const contracts = [
    {
      module: 'src/utilities/fixture.ts',
      exportName: 'A',
      kind: 'interface',
      fingerprint: 'a',
      names: ['value'],
      routes: ['src/utilities/fixture.ts'],
      utilityRoutes: ['src/utilities/fixture.ts'],
    },
    {
      module: 'src/utilities/fixture.ts',
      exportName: 'B',
      kind: 'interface',
      fingerprint: 'b',
      names: ['value'],
      routes: ['src/utilities/fixture.ts'],
      utilityRoutes: ['src/utilities/fixture.ts'],
    },
    {
      module: 'src/utilities/fixture.ts',
      exportName: 'flush',
      kind: 'function',
      fingerprint: 'flush',
      names: [],
      routes: ['src/utilities/fixture.ts'],
      utilityRoutes: ['src/utilities/fixture.ts'],
    },
  ];
  const baseline = {
    schemaVersion: 1,
    documented: contracts.map((contract) => baselineOwner(contract)),
    legacy: [],
  };
  const gaps = collectGaps([], { modules: [] }, {
    census: contracts,
    baseline,
    documents: {
      'llms/shared.md': '- **`fixture`** — `B { value: string }` is the only declared contract.',
    },
  });
  assert.ok(gaps.some(({ tag, names }) => tag === 'fixture' && names[0].includes('for A')));
  assert.equal(gaps.some(({ names }) => names[0]?.includes('for B')), false);
  assert.ok(gaps.some(({ tag, names }) => tag === 'fixture' && names[0].includes('for flush')));
});

test('duplicate utility bullets and component sections fail unique locator ownership', () => {
  const utility = {
    module: 'src/utilities/fixture.ts',
    exportName: 'FixtureOptions',
    kind: 'interface',
    fingerprint: 'utility',
    names: ['value'],
    routes: ['src/utilities/fixture.ts'],
    utilityRoutes: ['src/utilities/fixture.ts'],
  };
  const component = {
    module: 'src/components/fixture.ts',
    exportName: 'ComponentOptions',
    kind: 'interface',
    fingerprint: 'component',
    names: ['mode'],
    routes: ['src/components/fixture.ts'],
    utilityRoutes: [],
  };
  const baseline = {
    schemaVersion: 1,
    documented: [
      baselineOwner(utility),
      {
        ...baselineOwner(component),
        document: 'llms/fixture.md',
        family: 'fixture',
        locator: {
          kind: 'component',
          tag: 'lr-fixture',
          declaration: 'ComponentOptions',
        },
      },
    ],
    legacy: [],
  };
  const gaps = collectGaps([], { modules: [] }, {
    census: [utility, component],
    baseline,
    documents: {
      'llms/shared.md': [
        '- **`fixture`** — `FixtureOptions { value: string }`.',
        '- **`fixture`** — `FixtureOptions { value: string }`.',
      ].join('\n'),
      'llms/fixture.md': [
        '## `lr-fixture`',
        '',
        '`ComponentOptions { mode: string }`',
        '',
        '## `lr-fixture`',
        '',
        '`ComponentOptions { mode: string }`',
      ].join('\n'),
    },
  });
  assert.ok(
    gaps.some(({ names }) => names[0]?.includes('utility bullet, found 2')),
  );
  assert.ok(
    gaps.some(({ names }) => names[0]?.includes('lr-fixture section, found 2')),
  );
});

test('semantic document locator identity ignores object key order and dot-path spelling', () => {
  const first = {
    module: 'src/utilities/first.ts',
    exportName: 'FirstOptions',
    kind: 'interface',
    fingerprint: 'first',
    names: ['value'],
    routes: ['src/utilities/first.ts'],
    utilityRoutes: ['src/utilities/first.ts'],
  };
  const second = {
    module: 'src/utilities/second.ts',
    exportName: 'SecondOptions',
    kind: 'interface',
    fingerprint: 'second',
    names: ['value'],
    routes: ['src/utilities/second.ts'],
    utilityRoutes: ['src/utilities/second.ts'],
  };
  const baseline = {
    schemaVersion: 1,
    documented: [
      baselineOwner(first),
      {
        ...baselineOwner(second),
        document: './llms/shared.md',
        locator: {
          declaration: 'FirstOptions',
          name: 'fixture',
          kind: 'utility',
        },
      },
    ],
    legacy: [],
  };
  assert.ok(
    validateSourceContractBaseline([first, second], baseline)
      .some((finding) => finding.includes('duplicate source-contract document locator')),
  );
});

test('exact interface locators retain nested generic defaults and constraints', () => {
  const signatures = [
    'Grid<Row = Record<string, unknown>> { readonly row: Row; }',
    'Grid<Row extends { readonly id: string }> { readonly row: Row; }',
    'Grid<Node, Link extends LinkDatum<Node>> { node: Node; link: Link; }',
  ];
  for (const signature of signatures) {
    const text = '\x60' + signature + '\x60';
    assert.equal(contractDeclarationBlock(text, 'Grid', 'interface'), text);
  }
  assert.equal(contractDeclarationBlock('\x60Grid<Row = Record<string, unknown>>(row)\x60', 'Grid', 'interface'), '');
  assert.equal(contractDeclarationBlock('\x60Grid<Row = Record<string, unknown>>.value\x60', 'Grid', 'interface'), '');
});

test('exact helper locators retain nested generic defaults and indented overloads', () => {
  const signature = '\x60create<T = Record<string, unknown>>(value: T): T\x60';
  const overloads = '\x60load(value: string): string;\n  load(value: number): number;\x60';
  assert.equal(contractDeclarationBlock(signature, 'create', 'function'), signature);
  assert.equal(contractDeclarationBlock(overloads, 'load', 'function'), overloads);
  assert.equal(contractDeclarationBlock('\x60create<Record<string, unknown>>(value)\x60', 'create', 'function'), '');
});

if (failures > 0) {
  console.error(`${failures} llms-gaps test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`llms-gaps self-test passed (${passes} cases).`);
}
