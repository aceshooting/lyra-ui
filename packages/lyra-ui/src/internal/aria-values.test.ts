import { expect } from '@open-wc/testing';
import { isAriaTrue } from './aria-values.js';
import { isAriaTrue as visibilityIsAriaTrue } from './accessibility-visibility.js';

describe('aria-values', () => {
  it('reads an ASCII case-insensitive, trimmed true token', () => {
    expect(isAriaTrue('true')).to.equal(true);
    expect(isAriaTrue(' TRUE ')).to.equal(true);
    expect(isAriaTrue('false')).to.equal(false);
    expect(isAriaTrue('')).to.equal(false);
    expect(isAriaTrue(null)).to.equal(false);
  });

  it('stays the same function the accessibility-visibility module exports', () => {
    expect(visibilityIsAriaTrue === isAriaTrue).to.equal(true);
  });
});
