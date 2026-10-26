import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { calculateTravelBudget } from '../examples/guided-demo.js';
import { propertyRuns } from '../test/property-options.js';

const inputs = fc.record({ nights: fc.integer({ min: 1, max: 29 }), travelers: fc.integer({ min: 1, max: 8 }), budgetCents: fc.integer({ min: 0, max: 10000000 }) }, { noNullPrototype: true });

test('travel accounting and an added night obey the independent sample rates in whole cents', () => {
  fc.assert(fc.property(inputs, ({ nights, travelers, budgetCents }) => {
    const budget = budgetCents / 100;
    const result = calculateTravelBudget({ nights, travelers, budget });
    const expected = nights * 95 + (nights + 1) * travelers * (28 + 8) + travelers * 45;
    assert.equal(result.total, expected);
    assert.equal(result.lodging + result.meals + result.transit + result.activities, expected);
    assert.equal(result.remaining, (budgetCents - expected * 100) / 100);
    const addedNight = calculateTravelBudget({ nights: nights + 1, travelers, budget });
    assert.equal(addedNight.total - result.total, 95 + travelers * 36);
    const extraTraveler = travelers < 8 ? calculateTravelBudget({ nights, travelers: travelers + 1, budget }) : undefined;
    if (extraTraveler) assert.equal(extraTraveler.total - result.total, (nights + 1) * 36 + 45);
    assert.ok(Object.values(result).every(Number.isFinite));
  }), propertyRuns());
});
