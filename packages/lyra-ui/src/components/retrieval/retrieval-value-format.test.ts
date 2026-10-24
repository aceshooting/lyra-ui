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

  it('rejects a runtime array whose reported length is not a safe non-negative integer', () => {
    for (const reported of ['many', -1, 1.5, Number.MAX_SAFE_INTEGER + 2]) {
      const value = new Proxy([], {
        getOwnPropertyDescriptor(target, key) {
          const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
          return key === 'length' && descriptor ? { ...descriptor, value: reported } : descriptor;
        },
      });

      expect(formatBoundedRetrievalValue(value, valueFormatOptions), `length ${String(reported)}`).to.equal('[invalid]');
    }
  });

  it('renders array holes as empty items and skips enumerable inherited object keys', () => {
    const sparse: string[] = [];
    sparse[0] = 'first';
    sparse[2] = 'third';
    const inherited = Object.assign(Object.create({ inherited: 'hidden' }) as Record<string, unknown>, {
      own: 'shown',
    });

    expect(formatBoundedRetrievalValue(sparse, valueFormatOptions)).to.equal('first, , and third');
    expect(formatBoundedRetrievalValue(inherited, valueFormatOptions)).to.equal('{own: shown}');
  });

  it('stops scanning an object once the total value budget is spent and marks the cut', () => {
    expect(formatBoundedRetrievalValue({ a: 1, b: 2, c: 3, d: 4 }, {
      ...valueFormatOptions,
      maxValues: 3,
    })).to.equal('{a: 1, b: 2, c: [truncated], [truncated]}');
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
