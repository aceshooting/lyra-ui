import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { cursorIds, cursorQueryText } from './document-library-cursor.js';

const current = () => true;
const query = (tags: readonly string[], searchTerm = '') => cursorQueryText(searchTerm, tags, current);

it('owns stable deduplicated cursor IDs and immutable query text snapshots', () => {
  fc.assert(fc.property(fc.array(fc.string({ maxLength: 100 }).map(value => `key:${value}`), { maxLength: 30 }), ids => {
    const expected = [...new Set(ids)];
    const snapshot = cursorIds(ids, 500, current);
    const accepted = query(ids, 'needle');
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
  expect(query(tags).tagFilter.length).to.equal(40);
  expect(query([...tags, tags[0]!]).tagFilter.length).to.equal(40);
  expect(() => query(tags, 'x')).to.throw(RangeError);
  expect(() => query([], 'x'.repeat(65_537))).to.throw(TypeError);
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
