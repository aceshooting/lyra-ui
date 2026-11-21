import { expect } from '@open-wc/testing';
import { snapshotPublicCollection, writeNormalizedOwnedCollection } from './collection-snapshot.js';
import { LyraElement } from './lyra-element.js';
import { tag } from './prefix.js';

class FacadeHost extends LyraElement {}
customElements.define(tag('facade-host-test'), FacadeHost);

describe('collection snapshot facades', () => {
  it('exposes read-only map and set views that mirror their contents', () => {
    const map = snapshotPublicCollection(new Map([['a', 1], ['b', 2]])) as ReadonlyMap<string, number>;
    const seen: unknown[] = [];
    const thisArg = { tag: 'ctx' };
    map.forEach(function (this: unknown, value, key, owner) { seen.push([value, key, owner === map, this === thisArg]); }, thisArg);
    expect(seen).to.deep.equal([[1, 'a', true, true], [2, 'b', true, true]]);
    expect(map.size).to.equal(2);
    expect(map.get('b')).to.equal(2);
    expect(map.has('c')).to.equal(false);
    expect([...map.keys()]).to.deep.equal(['a', 'b']);
    expect([...map.values()]).to.deep.equal([1, 2]);
    expect([...map.entries()]).to.deep.equal([['a', 1], ['b', 2]]);
    expect([...map]).to.deep.equal([['a', 1], ['b', 2]]);

    const set = snapshotPublicCollection(new Set(['x', 'y'])) as ReadonlySet<string>;
    const entries: unknown[] = [];
    set.forEach(function (this: unknown, value, key, owner) { entries.push([value, key, owner === set, this === thisArg]); }, thisArg);
    expect(entries).to.deep.equal([['x', 'x', true, true], ['y', 'y', true, true]]);
    expect(set.size).to.equal(2);
    expect(set.has('y')).to.equal(true);
    expect([...set.keys()]).to.deep.equal(['x', 'y']);
    expect([...set.values()]).to.deep.equal(['x', 'y']);
    expect([...set.entries()]).to.deep.equal([['x', 'x'], ['y', 'y']]);
    expect([...set]).to.deep.equal(['x', 'y']);
  });

  it('does not let a revoked collection cross by identity', () => {
    const { proxy, revoke } = Proxy.revocable([], {});
    revoke();
    expect(snapshotPublicCollection(proxy)).to.deep.equal([]);
    expect(snapshotPublicCollection(null)).to.equal(null);
    expect(snapshotPublicCollection(3)).to.equal(3);
  });

  it('runs a normalized write once per property and clears its tracking', () => {
    const host = document.createElement(tag('facade-host-test')) as FacadeHost;
    const order: string[] = [];
    writeNormalizedOwnedCollection(host, 'rows', () => {
      order.push('outer');
      writeNormalizedOwnedCollection(host, 'rows', () => order.push('inner'));
      writeNormalizedOwnedCollection(host, 'other', () => order.push('other'));
    });
    writeNormalizedOwnedCollection(host, 'rows', () => order.push('again'));
    expect(order).to.deep.equal(['outer', 'inner', 'other', 'again']);
    expect(() => writeNormalizedOwnedCollection(host, 'rows', () => { throw new Error('boom'); })).to.throw('boom');
    writeNormalizedOwnedCollection(host, 'rows', () => order.push('after'));
    expect(order.at(-1)).to.equal('after');
  });
});
