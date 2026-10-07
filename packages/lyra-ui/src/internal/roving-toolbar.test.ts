import { expect } from '@open-wc/testing';
import { RovingToolbarController, leaseTabIndex } from './roving-toolbar.js';

describe('roving toolbar primitives', () => {
  it('resolves RTL movement and ignores consumed or modified keys', () => {
    const toolbar = new RovingToolbarController();
    const key = (name: string) => new KeyboardEvent('keydown', { key: name, cancelable: true });
    expect(toolbar.move(key('ArrowLeft'), 3, 0, 'rtl')).to.equal(1);
    expect(toolbar.move(key('End'), 3, 0, 'ltr')).to.equal(2);
    const consumed = key('ArrowRight');
    consumed.preventDefault();
    expect(toolbar.move(consumed, 3, 0, 'ltr')).to.equal(null);
    expect(toolbar.move(new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true }), 3, 0, 'ltr'))
      .to.equal(null);
  });

  it('restores an untouched authored tabindex and preserves a later author write', () => {
    const target = document.createElement('button');
    target.setAttribute('tabindex', '2');
    const lease = leaseTabIndex();
    lease.set(target, -1);
    expect(lease.hasAuthored(target)).to.equal(true);
    lease.release();
    expect(target.getAttribute('tabindex')).to.equal('2');

    lease.set(target, 0);
    target.setAttribute('tabindex', '3');
    lease.set(target, -1);
    lease.release();
    expect(target.getAttribute('tabindex')).to.equal('3');
  });

  it('releases the old element when a provider replaces its button', () => {
    const first = document.createElement('button');
    const second = document.createElement('button');
    const lease = leaseTabIndex();
    lease.set(first, 0);
    lease.set(second, -1);
    expect(first.hasAttribute('tabindex')).to.equal(false);
    expect(second.getAttribute('tabindex')).to.equal('-1');
    lease.release();
    expect(second.hasAttribute('tabindex')).to.equal(false);
  });
});
