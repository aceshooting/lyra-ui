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
