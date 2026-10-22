import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import {
  MAX_TIMEOUT_MS,
  decimalPlaces,
  extent,
  finiteAdd,
  finiteCount,
  finiteDuration,
  finiteInteger,
  finiteInterpolate,
  finiteMidpoint,
  finiteNumber,
  finiteRange,
  finiteRatio,
  minMax,
} from './numbers.js';

// Comparisons use `===`, `<=` and chai's strict `equal`, never an `Object.is` check: 0 and -0 are the
// same number here, and the helpers are free to return either.

/** Every double: finite values, +-0, subnormals, +-MAX_VALUE, +-Infinity and NaN. */
const anyDouble = fc.double();
/** Every finite double, still including +-0, subnormals and +-MAX_VALUE. */
const finite = fc.double({ noNaN: true, noDefaultInfinity: true });
/** Magnitudes in the top binade: two of them always overflow their sum, or their difference when signed apart. */
const overflowing = fc.double({ min: 2 ** 1023, max: Number.MAX_VALUE, noNaN: true });
const unitInterval = fc.double({ min: 0, max: 1, noNaN: true });

describe('numbers properties', () => {
  it('finiteNumber keeps a finite value and otherwise falls back to a finite fallback, then to 0', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, (value, fallback) => {
        const result = finiteNumber(value, fallback);
        expect(Number.isFinite(result), `finiteNumber(${value}, ${fallback}) = ${result}`).to.equal(true);
        if (Number.isFinite(value)) expect(result).to.equal(value);
        else expect(result).to.equal(Number.isFinite(fallback) ? fallback : 0);
      }),
      propertyRuns(),
    );
  });

  it('finiteRange is always finite and inside its ordered bounds, where a non-finite bound is no bound', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, anyDouble, anyDouble, (value, fallback, first, second) => {
        const result = finiteRange(value, fallback, first, second);
        const lower = Math.min(Number.isFinite(first) ? first : -Infinity, Number.isFinite(second) ? second : Infinity);
        const upper = Math.max(Number.isFinite(first) ? first : -Infinity, Number.isFinite(second) ? second : Infinity);
        expect(Number.isFinite(result), `finiteRange(${value}, ${fallback}, ${first}, ${second}) = ${result}`).to.equal(true);
        expect(result >= lower && result <= upper, `${result} is outside [${lower}, ${upper}]`).to.equal(true);
      }),
      propertyRuns(),
    );
  });

  it('finiteRange leaves an in-range value alone, is idempotent and ignores the order of its bounds', () => {
    fc.assert(
      fc.property(anyDouble, finite, finite, finite, (value, fallback, first, second) => {
        const result = finiteRange(value, fallback, first, second);
        const label = `finiteRange(${value}, ${fallback}, ${first}, ${second}) = ${result}`;
        expect(finiteRange(result, fallback, first, second), `not idempotent: ${label}`).to.equal(result);
        expect(finiteRange(value, fallback, second, first), `bound order matters: ${label}`).to.equal(result);
        if (Number.isFinite(value) && value >= Math.min(first, second) && value <= Math.max(first, second)) {
          expect(result, `moved an in-range value: ${label}`).to.equal(value);
        }
      }),
      propertyRuns(),
    );
  });

  it('finiteRatio stays within [0, 1] and never decreases (increases when reversed) with the value', () => {
    fc.assert(
      fc.property(finite, finite, finite, finite, (first, second, start, end) => {
        const ratioFirst = finiteRatio(first, start, end);
        const ratioSecond = finiteRatio(second, start, end);
        const label = `ratio(${first})=${ratioFirst} ratio(${second})=${ratioSecond} over [${start}, ${end}]`;
        const inside = ratioFirst >= 0 && ratioFirst <= 1 && ratioSecond >= 0 && ratioSecond <= 1;
        expect(inside, `outside [0, 1]: ${label}`).to.equal(true);
        if (first > second || start === end) return;
        expect(start < end ? ratioFirst <= ratioSecond : ratioFirst >= ratioSecond, `not monotone: ${label}`).to.equal(true);
      }),
      propertyRuns(),
    );
  });

  it('finiteRatio maps its start to 0 and its end to 1, and swapping the endpoints complements it', () => {
    fc.assert(
      fc.property(finite, finite, finite, (value, start, end) => {
        if (start === end) return;
        expect(finiteRatio(start, start, end), `start of [${start}, ${end}]`).to.equal(0);
        expect(finiteRatio(end, start, end), `end of [${start}, ${end}]`).to.equal(1);
        const ratio = finiteRatio(value, start, end);
        const swapped = finiteRatio(value, end, start);
        // One rounding in `1 - ratio` and one in the sum: far below the tolerance.
        const complementary = Math.abs(ratio + swapped - 1) < 1e-12;
        expect(complementary, `${ratio} + ${swapped} != 1 for ${value} over [${start}, ${end}]`).to.equal(true);
      }),
      propertyRuns(),
    );
  });

  it('finiteRatio stays within [0, 1] for any input and returns the fallback when it has no span to measure', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, anyDouble, anyDouble, unitInterval, (value, start, end, wildFallback, fallback) => {
        const label = `finiteRatio(${value}, ${start}, ${end}, ...)`;
        const wild = finiteRatio(value, start, end, wildFallback);
        expect(wild >= 0 && wild <= 1, `${label} with fallback ${wildFallback} = ${wild}`).to.equal(true);
        const unmeasurable = !Number.isFinite(value) || !Number.isFinite(start) || !Number.isFinite(end) || start === end;
        if (unmeasurable) {
          expect(finiteRatio(value, start, end, fallback), `${label} with fallback ${fallback}`).to.equal(fallback);
        }
      }),
      propertyRuns(),
    );
  });

  it('finiteRatio recovers the mixing weight of a point between endpoints that span past the largest double', () => {
    fc.assert(
      fc.property(overflowing, overflowing, unitInterval, (below, above, weight) => {
        const start = -below;
        const end = above;
        // A convex combination of the endpoints, formed without ever subtracting them.
        const value = weight * end - (1 - weight) * below;
        const ratio = finiteRatio(value, start, end);
        expect(Math.abs(ratio - weight) < 1e-9, `ratio ${ratio} != weight ${weight} for ${value} over [${start}, ${end}]`).to.equal(true);
      }),
      propertyRuns(),
    );
  });

  it('finiteInterpolate stays finite and between its endpoints, and a non-finite ratio selects the start', () => {
    fc.assert(
      fc.property(finite, finite, anyDouble, (start, end, ratio) => {
        const result = finiteInterpolate(start, end, ratio);
        const label = `finiteInterpolate(${start}, ${end}, ${ratio}) = ${result}`;
        expect(Number.isFinite(result), label).to.equal(true);
        expect(result >= Math.min(start, end) && result <= Math.max(start, end), `escaped its endpoints: ${label}`).to.equal(true);
        // A non-finite ratio falls back to 0 (not to a clamped end), so only finite ratios reach the end.
        if (!Number.isFinite(ratio) || ratio <= 0) expect(result, label).to.equal(start);
        else if (ratio >= 1) expect(result, label).to.equal(end);
      }),
      propertyRuns(),
    );
  });

  it('finiteInterpolate and finiteMidpoint stay finite and between huge endpoints, whatever overflows', () => {
    const sign = fc.constantFrom(1, -1);
    fc.assert(
      fc.property(overflowing, overflowing, sign, sign, unitInterval, (first, second, firstSign, secondSign, ratio) => {
        // Opposite signs overflow the difference of the endpoints; equal signs overflow their sum.
        const start = firstSign * first;
        const end = secondSign * second;
        const label = `endpoints ${start} and ${end} at ${ratio}`;
        const lower = Math.min(start, end);
        const upper = Math.max(start, end);
        for (const result of [finiteInterpolate(start, end, ratio), finiteMidpoint(start, end)]) {
          expect(Number.isFinite(result), `non-finite for ${label}`).to.equal(true);
          expect(result >= lower && result <= upper, `${result} escaped ${label}`).to.equal(true);
        }
      }),
      propertyRuns(),
    );
  });

  it('finiteMidpoint lies between its endpoints and is symmetric to within operand rounding', () => {
    fc.assert(
      fc.property(finite, finite, (first, second) => {
        const forward = finiteMidpoint(first, second);
        const backward = finiteMidpoint(second, first);
        const between = forward >= Math.min(first, second) && forward <= Math.max(first, second);
        expect(between, `midpoint(${first}, ${second}) = ${forward}`).to.equal(true);
        // Rounding error scales with the operands (cancellation can leave a result far smaller than
        // they are) and cannot be finer than one subnormal step.
        const operands = Math.max(Math.abs(first), Math.abs(second));
        const tolerance = Math.max(operands * Number.EPSILON * 4, 2 * Number.MIN_VALUE);
        const symmetric = Math.abs(forward - backward) <= tolerance;
        expect(symmetric, `midpoint(${first}, ${second}) = ${forward} but reversed ${backward}`).to.equal(true);
      }),
      propertyRuns(),
    );
  });

  it('finiteAdd returns a finite sum for any input', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, anyDouble, (left, right, fallback) => {
        const result = finiteAdd(left, right, fallback);
        expect(Number.isFinite(result), `finiteAdd(${left}, ${right}, ${fallback}) = ${result}`).to.equal(true);
      }),
      propertyRuns(),
    );
  });

  it('finiteAdd equals the exact sum unless it overflows, and then saturates at the signed maximum', () => {
    fc.assert(
      fc.property(finite, finite, finite, (left, right, fallback) => {
        const result = finiteAdd(left, right, fallback);
        const exact = left + right;
        const label = `finiteAdd(${left}, ${right}, ${fallback}) = ${result}`;
        if (Number.isFinite(exact)) expect(result, label).to.equal(exact);
        else expect(result, label).to.equal(Math.sign(exact) * Number.MAX_VALUE);
      }),
      propertyRuns(),
    );
  });

  it('finiteAdd saturates huge operands of one sign and stays exact for operands of opposite signs', () => {
    fc.assert(
      fc.property(overflowing, overflowing, fc.constantFrom(1, -1), (left, right, sign) => {
        expect(finiteAdd(sign * left, sign * right), `sum of ${sign * left} and ${sign * right}`).to.equal(sign * Number.MAX_VALUE);
        expect(finiteAdd(sign * left, -sign * right), `sum of ${sign * left} and ${-sign * right}`).to.equal(sign * (left - right));
      }),
      propertyRuns(),
    );
  });

  it('finiteInteger returns an integer inside integer bounds and finiteCount a safe non-negative one', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, fc.integer(), fc.integer(), (value, fallback, first, second) => {
        const lower = Math.min(first, second);
        const upper = Math.max(first, second);
        const integer = finiteInteger(value, fallback, lower, upper);
        const label = `finiteInteger(${value}, ${fallback}, ${lower}, ${upper}) = ${integer}`;
        expect(Number.isInteger(integer) && integer >= lower && integer <= upper, label).to.equal(true);
        const count = finiteCount(value, fallback);
        expect(Number.isSafeInteger(count) && count >= 0, `finiteCount(${value}, ${fallback}) = ${count}`).to.equal(true);
        if (Number.isSafeInteger(value) && value >= lower && value <= upper) expect(integer, `moved ${value}`).to.equal(value);
      }),
      propertyRuns(),
    );
  });

  it('finiteDuration stays within the timer ceiling and keeps an in-range duration unchanged', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, (value, fallback) => {
        const duration = finiteDuration(value, fallback);
        expect(duration >= 0 && duration <= MAX_TIMEOUT_MS, `finiteDuration(${value}, ${fallback}) = ${duration}`).to.equal(true);
        if (Number.isFinite(value) && value >= 0 && value <= MAX_TIMEOUT_MS) expect(duration, `moved ${value}`).to.equal(value);
      }),
      propertyRuns(),
    );
  });

  it('finiteDuration caps at the timer ceiling a maximum that lies beyond it', () => {
    // The bounds callers pass: a minimum within the ceiling and a finite maximum, possibly far beyond it.
    const minimum = fc.double({ min: 0, max: MAX_TIMEOUT_MS, noNaN: true });
    const maximum = fc.double({ min: 0, max: 1e15, noNaN: true });
    fc.assert(
      fc.property(anyDouble, anyDouble, minimum, maximum, (value, fallback, min, max) => {
        const duration = finiteDuration(value, fallback, min, max);
        const label = `finiteDuration(${value}, ${fallback}, ${min}, ${max}) = ${duration}`;
        expect(duration >= 0 && duration <= MAX_TIMEOUT_MS, label).to.equal(true);
      }),
      propertyRuns(),
    );
  });

  it('decimalPlaces is no more than the places a decimal was written with, and toFixed reproduces it', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000, max: 1_000_000 }), fc.integer({ min: 0, max: 12 }), (mantissa, places) => {
        const decimal = Number((mantissa / 10 ** places).toFixed(places));
        const implied = decimalPlaces(decimal);
        expect(implied <= places, `decimalPlaces(${decimal}) = ${implied} > ${places}`).to.equal(true);
        expect(Number(decimal.toFixed(implied)), `toFixed(${implied}) does not reproduce ${decimal}`).to.equal(decimal);
      }),
      propertyRuns(),
    );
  });

  it('decimalPlaces is 0 for every whole or non-finite number', () => {
    fc.assert(
      fc.property(anyDouble, (value) => {
        const whole = Number.isFinite(value) ? Math.trunc(value) : value;
        expect(decimalPlaces(whole), `decimalPlaces of ${whole}`).to.equal(0);
      }),
      propertyRuns(),
    );
  });

  it('minMax and extent agree with Math.min and Math.max, and report nothing for an empty input', () => {
    fc.assert(
      fc.property(fc.array(finite, { minLength: 1, maxLength: 50 }), (values) => {
        const range = minMax(values);
        expect(range === null, 'minMax of a non-empty array').to.equal(false);
        expect(range?.[0], `minimum of ${values.length} values`).to.equal(Math.min(...values));
        expect(range?.[1], `maximum of ${values.length} values`).to.equal(Math.max(...values));
        const negated = values.map((value) => -value);
        const box = extent(values, (value) => value, (value) => -value);
        expect(box?.minX, 'minX').to.equal(Math.min(...values));
        expect(box?.maxX, 'maxX').to.equal(Math.max(...values));
        expect(box?.minY, 'minY').to.equal(Math.min(...negated));
        expect(box?.maxY, 'maxY').to.equal(Math.max(...negated));
      }),
      propertyRuns(),
    );
    expect(minMax([])).to.equal(null);
    expect(extent([], (value: number) => value, (value: number) => value)).to.equal(null);
  });
});
