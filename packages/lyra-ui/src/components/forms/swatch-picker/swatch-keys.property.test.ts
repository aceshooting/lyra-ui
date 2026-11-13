import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { swatchKeyTarget } from './swatch-keys.js';

it('navigates the available swatches in order, including missing origins, wraparound, and RTL', () => {
  fc.assert(fc.property(
    fc.array(fc.boolean(), { maxLength: 40 }), fc.nat(), fc.boolean(),
    fc.constantFrom('Home', 'End', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Enter'),
    (disabled, origin, rtl, key) => {
      const current = origin % (disabled.length + 1) - 1;
      const available = disabled.flatMap((blocked, index) => blocked ? [] : [index]);
      let expected = -1;
      if (key === 'Home') expected = available[0] ?? -1;
      else if (key === 'End') expected = available.at(-1) ?? -1;
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
        const forward = key === 'ArrowDown' || key === (rtl ? 'ArrowLeft' : 'ArrowRight');
        expected = forward
          ? available.find(index => index > current) ?? available[0] ?? -1
          : [...available].reverse().find(index => index < current) ?? available.at(-1) ?? -1;
      }
      const reads: number[] = [];
      const actual = swatchKeyTarget(key, current, disabled.length, index => {
        reads.push(index);
        return disabled[index]!;
      }, rtl);
      expect(actual).to.equal(expected);
      expect(reads.length).to.be.at.most(disabled.length);
      expect(reads.every(index => Number.isInteger(index) && index >= 0 && index < disabled.length)).to.equal(true);
    },
  ), propertyRuns());
});
