import { expect } from '@open-wc/testing';
import './condition-builder-register.js';

describe('lean registration entry', () => {
  it('defines the host without eagerly registering its optional children', () => {
    expect(typeof customElements.get('lr-condition-builder')).to.equal('function');
    for (const name of ['date-input', 'combobox']) {
      expect(customElements.get(`lr-${name}`) === undefined, name).to.equal(true);
    }
  });
});
