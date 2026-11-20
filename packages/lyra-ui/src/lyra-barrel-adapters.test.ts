import { expect } from '@open-wc/testing';
import { loadLibphonenumberAdapter } from './lyra.js';
import { fetchedModule } from '../test/resource-entries.js';

it('exports the phone adapter loader without loading the phone-input class module', () => {
  expect(loadLibphonenumberAdapter).to.be.a('function');
  expect(fetchedModule(/phone-number-adapter/)).to.equal(true);
  expect(fetchedModule(/phone-input\.class/, { control: '/lyra.ts' })).to.equal(false);
});
