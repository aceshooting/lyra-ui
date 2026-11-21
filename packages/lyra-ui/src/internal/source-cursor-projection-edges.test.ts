import { expect } from '@open-wc/testing';
import { cursorCurrent, cursorField, cursorList, cursorText, cursorToken } from './source-cursor-projection.js';

const yes = () => true;
const no = () => false;

describe('source cursor projection edges', () => {
  it('rejects a revoked operation at each checkpoint', () => {
    expect(() => cursorCurrent(no)).to.throw('revoked');
    expect(() => cursorField({ a: 1 }, 'a', no)).to.throw('revoked');
    let calls = 0;
    expect(() => cursorField({ a: 1 }, 'a', () => ++calls < 2)).to.throw('revoked');
    expect(() => cursorList([], 1, no)).to.throw('revoked');
  });

  it('reads own data fields of objects and functions only', () => {
    expect(cursorField(Object.assign(() => undefined, { k: 7 }), 'k', yes)).to.equal(7);
    expect(() => cursorField(null, 'k', yes)).to.throw('Invalid cursor object');
    expect(() => cursorField('text', 'k', yes)).to.throw('Invalid cursor object');
    expect(() => cursorField({}, 'k', yes)).to.throw('Missing cursor field');
    expect(cursorField({}, 'k', yes, false)).to.equal(undefined);
    expect(() => cursorField({ get k() { return 1; } }, 'k', yes)).to.throw('Accessor');
  });

  it('bounds lists', () => {
    expect(cursorList(['a', 'b'], 2, yes)).to.deep.equal(['a', 'b']);
    expect(() => cursorList('ab', 2, yes)).to.throw('Invalid cursor collection');
    expect(() => cursorList(['a', 'b', 'c'], 2, yes)).to.throw('Cursor collection limit');
  });

  it('bounds text and tokens', () => {
    expect(cursorText('abc', 3)).to.equal('abc');
    expect(() => cursorText(1, 3)).to.throw('Invalid cursor text');
    expect(() => cursorText('abcd', 3)).to.throw('Invalid cursor text');
    expect(() => cursorText('  ', 3, true)).to.throw('Invalid cursor text');
    expect(cursorText('  ', 3)).to.equal('  ');
    expect(cursorToken(null)).to.equal(null);
    expect(cursorToken('next')).to.equal('next');
    expect(() => cursorToken('')).to.throw('Empty cursor token');
  });
});
