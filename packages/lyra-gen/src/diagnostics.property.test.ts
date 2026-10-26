import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { LYRA_GEN_FAILURE_CATEGORIES, summarizeFailureCategories } from './diagnostics.js';

test('arbitrary diagnostic strings cannot enter category payloads or affect category ordering', () => {
  fc.assert(fc.property(fc.array(fc.string({ maxLength: 100 }), { maxLength: 120 }), codes => {
    const diagnostics = codes.map(code => ({ code, path: 'secret path', message: 'secret message', severity: 'error' as const }));
    const categories = summarizeFailureCategories(diagnostics);
    assert.equal(new Set(categories).size, categories.length);
    assert.equal(categories.every(category => LYRA_GEN_FAILURE_CATEGORIES.includes(category)), true);
    assert.equal(Object.isFrozen(categories), true);
    assert.equal(JSON.stringify(categories).includes('secret'), false);
  }), propertyRuns());
});
