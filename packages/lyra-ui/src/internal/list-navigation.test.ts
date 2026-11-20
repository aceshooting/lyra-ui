import { expect } from '@open-wc/testing';
import {
  isCatalogOptionAvailable,
  isHandledOrComposingKey,
  isRepeatedActivationKey,
  isRovingTargetAvailable,
  resolveListMove,
  shouldIgnoreActivationKey,
  shouldIgnoreNavigationKey,
} from './list-navigation.js';

describe('list navigation', () => {
  it('yields a key an earlier listener claimed, while a claiming caller can still resolve its move', () => {
    const claimed = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
    claimed.preventDefault();
    const composing = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true });
    const modified = new KeyboardEvent('keydown', { key: 'Backspace', ctrlKey: true });
    expect(shouldIgnoreNavigationKey(claimed)).to.equal(true);
    expect(shouldIgnoreActivationKey(claimed)).to.equal(true);
    expect(isHandledOrComposingKey(claimed)).to.equal(true);
    expect(isHandledOrComposingKey(composing)).to.equal(true);
    expect(isHandledOrComposingKey(modified)).to.equal(false);
    expect(shouldIgnoreNavigationKey(modified)).to.equal(true);
    expect(shouldIgnoreNavigationKey(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).to.equal(false);
    expect(resolveListMove(claimed, { count: 3, current: 0, orientation: 'vertical' })).to.equal(1);
  });

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

  it('reports no target when a nonwrapping clamp finds no available edge to enter', () => {
    const options = {
      count: 3, current: -1, orientation: 'vertical' as const, wrap: false, clamp: true, backwardFromMissing: 'first' as const,
    };
    expect(resolveListMove('ArrowUp', { ...options, isAvailable: () => false })).to.equal(null);
    expect(resolveListMove('ArrowUp', { ...options, isAvailable: index => index === 1 })).to.equal(1);
    expect(resolveListMove('ArrowUp', options)).to.equal(0);
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

  it('does not retain a newly disabled current item when a nonwrapping arrow reaches an edge', () => {
    const unavailable = new Set([0, 2]);
    const options = { count: 3, orientation: 'vertical' as const, wrap: false, clamp: true,
      isAvailable: (index: number) => !unavailable.has(index) };
    expect(resolveListMove('ArrowUp', { ...options, current: 0 })).to.equal(null);
    expect(resolveListMove('ArrowDown', { ...options, current: 2 })).to.equal(null);
    expect(resolveListMove('ArrowDown', { ...options, current: 0 })).to.equal(1);
    unavailable.clear();
    expect(resolveListMove('ArrowUp', { ...options, current: 0 })).to.equal(0);
    expect(resolveListMove('ArrowDown', { ...options, current: 2 })).to.equal(2);
  });
});

describe('activation key guard', () => {
  const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', { key: 'Enter', ...init });

  it('ignores auto-repeat, composition and every modifier, and passes plain keys', () => {
    expect(isRepeatedActivationKey(key({ repeat: true }))).to.equal(true);
    expect(isRepeatedActivationKey(key({}))).to.equal(false);
    expect(shouldIgnoreActivationKey(key({ repeat: true }))).to.equal(true);
    expect(shouldIgnoreActivationKey(key({ isComposing: true }))).to.equal(true);
    expect(shouldIgnoreActivationKey(key({ keyCode: 229 }))).to.equal(true);
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey'] as const) {
      expect(shouldIgnoreActivationKey(key({ [modifier]: true }))).to.equal(true);
    }
    expect(shouldIgnoreActivationKey(key({}))).to.equal(false);
    expect(shouldIgnoreActivationKey(key({ key: ' ', shiftKey: true }))).to.equal(false);
  });
});

describe('roving target availability across shadow boundaries', () => {
  it('rejects disabled, aria-disabled and aria-hidden targets and accepts a plain one', () => {
    const button = document.body.appendChild(document.createElement('button'));
    expect(isRovingTargetAvailable(button)).to.equal(true);
    button.disabled = true;
    expect(isRovingTargetAvailable(button)).to.equal(false);
    button.disabled = false;
    button.setAttribute('aria-disabled', 'true');
    expect(isRovingTargetAvailable(button)).to.equal(false);
    button.removeAttribute('aria-disabled');
    button.setAttribute('aria-hidden', 'true');
    expect(isRovingTargetAvailable(button)).to.equal(false);
    button.remove();
  });

  it('rejects a target under a hidden or inert host that sits outside its shadow root', async () => {
    for (const attribute of ['hidden', 'inert']) {
      const host = document.body.appendChild(document.createElement('div'));
      const target = host.attachShadow({ mode: 'open' }).appendChild(document.createElement('button'));
      expect(isRovingTargetAvailable(target)).to.equal(true);
      host.setAttribute(attribute, '');
      expect(isRovingTargetAvailable(target)).to.equal(false);
      host.remove();
    }
  });

  it('stops the ancestor walk after the boundary but still honors the boundary itself', () => {
    const container = document.body.appendChild(document.createElement('div'));
    const widget = container.attachShadow({ mode: 'open' }).appendChild(document.createElement('div'));
    const target = widget.appendChild(document.createElement('button'));
    container.setAttribute('inert', '');
    expect(isRovingTargetAvailable(target)).to.equal(false);
    expect(isRovingTargetAvailable(target, widget)).to.equal(true);
    widget.setAttribute('hidden', '');
    expect(isRovingTargetAvailable(target, widget)).to.equal(false);
    container.remove();
  });
});

describe('catalog option availability', () => {
  it('ignores the owner hidden data slot but honours authored hidden, inert and disabled states', () => {
    const outer = document.body.appendChild(document.createElement('div'));
    const owner = outer.appendChild(document.createElement('div'));
    const slot = owner.attachShadow({ mode: 'open' }).appendChild(document.createElement('div'));
    slot.hidden = true;
    slot.appendChild(document.createElement('slot'));
    const group = owner.appendChild(document.createElement('div'));
    const option = group.appendChild(document.createElement('button'));
    try {
      expect(isRovingTargetAvailable(option)).to.equal(false);
      expect(isCatalogOptionAvailable(option, owner)).to.equal(true);
      for (const attribute of ['hidden', 'inert']) {
        group.setAttribute(attribute, '');
        expect(isCatalogOptionAvailable(option, owner)).to.equal(false);
        group.removeAttribute(attribute);
      }
      option.disabled = true;
      expect(isCatalogOptionAvailable(option, owner)).to.equal(false);
      option.disabled = false;
      option.setAttribute('aria-disabled', 'true');
      expect(isCatalogOptionAvailable(option, owner)).to.equal(false);
      option.removeAttribute('aria-disabled');
      outer.setAttribute('inert', '');
      expect(isCatalogOptionAvailable(option, owner)).to.equal(false);
      outer.removeAttribute('inert');
      const detached = document.createElement('button');
      expect(isCatalogOptionAvailable(detached, owner)).to.equal(true);
      detached.hidden = true;
      expect(isCatalogOptionAvailable(detached, owner)).to.equal(false);
    } finally {
      outer.remove();
    }
  });
});
