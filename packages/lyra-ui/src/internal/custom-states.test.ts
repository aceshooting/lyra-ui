import { expect } from '@open-wc/testing';
import { hasCustomState, setCustomState } from './custom-states.js';

class StatesProbe extends HTMLElement {
  readonly internals = this.attachInternals();
}
customElements.define('lr-custom-states-probe', StatesProbe);

/** A `states` set from an engine that rejects undashed names, or from a hostile shim. */
function rejectingInternals(): ElementInternals {
  const reject = (): never => {
    throw new DOMException('Invalid state name', 'SyntaxError');
  };
  return { states: { add: reject, delete: reject, has: reject } } as unknown as ElementInternals;
}

describe('custom states', () => {
  it('reads a state through the same guards that write it', () => {
    const probe = document.createElement('lr-custom-states-probe') as StatesProbe;
    expect(hasCustomState(probe.internals, 'user-invalid')).to.equal(false);
    setCustomState(probe.internals, 'user-invalid', true);
    expect(hasCustomState(probe.internals, 'user-invalid')).to.equal(true);
    setCustomState(probe.internals, 'user-invalid', false);
    expect(hasCustomState(probe.internals, 'user-invalid')).to.equal(false);
  });

  it('treats missing internals, a missing CustomStateSet and a rejecting engine as an absent state', () => {
    expect(hasCustomState(undefined, 'blank')).to.equal(false);
    expect(hasCustomState({} as ElementInternals, 'blank')).to.equal(false);
    const rejecting = rejectingInternals();
    expect(() => setCustomState(rejecting, 'blank', true)).to.not.throw();
    expect(hasCustomState(rejecting, 'blank')).to.equal(false);
  });
});
