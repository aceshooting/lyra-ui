import { expect } from '@open-wc/testing';
import { attachInternalsSafely } from './element-internals.js';

function expectFallbackInternals(internals: ElementInternals): void {
  expect(internals.form).to.equal(null);
  expect(internals.willValidate).to.equal(false);
  expect(internals.checkValidity()).to.equal(true);
}

describe('attachInternalsSafely()', () => {
  for (const boundary of ['getOwnPropertyDescriptor', 'getPrototypeOf'] as const) {
    it(`retains usable fallback validity when a partial DOM rejects ${boundary}`, () => {
      let inspections = 0;
      const host = new Proxy(Object.create(null) as HTMLElement, {
        [boundary](): never {
          inspections++;
          throw new Error('DOM inspection unavailable');
        },
      });

      const internals = attachInternalsSafely(host);

      expect(inspections).to.equal(1);
      expectFallbackInternals(internals);
      internals.setValidity({ customError: true }, 'Invalid value');
      expect(internals.checkValidity()).to.equal(false);
      expect(internals.validationMessage).to.equal('Invalid value');
      internals.setValidity({});
      expect(internals.reportValidity()).to.equal(true);
      expect(internals.validationMessage).to.equal('');
    });
  }

  for (const result of [null, undefined]) {
    it(`uses independent fallback state when a partial attachment returns ${String(result)}`, () => {
      let calls = 0;
      const host = Object.create(null) as HTMLElement;
      Object.defineProperty(host, 'attachInternals', {
        value() { calls++; return result; },
      });

      const first = attachInternalsSafely(host);
      const second = attachInternalsSafely(host);

      expect(calls).to.equal(2);
      expectFallbackInternals(first);
      expectFallbackInternals(second);
      first.states.add('invalid');
      first.setValidity({ valueMissing: true }, 'Required');
      expect(first.validity.valueMissing).to.equal(true);
      expect(second.states.has('invalid')).to.equal(false);
      expect(second.validity.valid).to.equal(true);
    });
  }

  it('never evaluates an own attachInternals accessor, including one that throws', () => {
    const prototype = Object.create(null) as object;
    let accessorReads = 0;
    let inheritedCalls = 0;
    Object.defineProperty(prototype, 'attachInternals', {
      configurable: true,
      value(): ElementInternals {
        inheritedCalls += 1;
        return { states: new Set<string>() } as unknown as ElementInternals;
      },
    });
    const host = Object.create(prototype) as HTMLElement;
    Object.defineProperty(host, 'attachInternals', {
      configurable: true,
      get(): never {
        accessorReads += 1;
        throw new Error('hostile attachInternals accessor');
      },
    });

    const internals = attachInternalsSafely(host);

    expect(accessorReads).to.equal(0);
    expect(inheritedCalls).to.equal(0);
    expectFallbackInternals(internals);
  });

  it('does not skip a non-callable own data descriptor for an inherited callable', () => {
    const prototype = Object.create(null) as object;
    let inheritedCalls = 0;
    Object.defineProperty(prototype, 'attachInternals', {
      configurable: true,
      value(): ElementInternals {
        inheritedCalls += 1;
        return { states: new Set<string>() } as unknown as ElementInternals;
      },
    });
    const host = Object.create(prototype) as HTMLElement;
    Object.defineProperty(host, 'attachInternals', {
      configurable: true,
      value: { callable: false },
    });

    const internals = attachInternalsSafely(host);

    expect(inheritedCalls).to.equal(0);
    expectFallbackInternals(internals);
  });

  it('calls a throwing data-descriptor method exactly once and falls back', () => {
    const host = Object.create(null) as HTMLElement;
    let calls = 0;
    let receiverWasHost = false;
    Object.defineProperty(host, 'attachInternals', {
      configurable: true,
      value(this: HTMLElement): ElementInternals {
        calls += 1;
        receiverWasHost = this === host;
        throw new Error('partial DOM attachInternals failure');
      },
    });

    const internals = attachInternalsSafely(host);

    expect(calls).to.equal(1);
    expect(receiverWasHost).to.equal(true);
    expectFallbackInternals(internals);
  });

  it('resolves an inherited data-descriptor method and preserves its host receiver', () => {
    const prototype = Object.create(null) as object;
    const expected = { states: new Set<string>() } as unknown as ElementInternals;
    let calls = 0;
    let receiverWasHost = false;
    let host: HTMLElement;
    Object.defineProperty(prototype, 'attachInternals', {
      configurable: true,
      value(this: HTMLElement): ElementInternals {
        calls += 1;
        receiverWasHost = this === host;
        return expected;
      },
    });
    host = Object.create(prototype) as HTMLElement;

    const internals = attachInternalsSafely(host);

    expect(internals === expected).to.equal(true);
    expect(calls).to.equal(1);
    expect(receiverWasHost).to.equal(true);
  });

  it('falls back when no attachInternals descriptor exists', () => {
    const internals = attachInternalsSafely(Object.create(null) as HTMLElement);

    expectFallbackInternals(internals);
  });
});
