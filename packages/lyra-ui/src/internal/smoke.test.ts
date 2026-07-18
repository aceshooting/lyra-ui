import { expect } from '@open-wc/testing';
import { tag, LYRA_PREFIX, defineElement } from './prefix.js';

it('builds tag names from the prefix', () => {
  expect(LYRA_PREFIX).to.equal('lr');
  expect(tag('combobox')).to.equal('lr-combobox');
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

it('warns when an existing tag belongs to a different constructor', () => {
  class ExistingEl extends HTMLElement {}
  class ReplacementEl extends HTMLElement {}
  const name = 'smoke-conflicting-demo';
  customElements.define(tag(name), ExistingEl);
  const originalWarn = console.warn;
  let warning = '';
  console.warn = (...args: unknown[]) => {
    warning = args.join(' ');
  };
  try {
    expect(() => defineElement(name, ReplacementEl)).to.not.throw();
  } finally {
    console.warn = originalWarn;
  }
  expect(customElements.get(tag(name))).to.equal(ExistingEl);
  expect(warning).to.contain('different constructor');
});
