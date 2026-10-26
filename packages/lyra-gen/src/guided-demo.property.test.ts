import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { calculateTravelBudget, createGuidedDemo } from '../examples/guided-demo.js';
import { initialCatalog } from './catalog.js';
import { createChatStream } from './chat.js';
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

test('localized literal text cannot add nodes or change admitted scenario data', () => {
  const defaults = createGuidedDemo({ packageVersion: '1.0.0' });
  const labels = defaults.snapshot.labels;
  defaults.dispose();
  const literal = fc.array(fc.constantFrom('a', 'é', 'א', 'ع', '中', '🌦', '"', '\'', '<', '>', '&', '\\', '\n', '\r'), { maxLength: 40 })
    .map(units => `Text <input id="injected"/> ${units.join('')}`);
  fc.assert(fc.property(literal, text => {
    const demo = createGuidedDemo({ packageVersion: '1.0.0', localization: {
      locale: 'de-DE', direction: 'rtl', labels: { ...labels, markets: text, marketsReply: text, cityLisbon: text },
    } });
    try {
      for (const scenario of ['markets', 'weather'] as const) {
        demo.selectScenario(scenario);
        const chat = createChatStream({ catalog: initialCatalog, messageId: 'copy-oracle', surfaceId: 'copy-oracle', strings: demo.snapshot.chatStrings });
        try {
          chat.push(demo.snapshot.source);
          const admitted = chat.finish();
          assert.equal(admitted.diagnostics.length, 0);
          assert.deepEqual(admitted.islands.map(island => island.document?.root.id), ['summary', 'dashboard']);
          const dashboard = admitted.islands[1]?.document?.root;
          assert.deepEqual(dashboard?.children?.map(node => [node.id, node.type]), [['title', 'heading'], ['records', 'table'], ['comparison', 'chart']]);
          if (scenario === 'markets') {
            assert.equal(admitted.islands[0]?.document?.root.text, text);
            assert.equal(dashboard?.children?.[0]?.text, text);
            assert.deepEqual(dashboard?.children?.[2]?.props?.['datasets'], [
              { label: 'Orchard', data: [101.2, 102.1, 103.4] }, { label: 'Harbor', data: [100.8, 100.1, 101.6] }, { label: 'Meadow', data: [99.7, 100.5, 100.9] },
            ]);
          } else {
            assert.deepEqual(dashboard?.children?.[1]?.props?.['rows'], [
              { c0: labels.cityLyon, c1: 18, c2: 20 }, { c0: text, c1: 23, c2: 5 }, { c0: labels.cityOslo, c1: 12, c2: 60 },
            ]);
            assert.deepEqual(dashboard?.children?.[2]?.props?.['labels'], [labels.cityLyon, text, labels.cityOslo]);
          }
        } finally { chat.dispose(); }
      }
    } finally { demo.dispose(); }
  }), propertyRuns());
});
