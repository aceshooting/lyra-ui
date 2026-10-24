import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { clipboardFailureReason, writeClipboardText } from './clipboard.js';

describe('clipboard opaque failure boundaries', () => {
  it('classifies primitive rejections as failures without coercing them', () => {
    fc.assert(fc.property(fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)), value => {
      expect(clipboardFailureReason(value)).to.equal('failed');
    }), propertyRuns());
  });

  it('accepts only exact permission names from ordinary foreign error records', () => {
    const name = fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null), fc.constantFrom('NotAllowedError', 'SecurityError'));
    fc.assert(fc.property(name, value => {
      const error = Object.freeze({ name: value });
      expect(clipboardFailureReason(error)).to.equal(value === 'NotAllowedError' || value === 'SecurityError' ? 'denied' : 'failed');
      expect(error.name).to.equal(value);
    }), propertyRuns());
  });

  it('contains an unreadable error name and accepts a function-shaped permission error', () => {
    let reads = 0;
    const error = { get name() { reads++; throw new Error('The error name is unavailable'); } };
    expect(clipboardFailureReason(error)).to.equal('failed');
    expect(reads).to.equal(1);
    const callable = () => undefined;
    Object.defineProperty(callable, 'name', { value: 'SecurityError' });
    expect(clipboardFailureReason(callable)).to.equal('denied');
    expect(clipboardFailureReason(Symbol('rejection'))).to.equal('failed');
  });

  it('preserves unsupported classification when the settled outcome is classified again', async () => {
    const result = await writeClipboardText(null, 'Pending copy');
    expect(result.ok).to.equal(false);
    if (result.ok) throw new Error('Expected an unavailable clipboard outcome');
    expect(result.reason).to.equal('unsupported');
    expect(result.text).to.equal('Pending copy');
    expect(clipboardFailureReason(result.error)).to.equal('unsupported');
    expect(Object.isFrozen(result)).to.equal(true);
  });
});
