import { expect } from '@open-wc/testing';
import { tag, LYRA_PREFIX, defineElement } from './prefix.js';

it('builds tag names from the prefix', () => {
  expect(LYRA_PREFIX).to.equal('lyra');
  expect(tag('combobox')).to.equal('lyra-combobox');
});

it('defineElement is idempotent when called twice for the same tag', () => {
  class DemoIdempotentEl extends HTMLElement {}
  const name = 'smoke-idempotent-demo';

  expect(() => defineElement(name, DemoIdempotentEl)).to.not.throw();
  // Without the `customElements.get` guard, this second call would throw a
  // DOMException ("the name ... has already been used with this registry").
  expect(() => defineElement(name, DemoIdempotentEl)).to.not.throw();
  expect(customElements.get(tag(name))).to.equal(DemoIdempotentEl);
});
