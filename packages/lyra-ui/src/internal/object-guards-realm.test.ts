import { expect } from '@open-wc/testing';
import { isCrossRealmPlainRecord, isPlainRecord } from './object-guards.js';

it('accepts a record from another realm that the same-realm guard rejects', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const foreign = (frame.contentWindow as unknown as { Object: ObjectConstructor }).Object.create(
      (frame.contentWindow as unknown as { Object: ObjectConstructor }).Object.prototype,
    ) as Record<string, unknown>;
    expect(isPlainRecord(foreign)).to.equal(false);
    expect(isCrossRealmPlainRecord(foreign)).to.equal(true);
  } finally {
    frame.remove();
  }
  expect(isCrossRealmPlainRecord({})).to.equal(true);
  expect(isCrossRealmPlainRecord(Object.create(null))).to.equal(true);
  expect(isCrossRealmPlainRecord([])).to.equal(false);
  expect(isCrossRealmPlainRecord(new (class Sample {})())).to.equal(false);
  expect(isCrossRealmPlainRecord(null)).to.equal(false);
});
