// Self-test for check-style-vocabulary.mjs. A gate that parses source can start matching nothing and
// pass vacuously, which is worse than failing -- so the parser is exercised directly against the
// shapes it is supposed to catch and the shapes it must leave alone.
//
// Run: node scripts/check-style-vocabulary.test.mjs

import assert from 'node:assert/strict';
import { key, readStringUnions } from './check-style-vocabulary.mjs';

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

console.log(`Style-vocabulary checker self-test passed (${passed} cases).`);
