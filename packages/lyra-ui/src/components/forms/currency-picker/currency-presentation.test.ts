import { expect } from '@open-wc/testing';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { DEFAULT_CURRENCY_ENTRIES } from './currency-catalog.js';
import { resolveCurrencyPresentation } from './currency-presentation.js';

// A retried attempt must start from an unresolved locale, or a warm presentation cache hides the regression.
const coldLocales = ['mt-MT', 'ga-IE', 'cy-GB', 'eu-ES', 'gl-ES'];

it('resolves a new locale without evicting shared number formatters', () => {
  const shared = getNumberFormat('en', { style: 'percent', maximumFractionDigits: 3 });
  resolveCurrencyPresentation(DEFAULT_CURRENCY_ENTRIES, coldLocales.shift()!);
  getNumberFormat('en');
  expect(getNumberFormat('en', { style: 'percent', maximumFractionDigits: 3 }) === shared).to.equal(true);
});
