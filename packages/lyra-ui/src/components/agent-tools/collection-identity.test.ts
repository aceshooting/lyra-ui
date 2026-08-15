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

  it('ignores malformed rows and identity accessors that throw while retaining a valid tail', () => {
    const hostile = Object.defineProperty({}, 'id', {
      get(): never {
        throw new Error('hostile identity');
      },
    });
    const valid = { id: 'valid' };
    const values: unknown[] = [null, hostile, valid];

    expect(firstByIdentity(values, (value) => (value as { id: string }).id)).to.deep.equal([valid]);
  });

  it('rejects non-string runtime key types', () => {
    const values: Array<{ key: unknown }> = [{ key: null }, { key: false }, { key: {} }, { key: 0 }];

    expect(firstByIdentity(values, (value) => value.key)).to.deep.equal([]);
  });
});
