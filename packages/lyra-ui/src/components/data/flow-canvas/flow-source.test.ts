import { expect } from '@open-wc/testing';
import { SceneReader } from '../../../internal/graph-scene-controller.js';
import { flowSourceRows } from './flow-source.js';

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
