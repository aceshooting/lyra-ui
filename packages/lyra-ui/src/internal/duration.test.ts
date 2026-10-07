import { expect } from '@open-wc/testing';
import { durationMessageValue, formatShortDuration, safeDurationMs } from './duration.js';

it('omits absent or non-finite durations and clamps finite negative durations to zero', () => {
  expect(safeDurationMs(undefined)).to.equal(null);
  expect(safeDurationMs(Number.NaN)).to.equal(null);
  expect(safeDurationMs(Number.POSITIVE_INFINITY)).to.equal(null);
  expect(safeDurationMs(-4)).to.equal(0);
  expect(safeDurationMs(4)).to.equal(4);
});

it('normalizes every duration boundary through one side-effect-free value model', () => {
  expect(durationMessageValue(820)).to.deep.equal({ key: 'durationMilliseconds', value: 820 });
  expect(durationMessageValue(1500)).to.deep.equal({ key: 'durationSeconds', value: 1.5 });
  expect(durationMessageValue(2000)).to.deep.equal({ key: 'durationSeconds', value: 2 });
  expect(durationMessageValue(-20)).to.deep.equal({ key: 'durationMilliseconds', value: 0 });
  expect(durationMessageValue(Number.NaN)).to.deep.equal({ key: 'durationMilliseconds', value: 0 });
});

it('formats the normalized duration with the caller locale and localization key', () => {
  const calls: Array<{ key: string; value: string }> = [];
  const localize = (_key: string, _fallback: undefined, values: { value: string }) => {
    calls.push({ key: _key, value: values.value });
    return `${_key}:${values.value}`;
  };

  expect(formatShortDuration(localize, 'de-DE', 1500)).to.equal('durationSeconds:1,5');
  expect(formatShortDuration(localize, 'en-US', -2)).to.equal('durationMilliseconds:0');
  expect(calls.map(({ key }) => key)).to.deep.equal(['durationSeconds', 'durationMilliseconds']);
});
