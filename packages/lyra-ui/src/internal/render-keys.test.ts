import { expect } from '@open-wc/testing';
import { occurrenceKeys } from './render-keys.js';

describe('occurrenceKeys', () => {
  it('keeps first identities verbatim and suffixes later duplicates', () => {
    const keys = occurrenceKeys(['a', 'b', 'a', 'a'], (value) => value);
    expect(keys.slice(0, 2)).to.deep.equal(['a', 'b']);
    expect(new Set(keys).size).to.equal(4);
    expect(occurrenceKeys([], String)).to.deep.equal([]);
  });
});
