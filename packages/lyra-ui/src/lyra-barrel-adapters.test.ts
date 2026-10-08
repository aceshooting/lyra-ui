import { expect } from '@open-wc/testing';
import { loadLibphonenumberAdapter } from './lyra.js';

it('exports the phone adapter loader without loading the phone-input class module', () => {
  expect(loadLibphonenumberAdapter).to.be.a('function');
  const loaded = performance.getEntriesByType('resource').map((entry) => entry.name);
  expect(loaded.some((name) => name.includes('phone-number-adapter'))).to.equal(true);
  expect(loaded.some((name) => name.includes('phone-input.class'))).to.equal(false);
});
