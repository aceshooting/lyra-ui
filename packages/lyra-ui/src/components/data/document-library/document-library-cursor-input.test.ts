import { expect } from '@open-wc/testing';
import { cursorIds, cursorQueryText } from './document-library-cursor.js';

const yes = () => true;

describe('document library cursor input admission', () => {
  it('detaches and deduplicates ids', () => {
    expect(cursorIds(['a', 'b', 'a'], 5, yes)).to.deep.equal(['a', 'b']);
  });

  it('rejects malformed lists and keys', () => {
    expect(() => cursorIds('a', 5, yes)).to.throw('Invalid cursor list');
    const sparse = ['a'];
    sparse.length = 2;
    expect(() => cursorIds(sparse, 5, yes)).to.throw('Invalid cursor list');
    const accessor = ['a'];
    Object.defineProperty(accessor, '0', { get: () => 'a' });
    expect(() => cursorIds(accessor, 5, yes)).to.throw('Invalid cursor list');
    expect(() => cursorIds([1], 5, yes)).to.throw('Invalid cursor key');
    expect(() => cursorIds(['  '], 5, yes)).to.throw('Invalid cursor key');
    expect(() => cursorIds(['x'.repeat(65_537)], 5, yes)).to.throw('Invalid cursor key');
  });

  it('enforces count and text ceilings', () => {
    expect(() => cursorIds(['a', 'b'], 1, yes)).to.throw('unique-key limit');
    const big = Array.from({ length: 10_001 }, (_, i) => String(i));
    expect(() => cursorIds(big, 20_000, yes)).to.throw('Cursor list limit');
    const heavy = Array.from({ length: 40 }, (_, i) => String(i).padEnd(60_000, 'x'));
    expect(() => cursorIds(heavy, 100, yes)).to.throw('input text limit');
  });

  it('stops when the operation is revoked', () => {
    expect(() => cursorIds(['a'], 5, () => false)).to.throw('Obsolete');
    let calls = 0;
    expect(() => cursorIds(['a'], 5, () => ++calls < 2)).to.throw('Obsolete');
  });

  it('bounds query text', () => {
    expect(cursorQueryText('find', ['t'], yes)).to.deep.equal({ searchTerm: 'find', tagFilter: ['t'] });
    expect(() => cursorQueryText(1, [], yes)).to.throw('Invalid cursor search');
    expect(() => cursorQueryText('x'.repeat(65_537), [], yes)).to.throw('Invalid cursor search');
    const tags = Array.from({ length: 40 }, (_, i) => String(i).padEnd(60_000, 'x'));
    expect(() => cursorQueryText('x'.repeat(65_536), tags.slice(0, 33), yes)).to.throw('query text limit');
  });
});
