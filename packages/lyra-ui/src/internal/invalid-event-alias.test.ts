import { expect } from '@open-wc/testing';
import {
  installInteractionOnInvalid,
  installInvalidEventAlias,
  isStaticValidityCheckInProgress,
  withStaticValidityCheck,
} from './invalid-event-alias.js';

describe('static validity check scope', () => {
  it('is in progress only while the check is on the stack, including nested checks and a throwing check', () => {
    const host = new EventTarget();
    expect(isStaticValidityCheckInProgress(host)).to.equal(false);
    const result = withStaticValidityCheck(host, () => {
      expect(isStaticValidityCheckInProgress(host)).to.equal(true);
      withStaticValidityCheck(host, () => expect(isStaticValidityCheckInProgress(host)).to.equal(true));
      expect(isStaticValidityCheckInProgress(host), 'the outer scope outlives the inner one').to.equal(true);
      return 'checked';
    });
    expect(result).to.equal('checked');
    expect(isStaticValidityCheckInProgress(host)).to.equal(false);
    expect(() => withStaticValidityCheck(host, () => { throw new Error('check failed'); })).to.throw('check failed');
    expect(isStaticValidityCheckInProgress(host), 'a throwing check still releases the scope').to.equal(false);
  });

  it('scopes the check to one host', () => {
    const first = new EventTarget();
    const second = new EventTarget();
    withStaticValidityCheck(first, () => {
      expect(isStaticValidityCheckInProgress(first)).to.equal(true);
      expect(isStaticValidityCheckInProgress(second)).to.equal(false);
    });
  });
});

describe('invalid event listeners', () => {
  it('marks interaction for an invalid event on the host unless a static check is running or a descendant raised it', () => {
    const host = document.createElement('div');
    const child = host.appendChild(document.createElement('input'));
    let interactions = 0;
    installInteractionOnInvalid(host, () => { interactions += 1; });
    host.dispatchEvent(new Event('invalid'));
    expect(interactions).to.equal(1);
    withStaticValidityCheck(host, () => host.dispatchEvent(new Event('invalid')));
    expect(interactions, 'a silent static check never marks interaction').to.equal(1);
    child.dispatchEvent(new Event('invalid', { bubbles: true, composed: true }));
    expect(interactions, 'a descendant failing is not the host failing').to.equal(1);
    host.dispatchEvent(new Event('invalid'));
    expect(interactions).to.equal(2);
  });

  it('relays invalid through a cancelable alias and forwards its cancellation to the native event', () => {
    const host = document.createElement('div');
    const child = host.appendChild(document.createElement('input'));
    const inits: unknown[] = [];
    let cancelAlias = false;
    installInvalidEventAlias(host, (init) => {
      inits.push(init);
      const alias = new Event('lr-invalid', { cancelable: init.cancelable });
      if (cancelAlias) alias.preventDefault();
      return alias;
    });
    const plain = new Event('invalid', { cancelable: true });
    host.dispatchEvent(plain);
    expect(plain.defaultPrevented).to.equal(false);
    cancelAlias = true;
    const vetoed = new Event('invalid', { cancelable: true });
    host.dispatchEvent(vetoed);
    expect(vetoed.defaultPrevented, 'cancelling the alias suppresses the native default').to.equal(true);
    const descendant = new Event('invalid', { bubbles: true, composed: true, cancelable: true });
    child.dispatchEvent(descendant);
    expect(descendant.defaultPrevented).to.equal(false);
    expect(inits).to.deep.equal([{ cancelable: true }, { cancelable: true }]);
  });

  it('accepts an emitter that returns nothing', () => {
    const host = document.createElement('div');
    installInvalidEventAlias(host, () => undefined);
    const event = new Event('invalid', { cancelable: true });
    host.dispatchEvent(event);
    expect(event.defaultPrevented).to.equal(false);
  });
});
