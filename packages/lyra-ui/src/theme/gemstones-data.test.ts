import { expect } from '@open-wc/testing';
import {
  DEFAULT_GEMSTONE,
  GEMSTONE_KEYS,
  GEMSTONES,
  type GemstoneAccent,
  type GemstoneKey,
} from './gemstones-data.js';

it('exports the canonical gemstone palette from the Lit-free data entry', () => {
  const key: GemstoneKey = DEFAULT_GEMSTONE;
  const accent: GemstoneAccent = GEMSTONES[key];

  expect(GEMSTONE_KEYS).to.have.lengthOf(9);
  expect(key).to.equal('emerald');
  expect(accent).to.deep.equal({
    key: 'emerald',
    fill: '#34d399',
    deep: '#1d4f3b',
  });
});
