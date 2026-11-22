import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { ALL_DEFINED_DEFAULT_TIMEOUT, normalizeAllDefinedArguments } from './all-defined-arguments.js';

describe('normalizeAllDefinedArguments properties', () => {
  it('keeps every root-shaped call in the root form', () => {
    fc.assert(fc.property(
      fc.constantFrom(undefined, null, document, document.body, 'x', 3),
      fc.option(fc.record({ maxPasses: fc.integer({ min: 1, max: 9 }) }), { nil: undefined }),
      (first, second) => {
        const result = normalizeAllDefinedArguments(first, second);
        expect(result.mode).to.equal('root');
        if (result.mode === 'root') expect(result.options).to.equal(second);
      },
    ), propertyRuns());
  });

  it('normalizes additionalElements to a unique lowercase list and validates the timeout', () => {
    fc.assert(fc.property(
      fc.oneof(fc.string(), fc.array(fc.string())),
      fc.option(fc.oneof(fc.integer({ min: 0, max: 10_000 }), fc.constant(Infinity), fc.constant(-1), fc.constant(NaN)), { nil: undefined }),
      (additionalElements, timeout) => {
        const valid = timeout === undefined || timeout >= 0;
        const run = () => normalizeAllDefinedArguments({ additionalElements, timeout });
        if (!valid) {
          expect(run).to.throw(RangeError);
          return;
        }
        const result = run();
        expect(result.mode).to.equal('options');
        if (result.mode !== 'options') return;
        expect(result.timeout).to.equal(timeout ?? ALL_DEFINED_DEFAULT_TIMEOUT);
        expect(new Set(result.additionalElements).size).to.equal(result.additionalElements.length);
        for (const tag of result.additionalElements) {
          expect(tag).to.equal(tag.trim().toLowerCase());
          expect(tag).to.not.equal('');
        }
      },
    ), propertyRuns());
  });
});
