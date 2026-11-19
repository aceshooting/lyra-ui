import { expect } from '@open-wc/testing';
import { formatMediaTime, withCurrentRate } from './media-time.js';

it('formats whole media seconds, rounded down', () => {
  for (const [seconds, expected] of [
    [0, '0:00'],
    [9, '0:09'],
    [60, '1:00'],
    [3599, '59:59'],
    [3600, '1:00:00'],
    [3661.9, '1:01:01'],
    [-7, '0:00'],
    [Number.NaN, '0:00'],
    [Number.POSITIVE_INFINITY, '0:00'],
  ] as const) {
    expect(formatMediaTime(seconds, 'en-US')).to.equal(expected);
  }
  expect(formatMediaTime(59.6, 'en-US')).to.equal('0:59');
  expect(formatMediaTime(3599.6, 'en-US')).to.equal('59:59');
});

it('keeps locale digits and minute padding for hour-bearing media time', () => {
  const regular = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0, useGrouping: false });
  const padded = new Intl.NumberFormat('ar-EG', {
    maximumFractionDigits: 0,
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  expect(formatMediaTime(65, 'ar-EG')).to.equal(`${regular.format(1)}:${padded.format(5)}`);
  expect(formatMediaTime(3665, 'ar-EG')).to.equal(
    `${regular.format(1)}:${padded.format(1)}:${padded.format(5)}`,
  );
});

it('inserts an off-list playback rate in order and keeps the list identity otherwise', () => {
  const rates = [0.5, 1, 2] as const;
  expect(withCurrentRate(rates, 1.25)).to.deep.equal([0.5, 1, 1.25, 2]);
  expect(withCurrentRate(rates, 1) === rates).to.equal(true);
  for (const bad of [Number.NaN, 0, -1, Number.POSITIVE_INFINITY]) {
    expect(withCurrentRate(rates, bad) === rates).to.equal(true);
  }
  expect(rates).to.deep.equal([0.5, 1, 2]);
});
