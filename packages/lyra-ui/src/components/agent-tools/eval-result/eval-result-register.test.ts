import { expect } from '@open-wc/testing';
import './eval-result-register.js';

describe('lean registration entry', () => {
  it('defines the host without eagerly registering its optional children', () => {
    expect(typeof customElements.get('lr-eval-result')).to.equal('function');
    for (const name of ['rubric-form', 'diff-view']) {
      expect(customElements.get(`lr-${name}`) === undefined, name).to.equal(true);
    }
  });
});
