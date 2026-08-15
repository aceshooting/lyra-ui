import { expect } from '@open-wc/testing';
import { firstByIdentity } from './collection-identity.js';

describe('firstByIdentity', () => {
  it('keeps the first unique nonempty identity without rewriting the retained key', () => {
    const first = { id: 'alpha', label: 'first' };
    const values = [
      { id: '', label: 'empty' },
      { id: '   ', label: 'blank' },
      { id: null as unknown as string, label: 'malformed' },
      first,
      { id: 'alpha', label: 'duplicate' },
      { id: 'path with spaces', label: 'internal whitespace' },
    ];

    expect(firstByIdentity(values, (value) => value.id)).to.deep.equal([
      first,
      { id: 'path with spaces', label: 'internal whitespace' },
    ]);
  });
});
