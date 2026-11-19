import { expect } from '@open-wc/testing';
import { isConstructor, isRuntimeArray } from './object-guards.js';

function revokedProxy<T extends object>(target: T): T {
  const { proxy, revoke } = Proxy.revocable(target, {});
  revoke();
  return proxy;
}

describe('isRuntimeArray', () => {
  it('accepts arrays from any realm and proxies of arrays', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const ForeignArray = (frame.contentWindow as unknown as { Array: ArrayConstructor }).Array;
      expect(isRuntimeArray(new ForeignArray(2))).to.equal(true);
    } finally {
      frame.remove();
    }
    expect(isRuntimeArray([])).to.equal(true);
    expect(isRuntimeArray(new Proxy([1], {}))).to.equal(true);
  });

  it('rejects array-likes and a revoked proxy without throwing', () => {
    expect(isRuntimeArray({ length: 0 })).to.equal(false);
    expect(isRuntimeArray(new Uint8Array(1))).to.equal(false);
    expect(isRuntimeArray('ab')).to.equal(false);
    expect(isRuntimeArray(null)).to.equal(false);
    expect(isRuntimeArray(revokedProxy([]))).to.equal(false);
  });
});

describe('isConstructor', () => {
  it('accepts classes, ordinary and bound functions without running them', () => {
    let ran = 0;
    class Counted {
      constructor() {
        ran += 1;
      }
    }
    function Legacy(this: unknown): void {
      ran += 1;
    }
    expect(isConstructor(Counted)).to.equal(true);
    expect(isConstructor(Legacy)).to.equal(true);
    expect(isConstructor(Legacy.bind(null))).to.equal(true);
    expect(isConstructor(new Proxy(Counted, {}))).to.equal(true);
    expect(ran).to.equal(0);
  });

  it('rejects callables that cannot be constructed and every non-function', () => {
    const shorthand = { method(): void {} };
    expect(isConstructor(() => undefined)).to.equal(false);
    expect(isConstructor(async function load(): Promise<void> {})).to.equal(false);
    expect(isConstructor(function* steps(): Generator<number> {})).to.equal(false);
    expect(isConstructor(shorthand.method)).to.equal(false);
    expect(isConstructor(Math.max)).to.equal(false);
    expect(isConstructor({ prototype: {} })).to.equal(false);
    expect(isConstructor(null)).to.equal(false);
  });

  it('fails closed for a revoked or hostile function proxy', () => {
    class Target {}
    const hostile = new Proxy(Target, {
      get(): never {
        throw new Error('prototype read');
      },
    });
    expect(isConstructor(revokedProxy(Target))).to.equal(false);
    expect(isConstructor(hostile)).to.equal(false);
  });
});
