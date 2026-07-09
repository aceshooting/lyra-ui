import { expect } from '@open-wc/testing';
import { tag, LYRA_PREFIX } from './prefix.js';

it('builds tag names from the prefix', () => {
  expect(LYRA_PREFIX).to.equal('lyra');
  expect(tag('combobox')).to.equal('lyra-combobox');
});
