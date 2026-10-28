import { expect } from '@open-wc/testing';
import { createTimeIndex, TimeIndexError } from './time-index.js';

it('maps irregular timestamps without reordering or fabricating samples', () => {
  const input = [100, 200, 1000];
  const index = createTimeIndex(input);
  input[1] = 999;
  expect(index.timestamps).to.deep.equal([100, 200, 1000]);
  expect(Object.isFrozen(index.timestamps)).to.equal(true);
  expect(index.locate(600)).to.deep.equal({ lowerIndex: 1, upperIndex: 2, nearestIndex: 1, fraction: 0.5 });
  expect(index.locate(200)).to.deep.equal({ lowerIndex: 1, upperIndex: 1, nearestIndex: 1, fraction: 0 });
  expect(index.locate(-1)?.lowerIndex).to.equal(0);
  expect(index.locate(2000)?.upperIndex).to.equal(2);
  expect(index.instantAt(1)).to.equal(200);
  expect(createTimeIndex([]).locate(10)).to.equal(undefined);
});

it('rejects malformed timestamp identity without reading accessors or truncating', () => {
  let reads = 0;
  const accessor = [0];
  Object.defineProperty(accessor, '0', { get: () => { reads++; return 0; } });
  const revoked = Proxy.revocable([], {}); revoked.revoke();
  for (const values of [accessor, revoked.proxy, [1, 1], [2, 1], [NaN], [Infinity], [8.64e15 + 1], new Array<number>(2), Array.from({ length: 10001 }, (_, i) => i)]) {
    expect(() => createTimeIndex(values)).to.throw(TimeIndexError);
  }
  expect(reads).to.equal(0);
  const index = createTimeIndex([0]);
  expect(() => index.instantAt(1)).to.throw(TimeIndexError);
  expect(() => index.locate(NaN)).to.throw(TimeIndexError);
});
