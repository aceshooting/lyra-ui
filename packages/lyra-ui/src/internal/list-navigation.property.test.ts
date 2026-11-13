import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { resolveListMove } from './list-navigation.js';

it('never moves focus onto an unavailable or out-of-range item', () => {
  fc.assert(fc.property(
    fc.array(fc.boolean(), { maxLength: 32 }),
    fc.integer({ min: -2, max: 34 }),
    fc.constantFrom('ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab'),
    fc.constantFrom('horizontal' as const, 'vertical' as const, 'both' as const),
    fc.constantFrom('ltr' as const, 'rtl' as const),
    fc.boolean(), fc.boolean(),
    (available, current, key, orientation, direction, wrap, clamp) => {
      const result = resolveListMove(key, { count: available.length, current, orientation, direction, wrap, clamp,
        isAvailable: index => available[index] === true });
      if (result !== null) {
        expect(Number.isInteger(result)).to.equal(true);
        expect(result).to.be.at.least(0).and.below(available.length);
        expect(available[result]).to.equal(true);
      }
      if (key === 'Home') expect(result).to.equal(available.includes(true) ? available.indexOf(true) : null);
      if (key === 'End') expect(result).to.equal(available.includes(true) ? available.lastIndexOf(true) : null);
      if (key === 'Tab' || !available.includes(true)) expect(result).to.equal(null);
    },
  ), propertyRuns());
});
