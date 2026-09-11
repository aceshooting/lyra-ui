// Self-test for the attribute-polarity half of the migration-coverage gate.
//
// This exists because that gate was found to be structurally incapable of failing. It iterated
// `upstream-tags.json#attributeRenames`, which held ten entries: nine identity mappings
// (`from === to`, which `generate-component-inventory.mjs` already filters out downstream) and one
// case normalization with no polarity on either side. Zero polarity-bearing pairs ever reached
// `hasInvertedPolarity`, so the check reported success while being unable to reject anything.
//
// A green gate that cannot fail is worse than an absent one: it is counted as coverage. These
// cases pin the behaviour from both directions -- an inversion must be caught, and a clean mapping
// must stay silent -- so the gate cannot quietly regress into vacuity again.
//
// Run: node scripts/check-migration-coverage.test.mjs

import assert from 'node:assert/strict';
import {
  analyzeMigrationCoverage,
  hasInvertedPolarity,
  invertedName,
  isPolarityCheckable,
} from './check-migration-coverage.mjs';

// --- unit level -------------------------------------------------------------------------------

assert.equal(hasInvertedPolarity('light-dismiss', 'no-light-dismiss'), true);
assert.equal(hasInvertedPolarity('with-legend', 'without-legend'), true);
assert.equal(hasInvertedPolarity('show-header', 'hide-header'), true);
assert.equal(hasInvertedPolarity('without-legend', 'without-legend'), false);
assert.equal(hasInvertedPolarity('size', 'scale'), false, 'two polarity-neutral names never invert');

assert.equal(invertedName('without-legend'), 'with-legend');
assert.equal(invertedName('with-legend'), 'without-legend');
assert.equal(invertedName('hide-header'), 'show-header');
assert.equal(invertedName('disable-x'), 'enable-x');
assert.equal(invertedName('size'), null, 'a polarity-neutral name has no inverted twin');

// The regression that made the gate vacuous: identity entries and polarity-neutral renames are
// exactly what the fixture was full of, and neither can produce a verdict.
assert.equal(isPolarityCheckable({ from: 'with-clear', to: 'with-clear' }), false);
assert.equal(isPolarityCheckable({ from: 'submenuOpen', to: 'submenu-open' }), false);
assert.equal(isPolarityCheckable({ from: 'with-legend', to: 'without-legend' }), true);

// --- integration level ------------------------------------------------------------------------

/** Minimal synthetic inputs. Unrelated structural errors are expected and filtered out below. */
function inputs({ upstreamAttributes, lyraAttributes, rewrites = [] }) {
  return {
    inventory: {
      schemaVersion: 1,
      upstreams: {
        webawesome: {
          version: '3.11.0',
          commit: 'test',
          components: [
            {
              tag: 'wa-fixture',
              surface: { attributes: upstreamAttributes.map((name) => ({ name, property: name })) },
            },
          ],
        },
        shoelace: { version: '2.20.1', commit: 'test', components: [] },
      },
      mappings: [
        {
          upstreamTag: 'wa-fixture',
          targetTag: 'lr-fixture',
          classification: 'rewritten',
          rewrites: { attributes: rewrites },
        },
      ],
    },
    upstreamTags: {
      webawesome: { version: '3.11.0', commit: 'test', free: ['wa-fixture'], pro: [] },
      shoelace: { version: '2.20.1', commit: 'test', tags: [] },
      attributeRenames: [],
    },
    lyraManifest: {
      schemaVersion: '2.1.0',
      modules: [
        {
          kind: 'javascript-module',
          path: 'fixture.js',
          declarations: [
            {
              kind: 'class',
              name: 'LyraFixture',
              customElement: true,
              tagName: 'lr-fixture',
              attributes: lyraAttributes.map((name) => ({ name })),
            },
          ],
        },
      ],
    },
    readme: '| `<lr-fixture>` | `wa-fixture` | fixture |',
  };
}

const polarityErrors = (result) =>
  result.errors.filter((error) => /polarity|inverted/.test(error));

// 1. An explicit rewrite that flips polarity is caught.
{
  const result = analyzeMigrationCoverage(
    inputs({
      upstreamAttributes: ['with-legend'],
      lyraAttributes: ['without-legend'],
      rewrites: [{ from: 'with-legend', to: 'without-legend' }],
    }),
  );
  const found = polarityErrors(result);
  assert.ok(
    found.some((error) => error.includes('with-legend') && error.includes('without-legend')),
    `an explicitly inverted rewrite must be reported, got: ${JSON.stringify(found)}`,
  );
}

// 2. An UNDECLARED inversion is caught: upstream declares `without-legend`, no rewrite claims a
//    rename, and the Lyra tag ships only the opposite-polarity `with-legend`. The codemod would
//    emit `without-legend`, which matches nothing, so the consumer silently gets the default.
{
  const result = analyzeMigrationCoverage(
    inputs({ upstreamAttributes: ['without-legend'], lyraAttributes: ['with-legend'] }),
  );
  const found = polarityErrors(result);
  assert.ok(
    found.some((error) => error.includes('without-legend') && error.includes('with-legend')),
    `an undeclared inversion must be reported, got: ${JSON.stringify(found)}`,
  );
}

// 3. Negative control: the same polarity-bearing attribute on both sides is clean.
{
  const result = analyzeMigrationCoverage(
    inputs({ upstreamAttributes: ['without-legend'], lyraAttributes: ['without-legend'] }),
  );
  assert.deepEqual(
    polarityErrors(result),
    [],
    'a preserved polarity must not be reported as an inversion',
  );
}

// 4. Negative control: a polarity-neutral attribute never produces a polarity verdict either way.
{
  const result = analyzeMigrationCoverage(
    inputs({ upstreamAttributes: ['size'], lyraAttributes: ['scale'] }),
  );
  assert.deepEqual(polarityErrors(result), [], 'polarity-neutral names produce no polarity verdict');
}

console.log('migration-coverage attribute-polarity tests passed.');
