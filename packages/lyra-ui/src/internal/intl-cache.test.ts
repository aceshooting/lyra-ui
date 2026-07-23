import { expect } from '@open-wc/testing';
import {
  getCollator,
  getDateTimeFormat,
  getDisplayNames,
  getListFormat,
  getNumberFormat,
} from './intl-cache.js';

it('memoizes Intl.NumberFormat per locale + options, insensitive to option key order', () => {
  const a = getNumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
  const b = getNumberFormat('en-US', { maximumFractionDigits: 1, style: 'percent' });
  expect(a === b).to.be.true;
  expect(a.format(0.5)).to.equal('50%');
});

it('returns distinct Intl.NumberFormat instances for different locales or options', () => {
  const base = getNumberFormat('en-US');
  expect(base === getNumberFormat('de-DE')).to.be.false;
  expect(base === getNumberFormat('en-US', { style: 'percent' })).to.be.false;
  expect(base === getNumberFormat('en-US')).to.be.true;
});

it('memoizes Intl.DateTimeFormat and formats with the requested options', () => {
  const a = getDateTimeFormat('en-US', { year: 'numeric', month: 'long' });
  const b = getDateTimeFormat('en-US', { month: 'long', year: 'numeric' });
  expect(a === b).to.be.true;
  expect(a.format(new Date(2020, 0, 15))).to.equal('January 2020');
});

it('memoizes Intl.DisplayNames and resolves display names', () => {
  const a = getDisplayNames('en', { type: 'region' });
  const b = getDisplayNames('en', { type: 'region' });
  expect(a === b).to.be.true;
  expect(a.of('FR')).to.equal('France');
  expect(a === getDisplayNames('en', { type: 'language' })).to.be.false;
});

it('memoizes Intl.Collator and applies locale-aware numeric ordering', () => {
  const a = getCollator('en-US', { numeric: true });
  const b = getCollator('en-US', { numeric: true });
  expect(a === b).to.be.true;
  expect(['item10', 'item2'].sort(a.compare)).to.deep.equal(['item2', 'item10']);
  expect(a === getCollator('en-US', { numeric: false })).to.be.false;
});

it('memoizes Intl.ListFormat and formats locale-aware lists', () => {
  const a = getListFormat('en-US', { style: 'long', type: 'conjunction' });
  const b = getListFormat('en-US', { type: 'conjunction', style: 'long' });
  expect(a === b).to.be.true;
  expect(a.format(['Alpha', 'Beta', 'Gamma'])).to.equal('Alpha, Beta, and Gamma');
});

it('evicts the least recently used entry once a kind exceeds its bound', () => {
  const first = getNumberFormat('en-US', { minimumIntegerDigits: 21 });
  // A cache hit refreshes recency rather than constructing anew.
  expect(first === getNumberFormat('en-US', { minimumIntegerDigits: 21 })).to.be.true;
  // Insert 64 distinct fresh entries. The cache holds at most 64 per kind and
  // evicts least-recently-used, so 64 fresh insertions purge every entry that
  // preceded them — including `first` — no matter how full the cache was.
  for (let digits = 1; digits <= 16; digits++) {
    for (const locale of ['en-US', 'de-DE', 'fr-FR', 'ja-JP']) {
      getNumberFormat(locale, { minimumIntegerDigits: digits });
    }
  }
  expect(first === getNumberFormat('en-US', { minimumIntegerDigits: 21 })).to.be.false;
  // The most recent entries survived untouched.
  const kept = getNumberFormat('ja-JP', { minimumIntegerDigits: 16 });
  expect(kept === getNumberFormat('ja-JP', { minimumIntegerDigits: 16 })).to.be.true;
});
