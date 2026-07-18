import { expect } from '@open-wc/testing';
import { LyraEmpty } from '../components/empty/empty.class.js';

it('keeps pure class imports out of the custom-element registry', () => {
  expect(customElements.get('lr-empty') === undefined).to.be.true;
  expect(LyraEmpty.prototype).to.be.instanceOf(Object);
});
