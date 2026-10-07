import { expect } from '@open-wc/testing';
import {
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
  getOwnDataDescriptor,
  getInheritedPropertyDescriptor,
  readOwnDataValue,
  projectFrozenRows,
  projectStringList,
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

describe('getInheritedPropertyDescriptor', () => {
  it('finds inherited data descriptors and lets an accessor shadow farther prototypes', () => {
    let getterCalls = 0;
    const ancestor = { action() {} };
    const middle = Object.create(ancestor) as object;
    Object.defineProperty(middle, 'shadowed', {
      get() {
        getterCalls += 1;
        return 'must-not-run';
      },
    });
    const value = Object.create(middle) as object;

    expect(getInheritedPropertyDescriptor(value, 'action')?.value).to.equal(ancestor.action);
    const shadowed = getInheritedPropertyDescriptor(value, 'shadowed');
    expect(shadowed !== undefined && Object.hasOwn(shadowed, 'get')).to.be.true;
    expect(getInheritedPropertyDescriptor(value, 'missing')).to.equal(undefined);
    expect(getterCalls).to.equal(0);
  });

  it('contains hostile prototype descriptor reflection', () => {
    const value = new Proxy({}, {
      getOwnPropertyDescriptor() {
        throw new Error('descriptor reflection failed');
      },
    });
    expect(() => getInheritedPropertyDescriptor(value, 'action')).not.to.throw();
    expect(getInheritedPropertyDescriptor(value, 'action')).to.equal(undefined);
  });
});

describe('descriptor-safe projections', () => {
  it('does not invoke accessors and keeps valid later duplicate identities', () => {
    let calls = 0;
    const unsafe = {} as { id: string; label: string };
    Object.defineProperty(unsafe, 'id', { get() { calls += 1; return 'a'; } });
    const rows = projectFrozenRows([unsafe, { id: 'a', label: 'retained' }], (value) => {
      if (!value || typeof value !== 'object') return undefined;
      const id = readOwnDataValue(value, 'id');
      const label = readOwnDataValue(value, 'label');
      return typeof id === 'string' && typeof label === 'string' ? { id, label } : undefined;
    }, 10, Object.freeze([]), (row) => row.id);
    expect(rows.map((row) => row.label)).to.deep.equal(['retained']);
    expect(Object.isFrozen(rows)).to.equal(true);
    expect(calls).to.equal(0);
  });

  it('keeps sparse string-list semantics separate from strict keyword semantics', () => {
    const sparse = ['a', 2, 'b'];
    expect(projectStringList(sparse, 3)).to.deep.equal(['a', 'b']);
    expect(projectStringList(sparse, 3, { strict: true })).to.equal(undefined);
    expect(projectStringList(['a', 'b'], 1, { rejectOversized: true })).to.equal(undefined);
  });
});
