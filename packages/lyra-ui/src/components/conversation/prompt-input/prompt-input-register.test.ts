import { expect } from '@open-wc/testing';
import './prompt-input-register.js';

describe('lean registration entry', () => {
  it('defines the host without eagerly registering its optional children', () => {
    expect(typeof customElements.get('lr-prompt-input')).to.equal('function');
    for (const name of ['model-select', 'prompt-queue', 'source-picker', 'voice-picker']) {
      expect(customElements.get(`lr-${name}`) === undefined, name).to.equal(true);
    }
  });
});
