import { expect } from '@open-wc/testing';
import { localeDateOrder, normalizeLocaleDigits, stripBidiFormattingMarks } from './locale-date.js';

it('derives date field order from the requested locale and calendar', () => {
  expect(localeDateOrder('en-GB')).to.deep.equal(['day', 'month', 'year']);
  expect(localeDateOrder('en-US', 'gregory')).to.deep.equal(['month', 'day', 'year']);
});

it('normalizes Unicode decimal digits and strips bidi formatting marks', () => {
  expect(normalizeLocaleDigits('२०२६\u200f-०७-१५', 'en-US')).to.equal('2026-07-15');
  expect(stripBidiFormattingMarks('\u200e٢٧\u200f')).to.equal('٢٧');
});
