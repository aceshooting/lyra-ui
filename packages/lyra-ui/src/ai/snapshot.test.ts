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
