import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { decimalPlaces } from './numbers.js';
import { clampSteppedValue } from './step-value.js';

// Results are compared with `===` and chai's strict `equal`: 0 and -0 are the same value on a slider.

/** Every double: finite values, +-0, subnormals, +-MAX_VALUE, +-Infinity and NaN. */
const anyDouble = fc.double();
/** Every finite double, still including +-0, subnormals and +-MAX_VALUE. */
const finite = fc.double({ noNaN: true, noDefaultInfinity: true });
/** Signed magnitudes near the top of the double range, where offsets and step products overflow. */
const extreme = fc
  .tuple(fc.double({ min: 2 ** 1000, max: Number.MAX_VALUE, noNaN: true }), fc.boolean())
  .map(([magnitude, negative]) => (negative ? -magnitude : magnitude));
const extremeStep = fc.double({ min: 2 ** 985, max: Number.MAX_VALUE, noNaN: true });
/**
 * Everyday slider geometry: whole-number bounds and a step of 0.01 to 10, a scale at which the grid
 * arithmetic stays far from the limits of double precision, so the grid can be checked directly.
 */
const slider = fc.record({
  min: fc.integer({ min: -100, max: 100 }),
  span: fc.integer({ min: 1, max: 200 }),
  step: fc.integer({ min: 1, max: 1_000 }).map((hundredths) => hundredths / 100),
});
const sliderRaw = fc.double({ min: -500, max: 500, noNaN: true });

