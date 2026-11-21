import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { isPlainPrimaryClick } from './plain-click.js';

describe('isPlainPrimaryClick properties', () => {
  it('accepts only an unhandled primary click without modifier keys', () => {
    fc.assert(fc.property(
      fc.record({
        button: fc.integer({ min: -1, max: 4 }),
        ctrlKey: fc.boolean(), metaKey: fc.boolean(), shiftKey: fc.boolean(), altKey: fc.boolean(),
        defaultPrevented: fc.boolean(),
      }),
      (input) => {
        const expected = input.button === 0 && !input.ctrlKey && !input.metaKey && !input.shiftKey
          && !input.altKey && !input.defaultPrevented;
        expect(isPlainPrimaryClick(input)).to.equal(expected);
      },
    ), propertyRuns());
  });

  it('classifies dispatched MouseEvents the same way', () => {
    expect(isPlainPrimaryClick(new MouseEvent('click', { button: 0 }))).to.equal(true);
    expect(isPlainPrimaryClick(new MouseEvent('click', { button: 1 }))).to.equal(false);
    expect(isPlainPrimaryClick(new MouseEvent('click', { button: 0, metaKey: true }))).to.equal(false);
    const handled = new MouseEvent('click', { button: 0, cancelable: true });
    handled.preventDefault();
    expect(isPlainPrimaryClick(handled)).to.equal(false);
  });
});
