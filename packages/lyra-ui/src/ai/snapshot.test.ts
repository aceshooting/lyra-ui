import { expect } from '@open-wc/testing';
import {
  createProviderSnapshotBudget,
  snapshotProviderValue,
} from './snapshot.js';

it('recursively owns provider data without retaining caller aliases', () => {
  const source = { nested: { values: [1, { label: 'original' }] } };
  const result = snapshotProviderValue(source);
  source.nested.values[1] = { label: 'mutated' };

  expect(result.ok).to.equal(true);
  if (result.ok) expect(result.value).to.deep.equal({ nested: { values: [1, { label: 'original' }] } });
});

it('rejects functions, cycles, accessors, sparse arrays, and class instances as one unit', () => {
  const cyclic: Record<string, unknown> = {};
  cyclic['self'] = cyclic;
  const accessor = Object.defineProperty({}, 'value', { enumerable: true, get: () => 1 });
  class ProviderClass {
    value = 1;
  }
  const invalid = [
    { nested: { callback: () => undefined } },
    cyclic,
    accessor,
    Array(2),
    new ProviderClass(),
  ];
  for (const value of invalid) expect(snapshotProviderValue(value).ok).to.equal(false);
});

it('normalizes dates and rejects non-finite numeric values', () => {
  const date = snapshotProviderValue({ at: new Date('2026-08-14T00:00:00.000Z') });
  expect(date.ok).to.equal(true);
  if (date.ok) expect(date.value).to.deep.equal({ at: '2026-08-14T00:00:00.000Z' });
  for (const value of [NaN, Infinity, -Infinity]) expect(snapshotProviderValue(value).ok).to.equal(false);
});

it('enforces shared node, byte, string, and depth budgets', () => {
  expect(snapshotProviderValue([1, 2], createProviderSnapshotBudget({ maxNodes: 2 })).ok).to.equal(false);
  expect(snapshotProviderValue('too long', createProviderSnapshotBudget({ maxStringCharacters: 3 })).ok).to.equal(false);
  expect(snapshotProviderValue('bytes', createProviderSnapshotBudget({ maxBytes: 10 })).ok).to.equal(false);
  expect(snapshotProviderValue({ a: { b: true } }, createProviderSnapshotBudget({ maxDepth: 1 })).ok).to.equal(false);

  const shared = createProviderSnapshotBudget({ maxNodes: 3, maxBytes: 1_024 });
  expect(snapshotProviderValue([1], shared).ok).to.equal(true);
  expect(snapshotProviderValue([2], shared).ok).to.equal(false);
});

it('rejects revoked and immediately throwing prototype inputs while preserving genuine dates', () => {
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  const throwing = new Proxy({}, {
    getPrototypeOf() { throw new Error('prototype denied'); },
  });
  for (const value of [revoked.proxy, throwing, { nested: revoked.proxy }, { nested: throwing }]) {
    expect(snapshotProviderValue(value)).to.deep.include({ ok: false, failure: 'invalid' });
  }
  const date = snapshotProviderValue(new Date('2026-08-14T00:00:00.000Z'));
  expect(date.ok).to.equal(true);
  if (date.ok) expect(date.value).to.equal('2026-08-14T00:00:00.000Z');
});

it('fails closed when hostile objects cannot be inspected', () => {
  let prototypeReads = 0;
  const prototypeTrap = new Proxy({}, {
    getPrototypeOf: () => {
      prototypeReads += 1;
      if (prototypeReads > 1) throw new Error('blocked');
      return Object.prototype;
    },
  });
  const ownKeysTrap = new Proxy({}, {
    ownKeys: () => {
      throw new Error('blocked');
    },
  });

  expect(snapshotProviderValue(prototypeTrap)).to.deep.include({ ok: false, failure: 'invalid' });
  expect(snapshotProviderValue(ownKeysTrap)).to.deep.include({ ok: false, failure: 'invalid' });
});

it('rejects collection metadata and budgets before copying partial data', () => {
  const augmented = [1] as number[] & { note?: string };
  augmented.note = 'provider metadata';

  expect(snapshotProviderValue(augmented)).to.deep.include({ ok: false, failure: 'invalid' });
  expect(snapshotProviderValue(
    { first: 1, second: 2 },
    createProviderSnapshotBudget({ maxNodes: 2 }),
  )).to.deep.include({ ok: false, failure: 'limit' });
  expect(snapshotProviderValue(
    new Date('2026-08-14T00:00:00.000Z'),
    createProviderSnapshotBudget({ maxBytes: 8 }),
  )).to.deep.include({ ok: false, failure: 'limit' });
});

it('names the exact reason each unsafe shape is rejected', () => {
  const exhausted = createProviderSnapshotBudget({ maxNodes: 1 });
  expect(snapshotProviderValue(1, exhausted).ok).to.equal(true);
  expect(snapshotProviderValue(2, exhausted)).to.deep.include({
    ok: false, failure: 'limit', reason: 'provider snapshot node limit exceeded',
  });

  expect(snapshotProviderValue(new Date(Number.NaN))).to.deep.include({
    ok: false, failure: 'invalid', reason: 'provider snapshot contains an invalid date',
  });

  const accessorArray: unknown[] = [];
  Object.defineProperty(accessorArray, 0, { enumerable: true, get: () => 1 });
  expect(snapshotProviderValue(accessorArray)).to.deep.include({
    ok: false, failure: 'invalid', reason: 'provider snapshot contains an accessor',
  });

  expect(snapshotProviderValue({ [Symbol('key')]: 1 })).to.deep.include({
    ok: false, failure: 'invalid', reason: 'provider snapshot contains a symbol key',
  });

  expect(snapshotProviderValue({ ['k'.repeat(100)]: 1 }, createProviderSnapshotBudget({ maxBytes: 64 }))).to.deep.include({
    ok: false, failure: 'limit', reason: 'provider snapshot byte limit exceeded',
  });
});

it('skips non-enumerable properties instead of copying them', () => {
  const source = Object.defineProperty({ shown: 1 }, 'hidden', { value: 2, enumerable: false });
  const result = snapshotProviderValue(source);
  expect(result.ok).to.equal(true);
  if (result.ok) expect({ ...(result.value as Record<string, unknown>) }).to.deep.equal({ shown: 1 });
});
