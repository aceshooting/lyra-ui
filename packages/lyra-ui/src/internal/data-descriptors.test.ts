import { expect } from '@open-wc/testing';
import {
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
  getOwnDataDescriptor,
} from './data-descriptors.js';

describe('getOwnDataDescriptor', () => {
  it('returns an own data descriptor without reading its value', () => {
    const value = { stable: { label: 'retained' } };

    const descriptor = getOwnDataDescriptor(value, 'stable');

    expect(descriptor).not.to.equal(MISSING_OWN_DATA_DESCRIPTOR);
    expect(descriptor).not.to.equal(UNSAFE_OWN_DATA_DESCRIPTOR);
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    )
      throw new Error('expected an own data descriptor');
    expect(descriptor.value).to.equal(value.stable);
    expect(descriptor.enumerable).to.be.true;
  });

  it('distinguishes missing and inherited properties from unsafe accessors', () => {
    let getterCalls = 0;
    const prototype = { inherited: 'not-own' };
    const value = Object.create(prototype) as Record<PropertyKey, unknown>;
    Object.defineProperty(value, 'accessor', {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'must-not-run';
      },
    });

    expect(getOwnDataDescriptor(value, 'missing')).to.equal(
      MISSING_OWN_DATA_DESCRIPTOR
    );
    expect(getOwnDataDescriptor(value, 'inherited')).to.equal(
      MISSING_OWN_DATA_DESCRIPTOR
    );
    expect(getOwnDataDescriptor(value, 'accessor')).to.equal(
      UNSAFE_OWN_DATA_DESCRIPTOR
    );
    expect(getterCalls).to.equal(0);
  });

  it('does not mistake a prototype-polluted descriptor for a data descriptor', () => {
    const original = Object.getOwnPropertyDescriptor(Object.prototype, 'value');
    let inheritedValueReads = 0;
    const source = {} as Record<PropertyKey, unknown>;
    Object.defineProperty(source, 'accessor', {
      configurable: true,
      enumerable: true,
      get() {
        throw new Error('the source accessor must not run');
      },
    });
    try {
      Object.defineProperty(Object.prototype, 'value', {
        configurable: true,
        get() {
          inheritedValueReads += 1;
          return 'poisoned inherited value';
        },
      });

      // Keep the assertion primitive: a polluted descriptor object is not clone-safe as a
      // failed test's actual value in the browser runner.
      expect(
        getOwnDataDescriptor(source, 'accessor') === UNSAFE_OWN_DATA_DESCRIPTOR
      ).to.equal(true);
      expect(inheritedValueReads).to.equal(0);
    } finally {
      if (original) Object.defineProperty(Object.prototype, 'value', original);
      else delete (Object.prototype as Record<string, unknown>)['value'];
    }
  });

  it('contains hostile descriptor reflection', () => {
    const value = new Proxy(
      { hostile: 'value' },
      {
        getOwnPropertyDescriptor() {
          throw new Error('descriptor reflection failed');
        },
      }
    );

    expect(() => getOwnDataDescriptor(value, 'hostile')).not.to.throw();
    expect(getOwnDataDescriptor(value, 'hostile')).to.equal(
      UNSAFE_OWN_DATA_DESCRIPTOR
    );
  });
});
