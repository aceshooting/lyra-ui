import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { projectLyraSpans } from './span-projection.js';
import type { LyraSpan } from './span.js';

const span = (id: string, startMs = 0) => ({ id, name: id, kind: 'tool', status: 'success', startMs });

describe('trace span projection lookup contracts', () => {
  it('provides every empty read-only iteration operation without invoking callbacks', () => {
    const lookup = projectLyraSpans([]).byId;
    let calls = 0;
    lookup.forEach(() => calls++);
    expect(calls).to.equal(0);
    expect(lookup.size).to.equal(0);
    expect([...lookup.entries()]).to.deep.equal([]);
    expect([...lookup.values()]).to.deep.equal([]);
    expect([...lookup.keys()]).to.deep.equal([]);
    expect([...lookup]).to.deep.equal([]);
    expect(lookup.has('missing')).to.equal(false);
    expect(lookup.get('missing')).to.equal(undefined);
  });

  it('forwards the callback receiver and the protected lookup rather than its mutable backing map', () => {
    const projection = projectLyraSpans([span('z'), span('a'), span('z', 7), span('outside')], null, 2);
    const lookup = projection.byId;
    const receiver = { calls: [] as string[] };
    lookup.forEach(function (this: typeof receiver, value, key, map) {
      expect(this === receiver).to.equal(true);
      expect(map === lookup).to.equal(true);
      expect(map.get(key) === value).to.equal(true);
      expect(Object.isFrozen(value)).to.equal(true);
      expect(Reflect.get(map, 'set')).to.equal(undefined);
      expect(Reflect.get(map, 'delete')).to.equal(undefined);
      expect(Reflect.get(map, 'clear')).to.equal(undefined);
      expect(Reflect.set(map, 'replacement', true)).to.equal(false);
      this.calls.push(key);
    }, receiver);
    expect(receiver.calls).to.deep.equal(['z', 'a']);
    expect(lookup.size).to.equal(2);
    expect(Object.isFrozen(lookup)).to.equal(true);
  });

  it('retains its iteration when a callback creates another projection of the same source', () => {
    const source = Object.freeze([span('first'), span('second'), span('active')]);
    const first = projectLyraSpans(source, null, 2);
    const visits: string[] = [];
    first.byId.forEach((value, key) => {
      visits.push(key);
      const nested = projectLyraSpans(source, 'active', 1);
      expect([...nested.byId.keys()]).to.deep.equal(['active']);
      expect(first.byId.get(key) === value).to.equal(true);
    });
    expect(visits).to.deep.equal(['first', 'second']);
    expect([...first.byId.values()].map(value => value.id)).to.deep.equal(['first', 'second']);
    expect(first.byId.size).to.equal(2);
  });

  it('propagates a callback failure and leaves later reads and iterations intact', () => {
    const lookup = projectLyraSpans([span('one'), span('two')]).byId;
    const visited: string[] = [];
    expect(() => lookup.forEach((_value, key) => {
      visited.push(key);
      throw new Error('Consumer callback failed');
    })).to.throw('Consumer callback failed');
    expect(visited).to.deep.equal(['one']);
    const remaining: string[] = [];
    lookup.forEach(value => remaining.push(value.id));
    expect(remaining).to.deep.equal(['one', 'two']);
  });

  it('matches first-occurrence input order and row bounds across every lookup traversal', () => {
    fc.assert(fc.property(
      fc.array(fc.record({ id: fc.integer({ min: 0, max: 40 }), startMs: fc.integer({ min: 0, max: 100_000 }) }), { maxLength: 60 }),
      fc.integer({ min: 1, max: 30 }),
      (records, limit) => {
        const input = records.map(record => span(String(record.id), record.startMs));
        const expected = input.filter((value, index) => input.findIndex(other => other.id === value.id) === index).slice(0, limit);
        const projection = projectLyraSpans(input, null, limit);
        const lookup = projection.byId;
        const visited: [string, LyraSpan][] = [];
        lookup.forEach((value, key, map) => {
          expect(map === lookup).to.equal(true);
          visited.push([key, value]);
        });
        expect(lookup.size).to.equal(expected.length);
        expect([...lookup.keys()]).to.deep.equal(expected.map(value => value.id));
        expect([...lookup.values()].map(value => value.startMs)).to.deep.equal(expected.map(value => value.startMs));
        expect([...lookup.entries()]).to.deep.equal(visited);
        expect([...lookup]).to.deep.equal(visited);
        expect(projection.spans).to.deep.equal(visited.map(([, value]) => value));
        expect(visited.every(([key, value]) => lookup.has(key) && lookup.get(key) === value)).to.equal(true);
      },
    ), propertyRuns());
  });
});
