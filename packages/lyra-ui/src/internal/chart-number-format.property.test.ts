import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { chartValueFractionDigits, formatCallerChartValue, formatChartValue, significantFractionDigits } from './chart-number-format.js';

const magnitudes = fc.double({ min: 1e-30, max: 1e30, noNaN: true });

it('keeps a whole number of fraction digits within the Intl range', () => {
  fc.assert(fc.property(fc.double(), fc.integer({ min: 1, max: 21 }), (magnitude, significant) => {
    const digits = significantFractionDigits(magnitude, significant);
    expect(Number.isInteger(digits) && digits >= 0 && digits <= 20).to.equal(true);
  }), propertyRuns());
});

it('shows the requested significant digits of a magnitude whenever twenty fraction digits suffice', () => {
  fc.assert(fc.property(magnitudes, fc.integer({ min: 1, max: 4 }), (magnitude, significant) => {
    const digits = significantFractionDigits(magnitude, significant);
    const exponent = Math.floor(Math.log10(magnitude));
    fc.pre(significant - 1 - exponent <= 20);
    // The last shown fraction digit is the requested significant digit, or none is needed.
    expect(digits).to.equal(Math.max(0, significant - 1 - exponent));
  }), propertyRuns());
});

it('widens only values below one, and never below the base', () => {
  fc.assert(fc.property(fc.double({ noNaN: true }), fc.integer({ min: 0, max: 6 }), fc.integer({ min: 1, max: 4 }), (value, base, significant) => {
    const digits = chartValueFractionDigits(value, base, significant);
    const magnitude = Math.abs(value);
    if (magnitude === 0 || magnitude >= 1) expect(digits).to.equal(base);
    else expect(digits).to.equal(Math.max(base, significantFractionDigits(magnitude, significant)));
  }), propertyRuns());
});

it('never prints a nonzero finite chart value as zero', () => {
  fc.assert(fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }).filter(value => value !== 0), value => {
    expect(/[1-9]/.test(formatChartValue(value, 'en'))).to.equal(true);
  }), propertyRuns());
});

const finite = fc.double({ noNaN: true, noDefaultInfinity: true });
const base = fc.integer({ min: 0, max: 6 });

describe('chart number format properties', () => {
  it('keeps fraction digits within [base, 20] and never below base for any finite value', () => {
    fc.assert(fc.property(finite, base, (value, digits) => {
      const result = chartValueFractionDigits(value, digits);
      expect(Number.isInteger(result) && result >= digits && result <= Math.max(20, digits), 'bounded').to.equal(true);
    }), propertyRuns());
  });

  it('adds digits only for non-zero values below one in magnitude', () => {
    fc.assert(fc.property(finite, base, (value, digits) => {
      if (Math.abs(value) >= 1 || value === 0) expect(chartValueFractionDigits(value, digits)).to.equal(digits);
    }), propertyRuns());
  });

  it('never makes a smaller magnitude use fewer digits', () => {
    fc.assert(fc.property(fc.double({ min: 1e-19, max: 0.999, noNaN: true }), fc.double({ min: 0.001, max: 1, noNaN: true }), (value, shrink) => {
      expect(chartValueFractionDigits(value * shrink)).to.be.at.least(chartValueFractionDigits(value));
    }), propertyRuns());
  });

  it('formats every finite value to a non-empty string and keeps the sign', () => {
    fc.assert(fc.property(finite, (value) => {
      const text = formatChartValue(value, 'en');
      expect(text.length > 0, 'non-empty').to.equal(true);
      if (value < 0 && Math.abs(value) >= 1e-3) expect(text.startsWith('-'), 'negative sign kept').to.equal(true);
    }), propertyRuns());
  });

  it('shows a non-zero small value as something other than zero', () => {
    fc.assert(fc.property(fc.double({ min: 1e-12, max: 0.01, noNaN: true }), (value) => {
      expect(Number(formatChartValue(value, 'en').replace(/,/g, '')), 'not rounded to zero').to.not.equal(0);
    }), propertyRuns());
  });
});

it('returns a caller formatter as text and falls back when it throws or returns nothing', () => {
  const outcomes = fc.oneof(fc.constant('throw'), fc.constant(null), fc.constant(undefined), fc.string(), fc.double());
  fc.assert(fc.property(fc.double({ noNaN: true }), outcomes, (value, outcome) => {
    const formatter = () => {
      if (outcome === 'throw') throw new Error('formatter failed');
      return outcome;
    };
    const text = formatCallerChartValue(formatter, value, 'en');
    expect(text).to.equal(outcome === 'throw' || outcome === null || outcome === undefined
      ? formatChartValue(value, 'en') : String(outcome));
  }), propertyRuns());
});
