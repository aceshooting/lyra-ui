// Self-test for check-style-vocabulary.mjs. A gate that parses source can start matching nothing and
// pass vacuously, which is worse than failing -- so the parser is exercised directly against the
// shapes it is supposed to catch and the shapes it must leave alone.
// Run: node scripts/check-style-vocabulary.test.mjs

import assert from 'node:assert/strict';
import {
  ALLOWED,
  ALLOWED_INLINE,
  buildSharedVocabulary,
  fileFindings,
  importsSharedUnion,
  key,
  readInlineStringUnions,
  readStringUnions,
  stripComments,
} from './check-style-vocabulary.mjs';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check('reads a single-line string union', () => {
  const unions = readStringUnions(`export type ButtonVariant = 'neutral' | 'brand' | 'danger';`);
  assert.deepEqual(unions.get('ButtonVariant'), ['neutral', 'brand', 'danger']);
});

check('reads several unions from one file', () => {
  const unions = readStringUnions(
    `export type A = 'x' | 'y';\nexport type B = 'p' | 'q' | 'r';\n`,
  );
  assert.equal(unions.size, 2);
  assert.deepEqual(unions.get('B'), ['p', 'q', 'r']);
});

check('ignores a non-exported type', () => {
  assert.equal(readStringUnions(`type Local = 'a' | 'b';`).size, 0);
});

check('ignores a single-member alias, which is not a union', () => {
  assert.equal(readStringUnions(`export type Only = 'a';`).size, 0);
});

check('ignores a union of non-string members', () => {
  assert.equal(readStringUnions(`export type N = 1 | 2 | 3;`).size, 0);
  assert.equal(readStringUnions(`export type T = Foo | Bar;`).size, 0);
});

check('key is order-insensitive, so a reordered copy still collides', () => {
  assert.equal(key(['neutral', 'brand', 'danger']), key(['danger', 'brand', 'neutral']));
});

check('key distinguishes a genuine subset from the full union', () => {
  assert.notEqual(key(['neutral', 'brand', 'danger']), key(['neutral', 'danger']));
});

check('a renamed copy of the same members still collides', () => {
  const shared = readStringUnions(`export type LyraVariant = 'neutral' | 'brand' | 'danger';`);
  const local = readStringUnions(`export type BadgeTone = 'brand' | 'danger' | 'neutral';`);
  assert.equal(key(shared.get('LyraVariant')), key(local.get('BadgeTone')));
});

check('combines styling and shared-value vocabulary owners without losing their module', () => {
  const owners = buildSharedVocabulary([
    {
      modulePath: 'internal/variants.ts',
      source: `export type LyraVariant = 'neutral' | 'brand';`,
    },
    {
      modulePath: 'internal/shared-unions.ts',
      source: `export type LyraOrientation = 'horizontal' | 'vertical';`,
    },
  ]);

  assert.deepEqual(owners.get(key(['brand', 'neutral'])), {
    name: 'LyraVariant',
    modulePath: 'internal/variants.ts',
  });
  assert.deepEqual(owners.get(key(['vertical', 'horizontal'])), {
    name: 'LyraOrientation',
    modulePath: 'internal/shared-unions.ts',
  });
});

// The inline rule: the shapes a size ladder takes once a component author knows `export type` is
// checked. Every fixture below is a real shape from this repository, reduced to the one line that
// matters.
const LADDER = "export type LyraSizeStep = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';";
const STATUS = "export type LyraToolStatus = 'pending' | 'running' | 'denied';";
const vocabulary = () =>
  buildSharedVocabulary([
    { modulePath: 'internal/variants.ts', source: LADDER },
    { modulePath: 'internal/shared-unions.ts', source: STATUS },
  ]);

check('reads a union annotated straight onto a property, which no export type rule can see', () => {
  const unions = readInlineStringUnions(
    "@property({ reflect: true }) size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm';",
  );
  assert.equal(unions.length, 1);
  assert.deepEqual(unions[0].members, ['2xs', 'xs', 's', 'm', 'l', 'xl']);
});

check('reads a union the formatter wrapped across lines', () => {
  const unions = readInlineStringUnions("type Local =\n  | 'horizontal'\n  | 'vertical';");
  assert.equal(unions.length, 1);
  assert.deepEqual(unions[0].members, ['horizontal', 'vertical']);
});

check('ignores a comma-separated list of allowed values, which is not a union', () => {
  assert.equal(readInlineStringUnions("literalSetConverter(['s', 'm', 'l'], 'm')").length, 0);
});

check('importsSharedUnion sees a type-only named import of the canonical name', () => {
  const source = "import { normalizeSize, type LyraSizeStep } from '../../../internal/variants.js';";
  assert.equal(importsSharedUnion(source, 'LyraSizeStep'), true);
  assert.equal(importsSharedUnion(source, 'LyraVariant'), false);
});

