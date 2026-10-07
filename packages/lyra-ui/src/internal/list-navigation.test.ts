import { expect } from '@open-wc/testing';
import { isRovingTargetAvailable, resolveListMove } from './list-navigation.js';

describe('list navigation', () => {
  it('maps inline arrows through RTL and block arrows independently', () => {
    const options = { count: 3, current: 0, orientation: 'horizontal' as const, direction: 'rtl' as const };
    expect(resolveListMove('ArrowLeft', options)).to.equal(1);
    expect(resolveListMove('ArrowRight', options)).to.equal(2);
    expect(resolveListMove('ArrowDown', options)).to.equal(null);
    expect(resolveListMove('ArrowDown', { ...options, orientation: 'vertical' })).to.equal(1);
  });

  it('skips unavailable items, wraps only when requested, and preserves the missing-origin policy', () => {
    const options = { count: 4, current: 0, orientation: 'both' as const, isAvailable: (index: number) => index !== 1 };
    expect(resolveListMove('ArrowDown', options)).to.equal(2);
    expect(resolveListMove('Home', { ...options, isAvailable: (index: number) => index > 0 })).to.equal(1);
    expect(resolveListMove('ArrowUp', { ...options, current: -1 })).to.equal(3);
    expect(resolveListMove('ArrowUp', { ...options, current: -1, wrap: false, backwardFromMissing: 'first' })).to.equal(0);
    expect(resolveListMove('ArrowDown', { ...options, current: 3, wrap: false })).to.equal(null);
    expect(resolveListMove('ArrowDown', { ...options, current: 3, wrap: false, clamp: true })).to.equal(3);
    expect(resolveListMove('ArrowDown', {
      ...options, current: 2, wrap: false, clamp: true, isAvailable: index => index < 3,
    })).to.equal(2);
    expect(resolveListMove('ArrowUp', {
      ...options, current: -1, wrap: false, clamp: true, backwardFromMissing: 'first',
      isAvailable: index => index === 2,
    })).to.equal(2);
    expect(resolveListMove(new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true }), options)).to.equal(null);
  });

  it('rejects disabled, hidden, and inert targets', () => {
    const wrapper = document.createElement('div');
    const item = document.createElement('button');
    wrapper.append(item);
    document.body.append(wrapper);
    try {
      expect(isRovingTargetAvailable(item)).to.equal(true);
      item.disabled = true;
      expect(isRovingTargetAvailable(item)).to.equal(false);
      item.disabled = false;
      wrapper.inert = true;
      expect(isRovingTargetAvailable(item)).to.equal(false);
    } finally {
      wrapper.remove();
    }
  });
});
