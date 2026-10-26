import test from 'node:test';
import assert from 'node:assert/strict';
import { visualOptions, checkVisualBaseline, VISUAL_CASES } from './visual.mjs';

test('visual captures need explicit destinations and never implicitly review baselines', () => {
  assert.deepEqual(visualOptions(['--capture', '--browser=firefox', '--baselines=candidate', '--output=report.json']), {
    browser: 'firefox', capture: true, baselines: 'candidate', output: 'report.json',
  });
  for (const args of [[], ['--baselines=images'], ['--output=report.json'], ['--browser=unknown', '--baselines=images', '--output=report.json'], ['--approve']]) assert.throws(() => visualOptions(args));
});

test('comparison requires reviewed images, the complete case set and matching environment', () => {
  const identity = { browser: 'chromium', fixtureHash: 'fixture', font: { platformFonts: ['PinnedSans-SemiBold'] } };
  const baseline = { schemaVersion: 1, reviewed: true, identity, cases: Object.fromEntries(VISUAL_CASES.map(name => [name, 'hash'])) };
  checkVisualBaseline(baseline, identity);
  assert.throws(() => checkVisualBaseline({ ...baseline, reviewed: false }, identity));
  assert.throws(() => checkVisualBaseline(baseline, { ...identity, fixtureHash: 'changed' }));
  assert.throws(() => checkVisualBaseline(baseline, { ...identity, font: { platformFonts: ['SubstitutedSans-Bold'] } }));
  assert.throws(() => checkVisualBaseline({ ...baseline, cases: { idle: 'hash' } }, identity));
});
