import { expect } from '@open-wc/testing';
import { snapshotLyraHighlights } from './highlight-collection.js';

describe('snapshotLyraHighlights', () => {
  it('copies only its display schema through own data descriptors while retaining anchor identity', () => {
    const anchor = { kind: 'region' as const, rect: { x: 10, y: 20, width: 30, height: 40 } };
    let opaqueGetterCalls = 0;
    const source = Object.defineProperties(
      {
        id: ' finding ',
        anchor,
        label: 'Finding',
        note: 'Caller-owned provenance',
        tone: 'warning',
      },
      {
        opaque: {
          enumerable: true,
          get() {
            opaqueGetterCalls += 1;
            throw new Error('an opaque extension must not be read');
          },
        },
      },
    );

    const snapshot = snapshotLyraHighlights([source]);

    expect(snapshot).to.have.length(1);
    expect(snapshot[0]!.id).to.equal('finding');
    expect(snapshot[0]!.label).to.equal('Finding');
    expect(snapshot[0]!.note).to.equal('Caller-owned provenance');
    expect(snapshot[0]!.tone).to.equal('warning');
    expect(snapshot[0]!.anchor === anchor).to.equal(true);
    expect('opaque' in snapshot[0]!).to.equal(false);
    expect(opaqueGetterCalls).to.equal(0);
  });

  it('skips hostile own accessors and index traps without losing a later valid sibling', () => {
    let recordGetterCalls = 0;
    let indexGetterCalls = 0;
    const accessorBacked = Object.defineProperties(
      { anchor: { kind: 'page' as const, page: 1 } },
      {
        id: {
          enumerable: true,
          get() {
            recordGetterCalls += 1;
            throw new Error('id accessor must not run');
          },
        },
      },
    );
    const values: unknown[] = [accessorBacked, { id: 'later', anchor: { kind: 'page' as const, page: 2 } }];
    Object.defineProperty(values, '0', {
      configurable: true,
      enumerable: true,
      get() {
        indexGetterCalls += 1;
        return accessorBacked;
      },
    });

    const snapshot = snapshotLyraHighlights(values);

    expect(snapshot.map((highlight) => highlight.id)).to.deep.equal(['later']);
    expect(recordGetterCalls).to.equal(0);
    expect(indexGetterCalls).to.equal(0);
  });

  it('reads a legacy computed id once while retaining only its returned string', () => {
    let idReads = 0;
    const anchor = { kind: 'page' as const, page: 1 };
    const source = {
      get id() {
        idReads += 1;
        return 'computed-id';
      },
      anchor,
    };

    const snapshot = snapshotLyraHighlights([source]);

    expect(snapshot.map((highlight) => highlight.id)).to.deep.equal(['computed-id']);
    expect(snapshot[0]!.anchor === anchor).to.equal(true);
    expect(idReads).to.equal(1);
  });

  it('contains a throwing computed id and keeps a later valid sibling', () => {
    let idReads = 0;
    const hostile = {
      get id() {
        idReads += 1;
        throw new Error('computed id failed');
      },
      anchor: { kind: 'page' as const, page: 1 },
    };

    const snapshot = snapshotLyraHighlights([
      hostile,
      { id: 'later', anchor: { kind: 'page' as const, page: 2 } },
    ]);

    expect(snapshot.map((highlight) => highlight.id)).to.deep.equal(['later']);
    expect(idReads).to.equal(1);
  });

  it('contains descriptor-reflection failures at the collection boundary', () => {
    const hostile = new Proxy([], {
      get(_target, property) {
        if (property === 'length') throw new Error('property access must not run');
        return undefined;
      },
      getOwnPropertyDescriptor() {
        throw new Error('descriptor reflection failed');
      },
    });

    expect(() => snapshotLyraHighlights(hostile)).not.to.throw();
    expect(snapshotLyraHighlights(hostile)).to.deep.equal([]);
  });
});