describe('clampSteppedValue properties', () => {
  it('returns a finite value inside the ordered range for any raw value and step', () => {
    fc.assert(
      fc.property(anyDouble, finite, finite, anyDouble, (raw, min, max, step) => {
        const result = clampSteppedValue(raw, min, max, step);
        const lower = Math.min(min, max);
        const upper = Math.max(min, max);
        const label = `clampSteppedValue(${raw}, ${min}, ${max}, ${step}) = ${result}`;
        expect(Number.isFinite(result), label).to.equal(true);
        expect(result >= lower && result <= upper, `outside [${lower}, ${upper}]: ${label}`).to.equal(true);
      }),
      propertyRuns(),
    );
  });

  it('is idempotent: normalizing an already normalized value changes nothing', () => {
    fc.assert(
      fc.property(anyDouble, finite, finite, anyDouble, (raw, min, max, step) => {
        const once = clampSteppedValue(raw, min, max, step);
        const twice = clampSteppedValue(once, min, max, step);
        const label = `raw=${raw} min=${min} max=${max} step=${step}: ${once} then ${twice}`;
        expect(twice, `f(f(x)) != f(x) for ${label}`).to.equal(once);
      }),
      propertyRuns(),
    );
  });

  it('is idempotent on everyday geometry, where the grid is not rounded away', () => {
    fc.assert(
      fc.property(sliderRaw, slider, (raw, { min, span, step }) => {
        const max = min + span;
        const once = clampSteppedValue(raw, min, max, step);
        const twice = clampSteppedValue(once, min, max, step);
        expect(twice, `raw=${raw} min=${min} max=${max} step=${step}: ${once} then ${twice}`).to.equal(once);
      }),
      propertyRuns(),
    );
  });

  it('stays finite, inside the range and idempotent where the offset or the step product overflows', () => {
    fc.assert(
      fc.property(extreme, extreme, extreme, extremeStep, (raw, min, max, step) => {
        const result = clampSteppedValue(raw, min, max, step);
        const label = `clampSteppedValue(${raw}, ${min}, ${max}, ${step}) = ${result}`;
        expect(Number.isFinite(result), label).to.equal(true);
        const inside = result >= Math.min(min, max) && result <= Math.max(min, max);
        expect(inside, `outside the range: ${label}`).to.equal(true);
        expect(clampSteppedValue(result, min, max, step), `not idempotent: ${label}`).to.equal(result);
      }),
      propertyRuns(),
    );
  });

  it('is a plain clamp when the step is zero or negative', () => {
    fc.assert(
      fc.property(finite, finite, finite, fc.double({ max: 0, noNaN: true }), (raw, min, max, step) => {
        const expected = Math.min(Math.max(min, max), Math.max(Math.min(min, max), raw));
        expect(clampSteppedValue(raw, min, max, step), `raw=${raw} min=${min} max=${max} step=${step}`).to.equal(expected);
      }),
      propertyRuns(),
    );
  });

  it('gives the lower bound for a raw value that is not finite', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
        finite,
        finite,
        anyDouble,
        (unusable, min, max, step) => {
          const result = clampSteppedValue(unusable, min, max, step);
          expect(result, `raw=${unusable} min=${min} max=${max} step=${step}`).to.equal(Math.min(min, max));
        },
      ),
      propertyRuns(),
    );
  });

  it('gives the minimum for any raw value at or below it', () => {
    fc.assert(
      fc.property(sliderRaw, slider, (raw, { min, span, step }) => {
        const atOrBelow = Math.min(raw, min);
        const result = clampSteppedValue(atOrBelow, min, min + span, step);
        expect(result, `raw=${atOrBelow} min=${min} span=${span} step=${step}`).to.equal(min);
      }),
      propertyRuns(),
    );
  });

  it('gives the same result whichever bound is passed as min and which as max', () => {
    fc.assert(
      fc.property(anyDouble, finite, finite, anyDouble, (raw, min, max, step) => {
        const swapped = clampSteppedValue(raw, max, min, step);
        expect(swapped, `raw=${raw} bounds ${min} and ${max} step=${step}`).to.equal(clampSteppedValue(raw, min, max, step));
      }),
      propertyRuns(),
    );
  });

  it('lands on the min + k * step grid, without binary noise, unless it is an endpoint', () => {
    fc.assert(
      fc.property(sliderRaw, slider, (raw, { min, span, step }) => {
        const max = min + span;
        const result = clampSteppedValue(raw, min, max, step);
        if (result === min || result === max) return;
        const steps = (result - min) / step;
        const onGrid = Math.abs(steps - Math.round(steps)) < 1e-6;
        expect(onGrid, `${result} is off the grid min=${min} step=${step} (k=${steps}) for raw=${raw}`).to.equal(true);
        // The bounds are whole numbers, so the decimals the grid needs are the step's: 0.1 + 0.2 must not survive.
        const clean = decimalPlaces(result) <= decimalPlaces(step);
        expect(clean, `${result} carries noise beyond the places of step ${step}`).to.equal(true);
      }),
      propertyRuns(),
    );
  });

  it('snaps a value inside the range to the nearest grid point, or to an endpoint that is nearer', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), slider, (fraction, { min, span, step }) => {
        const max = min + span;
        const raw = min + fraction * span;
        const result = clampSteppedValue(raw, min, max, step);
        const nearest = Math.abs(result - raw) <= step / 2 + 1e-9;
        expect(nearest, `${raw} snapped to ${result}, farther than half of step ${step} over [${min}, ${max}]`).to.equal(true);
      }),
      propertyRuns(),
    );
  });

  it('never decreases as the raw value grows up to the maximum', () => {
    // Only up to the maximum: a raw value just past a maximum that is not on the grid snaps to the last
    // grid point before it is clamped, while the maximum itself is returned as given.
    fc.assert(
      fc.property(sliderRaw, sliderRaw, slider, (first, second, { min, span, step }) => {
        const max = min + span;
        const high = Math.min(Math.max(first, second), max);
        const low = Math.min(first, second, high);
        const snappedLow = clampSteppedValue(low, min, max, step);
        const snappedHigh = clampSteppedValue(high, min, max, step);
        const label = `raw ${low} -> ${snappedLow} but raw ${high} -> ${snappedHigh} (min=${min} span=${span} step=${step})`;
        expect(snappedLow <= snappedHigh, label).to.equal(true);
      }),
      propertyRuns(),
    );
  });
});
