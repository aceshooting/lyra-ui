import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { cursorIds, cursorQuery } from './document-library-cursor.js';
import type { DocumentLibrarySourceQuery } from './document-library.class.js';

const current = () => true;
const query = (tags: readonly string[], searchTerm = ''): DocumentLibrarySourceQuery => ({
  tagFilter: tags, searchTerm, sortKey: 'name', sortDir: 'asc', filter: undefined,
});

it('owns stable deduplicated cursor IDs and immutable query snapshots', () => {
  fc.assert(fc.property(fc.array(fc.string({ maxLength: 100 }).map(value => `key:${value}`), { maxLength: 30 }), ids => {
    const expected = [...new Set(ids)];
    const snapshot = cursorIds(ids, 500, current);
    const accepted = cursorQuery(query(ids, 'needle'), current);
    ids.length = 0;
    expect(snapshot).to.deep.equal(expected);
    expect(accepted.tagFilter).to.deep.equal(expected);
    expect(Object.isFrozen(snapshot)).to.equal(true);
    expect(Object.isFrozen(accepted)).to.equal(true);
    expect(Object.isFrozen(accepted.tagFilter)).to.equal(true);
  }), propertyRuns());
});

it('rejects cursor list accessors and holes without evaluating getters', () => {
  fc.assert(fc.property(fc.string(), value => {
    let reads = 0;
    const ids = Object.defineProperty(['initial'], '0', { get() { reads++; return value; } });
    expect(() => cursorIds(ids, 500, current)).to.throw(TypeError);
    expect(reads).to.equal(0);
    const holes = new Array<string>(1);
    expect(() => cursorIds(holes, 500, current)).to.throw(TypeError);
  }), propertyRuns());
});

it('distinguishes raw scan bounds from unique-key bounds', () => {
  expect(cursorIds(Array.from({ length: 10_000 }, () => 'same'), 500, current)).to.deep.equal(['same']);
  expect(() => cursorIds(Array.from({ length: 10_001 }, () => 'same'), 500, current)).to.throw(RangeError);
  expect(() => cursorIds(Array.from({ length: 501 }, (_, index) => `tag:${index}`), 500, current)).to.throw(RangeError);
});

it('checks the aggregate query text budget after stable deduplication', () => {
  const tags = Array.from({ length: 40 }, (_, index) => `${index}:`.padEnd(50_000, 'x'));
  expect(cursorQuery(query(tags), current).tagFilter.length).to.equal(40);
  expect(cursorQuery(query([...tags, tags[0]!]), current).tagFilter.length).to.equal(40);
  expect(() => cursorQuery(query(tags, 'x'), current)).to.throw(RangeError);
  expect(() => cursorQuery(query([], 'x'.repeat(65_537)), current)).to.throw(TypeError);
});

it('stops list projection as soon as a descriptor trap revokes the input', () => {
  let active = true;
  const reads: PropertyKey[] = [];
  const ids = new Proxy(['first', 'second'], { getOwnPropertyDescriptor(target, key) {
    reads.push(key);
    if (key === '0') active = false;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  expect(() => cursorIds(ids, 500, () => active)).to.throw(TypeError);
  expect(reads).to.deep.equal(['length', '0']);
});
