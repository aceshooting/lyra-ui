import { expect } from '@open-wc/testing';
import { nativePopoverSupported } from './native-popover.js';

describe('nativePopoverSupported', () => {
  /** Replaces an own property of `target` for the duration of `body`, restoring it afterwards. */
  function withProperty<T>(target: object, key: string, value: unknown, body: () => T): T {
    const original = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, writable: true, value });
    try {
      return body();
    } finally {
      if (original) Object.defineProperty(target, key, original);
      else Reflect.deleteProperty(target, key);
    }
  }

  it('reports the real engine capability: the API is present and the style engine knows :popover-open', () => {
    const expected = typeof HTMLElement.prototype.showPopover === 'function' && CSS.supports('selector(:popover-open)');
    expect(nativePopoverSupported()).to.equal(expected);
  });

  it('is false in an engine without the Popover API', () => {
    const original = HTMLElement.prototype.showPopover;
    withProperty(HTMLElement.prototype, 'showPopover', undefined, () => {
      expect(nativePopoverSupported()).to.equal(false);
    });
    expect(HTMLElement.prototype.showPopover === original, 'the stub is removed afterwards').to.equal(true);
  });

  it('is false for a polyfill that defines showPopover() but cannot teach the style engine :popover-open', () => {
    withProperty(CSS, 'supports', () => false, () => {
      expect(nativePopoverSupported()).to.equal(false);
    });
  });

  it('is false when the style-engine probe itself throws or is unavailable', () => {
    withProperty(CSS, 'supports', () => { throw new TypeError('probe unavailable'); }, () => {
      expect(nativePopoverSupported()).to.equal(false);
    });
    withProperty(CSS, 'supports', undefined, () => {
      expect(nativePopoverSupported()).to.equal(false);
    });
  });
  it('assumes support where there is no CSS or HTMLElement global to judge by', () => {
    withProperty(window, 'CSS', undefined, () => {
      expect(nativePopoverSupported()).to.equal(true);
    });
    withProperty(window, 'HTMLElement', undefined, () => {
      expect(nativePopoverSupported()).to.equal(true);
    });
    expect(typeof CSS).to.equal('object');
    expect(typeof HTMLElement).to.equal('function');
  });
});
