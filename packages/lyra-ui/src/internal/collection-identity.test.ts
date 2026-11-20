import { expect } from '@open-wc/testing';
import { firstByIdentity, firstByIdentityMemo } from './collection-identity.js';

const id = (item: { id?: unknown }): unknown => item.id;

describe('collection identity', () => {
  it('keeps the first nonblank string identity', () => {
    expect(firstByIdentity([{ id: 'a', n: 1 }, { id: 'a', n: 2 }, { id: ' ' }, { id: 3 }, { id: 'b' }], id).map((i) => i.id))
      .to.deep.equal(['a', 'b']);
  });

  it('memoizes per array identity and identity reader', () => {
    const items = [{ id: 'a' }, { id: 'a' }, { id: 'b' }];
    const first = firstByIdentityMemo(items, id);
    expect(firstByIdentityMemo(items, id)).to.equal(first);
    expect(first).to.have.length(2);
    const other = (item: { id?: unknown }): unknown => item.id;
    expect(firstByIdentityMemo(items, other)).to.not.equal(first);
    const next = [...items, { id: 'c' }];
    expect(firstByIdentityMemo(next, id)).to.have.length(3);
    expect(firstByIdentityMemo(items, id)).to.equal(first);
  });

  it('tolerates non-array runtime input without throwing', () => {
    expect(firstByIdentityMemo(null as unknown as readonly { id?: unknown }[], id)).to.deep.equal([]);
    expect(firstByIdentityMemo(undefined as unknown as readonly { id?: unknown }[], id)).to.deep.equal([]);
  });
});

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
