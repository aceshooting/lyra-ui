import { expect } from '@open-wc/testing';
import { SceneReader } from '../../../internal/graph-scene-controller.js';
import { flowSourceOverview, flowSourceRows } from './flow-source.js';

const reader = (): SceneReader => new SceneReader(() => true);

describe('flowSourceRows', () => {
  it('accepts node and edge records whose key names their kind and id', () => {
    const rows = flowSourceRows(
      [
        { key: 'node:a', order: 0, value: { kind: 'node', value: { id: 'a', data: { label: 'Alpha' } } } },
        { key: 'edge:ab', order: 1, value: { kind: 'edge', value: { id: 'ab', source: 'a', target: 'b' } } },
      ],
      10,
      reader(),
    );
    expect(rows.map((row) => row.key)).to.deep.equal(['node:a', 'edge:ab']);
    expect(rows.map((row) => row.value.kind)).to.deep.equal(['node', 'edge']);
  });

  it('rejects a key that does not name the record kind and id', () => {
    const mismatched = [{ key: 'edge:a', order: 0, value: { kind: 'node', value: { id: 'a' } } }];
    expect(() => flowSourceRows(mismatched, 10, reader())).to.throw(TypeError, 'Invalid flow record identity');
  });

  it('rejects a non-string kind without converting it to a string', () => {
    let conversions = 0;
    const kind = {
      toString: () => { conversions += 1; return 'node'; },
      [Symbol.toPrimitive]: () => { conversions += 1; return 'node'; },
    };
    const hostile = [{ key: 'node:a', order: 0, value: { kind, value: { id: 'a' } } }];
    expect(() => flowSourceRows(hostile, 10, reader())).to.throw(TypeError);
    expect(conversions, 'hostile conversion hooks must never run').to.equal(0);
  });
});

describe('flowSourceRows records', () => {
  it('keeps a node disabled flag', () => {
    const rows = flowSourceRows([{ key: 'node:a', order: 0, value: { kind: 'node', value: { id: 'a', disabled: true } } }], 10, reader());
    expect(rows[0]!.value).to.deep.equal({ kind: 'node', value: { id: 'a', disabled: true } });
  });

  it('rejects a kind that merely begins with a known prefix', () => {
    const lookalike = [{ key: 'node:a:b', order: 0, value: { kind: 'node:a', value: { id: 'b' } } }];
    expect(() => flowSourceRows(lookalike, 10, reader())).to.throw(TypeError, 'Invalid flow record kind');
  });

  it('rejects an edge whose source or target is blank', () => {
    for (const [source, target] of [['   ', 'b'], ['a', '   ']]) {
      const edge = [{ key: 'edge:e', order: 0, value: { kind: 'edge', value: { id: 'e', source, target } } }];
      expect(() => flowSourceRows(edge, 10, reader()), `${source}|${target}`).to.throw(TypeError, 'Invalid flow endpoint');
    }
  });
});

describe('flowSourceOverview bins', () => {
  const world = { x: 0, y: 0, width: 10, height: 10 };
  const overview = (bins: unknown[]) => ({ bounds: world, bins });

  it('accepts bins that tile the extent and sum to the population', () => {
    const accepted = flowSourceOverview(overview([
      { bounds: { x: 0, y: 0, width: 5, height: 10 }, count: 2 },
      { bounds: { x: 5, y: 0, width: 5, height: 10 }, count: 3 },
    ]), world, 5, () => true);
    expect(accepted.bins.map((bin) => bin.count)).to.deep.equal([2, 3]);
  });

  it('rejects a bin that collapses an axis the extent spans', () => {
    const thin = [{ x: 0, y: 0, width: 0, height: 10 }, { x: 0, y: 0, width: 10, height: 0 }];
    for (const bounds of thin) {
      expect(() => flowSourceOverview(overview([{ bounds, count: 1 }]), world, 1, () => true), JSON.stringify(bounds))
        .to.throw(RangeError, 'Invalid flow overview bin');
    }
  });
});
