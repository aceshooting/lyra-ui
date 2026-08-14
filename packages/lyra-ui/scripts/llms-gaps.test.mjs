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
    ...(status === 'documented'
      ? {
          document: 'llms/shared.md',
          family: 'shared',
          locator: { kind: 'utility', name: 'fixture' },
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
        "  { publicKey: localAlias = 'fallback' }: { publicKey?: string },",
        '  callback: (options: { limit?: number }) => void,',
        '): void { void localAlias; void callback; }',
      ].join('\n'),
      'src/utilities/fixture.ts': [
        "export { fixture } from '../internal/fixture.js';",
        "export type { FixtureOptions } from '../internal/fixture.js';",
      ].join('\n'),
    },
    (fixtureDir) => {
      const modules = {
        componentModules: [],
        utilityModules: ['src/utilities/fixture.ts'],
      };
      const census = sourceContractCensus(fixtureDir, modules);
      assert.equal(census.length, 2);
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
        "  { publicKey: localAlias = 'fallback' }: { publicKey?: string },",
        '  callback: (options: { limit?: number }) => void,',
        '): void { void localAlias; void callback; }',
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
    },
  );
});

test('the source-contract baseline fails closed for new, renamed, stale, and duplicate owners', () => {
  withSourceContractFixture(
    {
      'src/components/fixture.ts': 'export interface LegacyContract { value: string; }',
      'src/utilities/fixture.ts': 'export function fixture(value: string): void { void value; }',
      'src/utilities/new-helper.ts': 'export interface NewUtilityOptions { enabled?: boolean; }',
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
      assert.ok(utilityFindings.some((finding) => finding.includes('uncatalogued public source contract')));
      assert.ok(utilityFindings.some((finding) => finding.includes('lacks documented enrollment')));

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
      tag === 'lr-fixture' && names.includes('missing contract locator for FixtureOptions')),
  );
  assert.ok(
    gaps.some(({ tag, names }) =>
      tag === 'fixture' && names.includes('missing contract locator for helper')),
  );
});

if (failures > 0) {
  console.error(`${failures} llms-gaps test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`llms-gaps self-test passed (${passes} cases).`);
}
