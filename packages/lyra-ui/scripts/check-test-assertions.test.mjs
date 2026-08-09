import assert from 'node:assert/strict';
import test from 'node:test';

import { isDomTypeDescription } from './check-test-assertions.mjs';

test('recognizes direct, nullable, collection, and inherited DOM assertion payloads', () => {
  assert.equal(isDomTypeDescription('HTMLButtonElement | null'), true);
  assert.equal(isDomTypeDescription('NodeListOf<Element>'), true);
  assert.equal(isDomTypeDescription('HTMLElement[]'), true);
  assert.equal(isDomTypeDescription('CustomControl', ['CustomControl', 'HTMLElement']), true);
});

test('accepts primitive projections and ordinary data payloads', () => {
  assert.equal(isDomTypeDescription('string'), false);
  assert.equal(isDomTypeDescription('boolean'), false);
  assert.equal(isDomTypeDescription('{ id: string; label: string }'), false);
  assert.equal(isDomTypeDescription('string | null', ['String']), false);
});
