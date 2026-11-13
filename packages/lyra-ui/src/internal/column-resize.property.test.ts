import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { columnResizeKeyboardWidth, columnResizePointerWidth, columnResizeWidth } from './column-resize.js';

describe('column separator interaction math', () => {
  it('clamps monotonically and idempotently while preserving every width inside the bounds', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 500 }), fc.nat({ max: 1000 }),
      fc.integer({ min: -2000, max: 2000 }), fc.nat({ max: 2000 }),
      (minimum, span, width, increment) => {
        const maximum = minimum + span;
        const result = columnResizeWidth(width, minimum, maximum);
        expect(result).to.be.within(minimum, maximum);
        expect(columnResizeWidth(result, minimum, maximum)).to.equal(result);
        expect(columnResizeWidth(width + increment, minimum, maximum)).to.be.at.least(result);
        if (width >= minimum && width <= maximum) expect(result).to.equal(width);
      },
    ), propertyRuns());
  });

  it('keeps keyboard steps equal to pointer travel in either direction and locale', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 500 }), fc.nat({ max: 1000 }),
      fc.integer({ min: -1000, max: 2000 }), fc.integer({ min: -1000, max: 1000 }),
      fc.boolean(), fc.boolean(), fc.boolean(),
      (minimum, span, width, x, right, rtl, shiftKey) => {
        const maximum = minimum + span;
        const travel = (right ? 1 : -1) * (shiftKey ? 50 : 10);
        const event = new KeyboardEvent('keydown', { key: right ? 'ArrowRight' : 'ArrowLeft', shiftKey });
        const pointer = columnResizePointerWidth(width, x, x + travel, rtl, minimum, maximum);
        expect(columnResizeKeyboardWidth(event, width, minimum, maximum, rtl)).to.equal(pointer);
        expect(columnResizePointerWidth(width, x, x - travel, !rtl, minimum, maximum)).to.equal(pointer);
      },
    ), propertyRuns());
  });

  it('leaves Home and End to navigation when bounds handling is disabled, and refuses an infinite End target', () => {
    for (const key of ['Home', 'End', 'ArrowUp', 'ArrowDown', 'Enter', 'Tab']) {
      expect(columnResizeKeyboardWidth(new KeyboardEvent('keydown', { key }), 120, 40, 300, false, false)).to.equal(undefined);
    }
    expect(columnResizeKeyboardWidth(new KeyboardEvent('keydown', { key: 'End' }), 120, 40, Infinity, false)).to.equal(undefined);
    expect(columnResizeKeyboardWidth(new KeyboardEvent('keydown', { key: 'Home' }), 120, 40, 300, true)).to.equal(40);
    expect(columnResizeKeyboardWidth(new KeyboardEvent('keydown', { key: 'End' }), 120, 40, 300, true)).to.equal(300);
  });
});
