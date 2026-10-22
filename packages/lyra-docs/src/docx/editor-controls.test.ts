import assert from 'node:assert/strict';
import test from 'node:test';
import { replacementSearchIndex } from './editor-controls.js';
const base = { query: 'cat', replacement: 'dog', before: ' ', after: ' ', matchCase: false,
  wholeWord: false, previousCount: 2, nextCount: 1, index: 0, truncated: false };

test('replacement advances past all new matches including case-insensitive and whole-word variants', () => {
  assert.equal(replacementSearchIndex(base), 0);
  assert.equal(replacementSearchIndex({ ...base, replacement: 'catcat', nextCount: 3 }), 2);
  assert.equal(replacementSearchIndex({ ...base, replacement: 'CAT', nextCount: 2 }), 1);
  assert.equal(replacementSearchIndex({ ...base, replacement: 'cat cat cat', nextCount: 4 }), 3);
  assert.equal(replacementSearchIndex({ ...base, replacement: 'catcat', wholeWord: true }), 0);
  assert.equal(replacementSearchIndex({ ...base, replacement: 'cat cat', wholeWord: true, nextCount: 3 }), 2);
});

test('replacement-created only matches, changed topology and truncation require explicit selection', () => {
  assert.equal(replacementSearchIndex({ ...base, previousCount: 1, replacement: 'catcat', nextCount: 2 }), -1);
  assert.equal(replacementSearchIndex({ ...base, replacement: 'cat', nextCount: 3 }), -1);
  assert.equal(replacementSearchIndex({ ...base, truncated: true }), -1);
  assert.equal(replacementSearchIndex({ ...base, nextCount: 0 }), -1);
});

test('new cross-boundary matches require an explicit choice even when total match counts agree', () => {
  assert.equal(replacementSearchIndex({ ...base, query: 'aa', before: '', after: 'aa aa', replacement: 'a', previousCount: 3, nextCount: 2 }), -1);
  assert.equal(replacementSearchIndex({ ...base, query: 'aa', before: 'a', after: ' aa', replacement: 'a', nextCount: 1 }), -1);
  assert.equal(replacementSearchIndex({ ...base, query: 'ab', before: 'a', after: 'b ab', replacement: '', nextCount: 2 }), -1);
});

test('a case-sensitive replacement counts only exact-case matches as new', () => {
  // Folded, CAT is a new match of "cat"; matching case, it is not.
  assert.equal(replacementSearchIndex({ ...base, replacement: 'CAT', nextCount: 2 }), 1);
  assert.equal(replacementSearchIndex({ ...base, replacement: 'CAT', nextCount: 2, matchCase: true }), -1);
  assert.equal(replacementSearchIndex({ ...base, replacement: 'CAT', nextCount: 1, matchCase: true }), 0);
  assert.equal(replacementSearchIndex({ ...base, replacement: 'cat', nextCount: 2, matchCase: true }), 1);
  // A match that only forms across the replacement's edge needs the same case to count at all.
  const edge = { ...base, query: 'Cat', before: 'ca', replacement: 't', previousCount: 2, nextCount: 1 };
  assert.equal(replacementSearchIndex(edge), -1);
  assert.equal(replacementSearchIndex({ ...edge, matchCase: true }), 0);
});

test('a long query beside a full-length excerpt cannot establish a safe advance', () => {
  const long = (length: number, before: number, after: number) => ({ ...base, query: 'q'.repeat(length), replacement: 'dog',
    before: 'x'.repeat(before), after: 'x'.repeat(after), previousCount: 2, nextCount: 1 });
  // The excerpt may have been clipped at 48 characters, hiding a match that extends past it.
  assert.equal(replacementSearchIndex(long(50, 48, 1)), -1);
  assert.equal(replacementSearchIndex(long(50, 1, 48)), -1);
  assert.equal(replacementSearchIndex(long(80, 60, 60)), -1);
  // Both limits are exact: shorter context, or a query of 49 characters, is still safe.
  assert.equal(replacementSearchIndex(long(50, 47, 47)), 0);
  assert.equal(replacementSearchIndex(long(49, 48, 48)), 0);
});

test('a replacement at the very edge of the excerpt has no word beside it on that side', () => {
  // "cat" ends the replacement with nothing after it, and starts it with nothing before it.
  assert.equal(replacementSearchIndex({ ...base, replacement: 'big cat', after: '', wholeWord: true, nextCount: 2 }), 1);
  assert.equal(replacementSearchIndex({ ...base, replacement: 'cat dog', before: '', wholeWord: true, nextCount: 2 }), 1);
});
