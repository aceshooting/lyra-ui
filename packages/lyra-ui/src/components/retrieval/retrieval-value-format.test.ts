import { expect } from '@open-wc/testing';
import { formatBoundedRetrievalValue } from './retrieval-value-format.js';

const valueFormatOptions = {
  locale: 'en',
  invalid: '[invalid]',
  truncated: '[truncated]',
};

describe('formatBoundedRetrievalValue', () => {
  it('bounds object entries and string lengths while ignoring inherited fields', () => {
    const inherited = { inherited: 'not rendered' };
    const value = Object.assign(Object.create(inherited) as Record<string, unknown>, {
      first: 'abcdef',
      second: 2,
      third: 3,
    });

    expect(formatBoundedRetrievalValue(value, {
      ...valueFormatOptions,
      maxEntries: 2,
      maxStringLength: 3,
    })).to.equal('{fir[truncated]: abc[truncated], sec[truncated]: 2, [truncated]}');
  });

  it('rejects a runtime array whose length descriptor cannot be inspected', () => {
    const value = new Proxy([], {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'length') throw new Error('length denied');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });

    expect(formatBoundedRetrievalValue(value, valueFormatOptions)).to.equal('[invalid]');
  });

  it('does not invoke nested object or array getters while formatting metadata', () => {
    let getterCalls = 0;
    const nested = Object.defineProperty({ safe: 'shown' }, 'secret', {
      enumerable: true,
      get() { getterCalls += 1; return 'leaked'; },
    });
    const list = [nested];
    Object.defineProperty(list, '1', { enumerable: true, get() { getterCalls += 1; return 'leaked'; } });
    list.length = 2;
    expect(formatBoundedRetrievalValue(list, valueFormatOptions)).to.include('[invalid]');
    expect(getterCalls).to.equal(0);
  });

  it('contains hostile collection traps and releases path-local cycle tracking', () => {
    const hostile = new Proxy({}, {
      ownKeys() {
        throw new Error('keys denied');
      },
    });
    const shared = { ok: true };

    expect(formatBoundedRetrievalValue(hostile, valueFormatOptions)).to.equal('[invalid]');
    expect(formatBoundedRetrievalValue([shared, shared], valueFormatOptions)).to.equal(
      '{ok: true} and {ok: true}',
    );
  });

  it('distinguishes nullish, unsupported primitive, and traversal-limit sentinels', () => {
    expect(formatBoundedRetrievalValue(null, valueFormatOptions)).to.equal('');
    expect(formatBoundedRetrievalValue(Symbol('unsupported'), valueFormatOptions)).to.equal('[invalid]');
    expect(formatBoundedRetrievalValue({ nested: { value: 'too deep' } }, {
      ...valueFormatOptions,
      maxDepth: 1,
    })).to.equal('{nested: {value: [truncated]}}');
  });
});
