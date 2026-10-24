import { expect } from '@open-wc/testing';
import { snapshotEventDetail } from './collection-snapshot.js';

describe('event snapshot work shared across identity collections', () => {
  const item = { id: 'retained-identity' };
  const factories = {
    array: () => Array.from({ length: 10_000 }, () => item),
    map: () => new Map(Array.from({ length: 10_000 }, (_, index) => [index, item] as const)),
    set: () => new Set(Array.from({ length: 10_000 }, (_, index) => index)),
  };

  for (const kind of ['array', 'map', 'set'] as const) {
    it(`rejects the whole event when several preserved ${kind} carriers exhaust the shared work ceiling`, () => {
      const source = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [
        `items${index}`, factories[kind](),
      ]));
      const keys = new Set(Object.keys(source));
      const smaller = Object.fromEntries(Object.entries(source).slice(0, 9));
      const accepted = snapshotEventDetail(smaller, undefined, undefined, keys) as Record<string, unknown>;
      expect(accepted !== null).to.equal(true);
      expect(Object.keys(accepted)).to.have.length(9);
      expect(Object.isFrozen(accepted)).to.equal(true);
      const first = accepted['items0'];
      expect(first === source['items0'], 'the carrier is detached').to.equal(false);
      expect(Object.isFrozen(first)).to.equal(true);
      if (kind === 'array') {
        expect((first as readonly unknown[]).length).to.equal(10_000);
        expect((first as readonly unknown[])[0] === item).to.equal(true);
      } else if (kind === 'map') {
        expect((first as ReadonlyMap<number, object>).size).to.equal(10_000);
        expect((first as ReadonlyMap<number, object>).get(0) === item).to.equal(true);
      } else {
        expect((first as ReadonlySet<number>).size).to.equal(10_000);
        expect((first as ReadonlySet<number>).has(9_999)).to.equal(true);
      }
      expect(snapshotEventDetail(source, undefined, undefined, keys)).to.equal(null);
      expect(Object.keys(source)).to.have.length(10);
      expect(Object.isFrozen(source)).to.equal(false);
      expect(Object.isFrozen(item), 'preserved items remain owned by the caller').to.equal(false);
      expect(snapshotEventDetail({ items: [item] }, undefined, undefined, new Set(['items'])))
        .to.deep.equal({ items: [item] });
    });
  }
});