check('importsSharedUnion ignores a same-named import from somewhere else', () => {
  const source = "import type { LyraSizeStep } from './local-copy.js';";
  assert.equal(importsSharedUnion(source, 'LyraSizeStep'), false);
});

check('reports an inline ladder written onto the property with no import', () => {
  const findings = fileFindings(
    'src/components/data/gauge/gauge.class.ts',
    "@property({ reflect: true }) size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm';",
    vocabulary(),
  );
  assert.equal(findings.length, 1);
  assert.match(findings[0], /inline union re-spells every member of `LyraSizeStep`/);
  assert.match(findings[0], /internal\/variants\.ts/);
});

check('accepts the same members when the canonical name is imported and widened', () => {
  const source = [
    "import { type LyraSizeStep } from '../../../internal/variants.js';",
    "export type ChipSize = LyraSizeStep | '3xs';",
    "const CHIP = ['3xs', '2xs', 'xs', 's', 'm', 'l', 'xl'];",
  ].join('\n');
  assert.deepEqual(fileFindings('src/components/overlays/chip/chip.class.ts', source, vocabulary()), []);
});

check('leaves the shared-value vocabulary to the alias rule, so a mirrored signature keeps its printed text', () => {
  const source = "setStatus(status: 'pending' | 'running' | 'denied'): void {}";
  assert.deepEqual(fileFindings('src/components/forms/input/input.class.ts', source, vocabulary()), []);
});

check('reports a file that both exports the copy and annotates with it exactly once', () => {
  const source = [
    "export type GaugeSize = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';",
    "declare const size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';",
  ].join('\n');
  const findings = fileFindings('src/components/data/gauge/gauge.class.ts', source, vocabulary());
  assert.equal(findings.length, 1);
  assert.match(findings[0], /`GaugeSize` duplicates `LyraSizeStep`/);
});

// Comment handling. Both readers regex raw text, so prose that merely SPELLS a vocabulary out used
// to be indistinguishable from a re-declaration -- on a blocking gate, a sentence stopping a
// release. These pin the strip, including the two ways a naive strip goes wrong in the other
// direction and silently eats real code.
check('strips a line comment and a block comment', () => {
  assert.equal(stripComments("const a = 1; // note\nconst b = 2;"), 'const a = 1;  \nconst b = 2;');
  assert.equal(stripComments('const a = /* note */ 2;'), 'const a =   2;');
});

check('leaves a doubled slash inside a string alone, so it cannot open a comment', () => {
  const source = "const url = 'https://example.test/a';\nexport type X = 'a' | 'b';";
  assert.equal(stripComments(source), source);
});

check('leaves a slash-star inside a glob string alone, which would otherwise swallow the file', () => {
  const source = "const glob = '**/*.ts';\nexport type X = 'a' | 'b';";
  assert.equal(stripComments(source), source);
});

check('leaves a regular-expression literal alone, escaped slashes and all', () => {
  const source = "const re = /url\\s*\\(|\\\\/i;\nexport type X = 'a' | 'b';";
  assert.equal(stripComments(source), source);
});

check('ignores a ladder spelled out in doc-comment prose, which documents rather than declares', () => {
  const source = [
    '/**',
    " * Density tier: one of '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl'.",
    ' */',
    "@property({ reflect: true }) size?: LyraSizeStep;",
  ].join('\n');
  assert.deepEqual(fileFindings('src/components/data/gauge/gauge.class.ts', source, vocabulary()), []);
});

check('ignores a commented-out copy, which is not a live declaration', () => {
  const source = "// export type GaugeSize = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';";
  assert.deepEqual(fileFindings('src/components/data/gauge/gauge.class.ts', source, vocabulary()), []);
});

check('ALLOWED_INLINE suppresses the inline rule for one recorded file and canonical name', () => {
  const where = 'src/components/data/gauge/gauge.class.ts';
  const source = "declare const size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';";
  assert.equal(fileFindings(where, source, vocabulary()).length, 1);

  ALLOWED_INLINE.set(`${where}:LyraSizeStep`, 'self-test fixture');
  try {
    assert.deepEqual(fileFindings(where, source, vocabulary()), []);
  } finally {
    ALLOWED_INLINE.delete(`${where}:LyraSizeStep`);
  }
  assert.equal(fileFindings(where, source, vocabulary()).length, 1);
});

check('one ALLOWED decision covers both rules, so the same members need no second entry', () => {
  const where = 'src/components/data/gauge/gauge.class.ts';
  const source = [
    "export type GaugeSize = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';",
    "declare const size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';",
  ].join('\n');

  ALLOWED.set('GaugeSize', 'self-test fixture');
  try {
    assert.deepEqual(fileFindings(where, source, vocabulary()), []);
  } finally {
    ALLOWED.delete('GaugeSize');
  }
  assert.equal(fileFindings(where, source, vocabulary()).length, 1);
});


console.log(`Style-vocabulary checker self-test passed (${passed} cases).`);
