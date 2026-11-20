import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { layoutTreemap, type LyraTreemapNode } from './treemap-layout.js';

describe('treemap layout', () => {
  it('partitions branch area proportionally into disjoint rectangles', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 32 }), weights => {
      const children = weights.map((value, index) => ({ id: String(index), label: String(index), value }));
      const nodes = [{ id: 'root', label: 'Root', value: 1, children }];
      const tiles = layoutTreemap(nodes, 140, 100);
      expect(layoutTreemap(nodes, 140, 100)).to.deep.equal(tiles);
      expect(tiles).to.have.length(children.length + 1);
      const root = tiles[0]!;
      expect(root.value).to.equal(weights.reduce((a, b) => a + b, 0));
      for (const [i, tile] of tiles.slice(1).entries()) {
        expect(tile.parentId).to.equal(root.id);
        expect(tile.depth).to.equal(1);
        expect(tile.width * tile.height).to.be.closeTo(14000 * tile.value / root.value, 1e-7);
        expect(tile.x).to.be.at.least(0);
        expect(tile.y).to.be.at.least(0);
        expect(tile.x + tile.width).to.be.at.most(140 + 1e-8);
        expect(tile.y + tile.height).to.be.at.most(100 + 1e-8);
        for (const peer of tiles.slice(1, i + 1)) {
          const overlapX = Math.min(tile.x + tile.width, peer.x + peer.width) - Math.max(tile.x, peer.x);
          const overlapY = Math.min(tile.y + tile.height, peer.y + peer.height) - Math.max(tile.y, peer.y);
          expect(Math.min(overlapX, overlapY)).to.be.at.most(1e-8);
        }
      }
    }), propertyRuns());
  });

  it('tiles four equal weights as squares and ignores unusable values', () => {
    const nodes = [1, 1, 1, 1, 0, -1, NaN, Infinity].map((value, i) => ({ id: String(i), label: '', value }));
    const tiles = layoutTreemap(nodes);
    expect(tiles.map(t => [t.width, t.height])).to.deep.equal(Array(4).fill([0.5, 0.5]));
    expect(layoutTreemap(nodes, Infinity, 1)).to.deep.equal([]);
  });

  it('preserves sibling proportions when a branch sum overflows', () => {
    const leaf = (id: string) => ({ id, label: id, value: Number.MAX_VALUE });
    const tiles = layoutTreemap([{ id: 'group', label: '', children: [leaf('a'), leaf('b')] }, leaf('c')]);
    const branch = tiles[0]!;
    expect(branch.value).to.equal(Number.MAX_VALUE);
    expect(branch.width * branch.height).to.be.closeTo(2 / 3, 1e-12);
    expect(tiles.map(t => t.parentId)).to.deep.equal([null, 'group', 'group', null]);
  });

  it('terminates cycles and keeps the first unique identity in traversal order', () => {
    const children: LyraTreemapNode[] = [];
    const root = { id: 'root', label: '', children };
    children.push(root, { id: 'leaf', label: 'First', value: 2 }, { id: 'leaf', label: 'Second', value: 3 });
    const tiles = layoutTreemap([root]);
    expect(tiles.map(t => [t.id, t.value, t.label])).to.deep.equal([['root', 2, ''], ['leaf', 2, 'First']]);
  });

  it('reports truncated deep branches once and preserves their siblings', () => {
    let tree: LyraTreemapNode = { id: 'leaf', label: '', value: 1 };
    for (let i = 0; i < 80; i++) tree = { id: String(i), label: '', children: [tree] };
    let calls = 0;
    const tiles = layoutTreemap([tree, { id: 'other', label: '', value: 1 }], 1, 1, () => { calls++; });
    expect(calls).to.equal(1);
    expect(tiles.map(tile => tile.id)).to.deep.equal(['other']);
  });

  it('reports omitted extreme ratios and emits representable or zero-size rectangles', () => {
    fc.assert(fc.property(fc.integer({ min: 20, max: 300 }), power => {
      const nodes = [1, 10 ** -power, Number.MIN_VALUE].map((value, i) => ({ id: String(i), label: '', value }));
      const reasons: string[] = [];
      const tiles = layoutTreemap(nodes, 1, 1, reason => reasons.push(reason));
      expect(reasons).to.deep.equal(['size']);
      expect(tiles.map(t => t.id).sort()).to.deep.equal(['0', '1', '2']);
      expect(tiles.some(t => t.width === 0 && t.height === 0)).to.equal(true);
      for (const t of tiles) {
        if (t.width === 0 && t.height === 0) continue;
        expect(t.x + t.width).to.be.greaterThan(t.x);
        expect(t.y + t.height).to.be.greaterThan(t.y);
      }
    }), propertyRuns());
  });

  it('releases the ID of a rejected node for a later valid node', () => {
    const nodes = [
      { id: 'a', label: 'Bad', value: -1 },
      { id: 'b', label: 'Empty', children: [{ id: 'a', label: 'Bad child', value: 0 }] },
      { id: 'a', label: 'Good', value: 2 },
      { id: 'b', label: 'Good leaf', value: 1 },
    ];
    expect(layoutTreemap(nodes).map(t => [t.id, t.label])).to.deep.equal([['a', 'Good'], ['b', 'Good leaf']]);
  });

  it('skips accessor-backed rows and fields without invoking their getters', () => {
    const nodes = [{ id: 'safe', label: '', value: 1 }, { get id(): string { throw Error(); }, label: '', value: 2 }];
    Object.defineProperty(nodes, 2, { get() { throw Error(); } });
    expect(layoutTreemap(nodes).map(tile => tile.id)).to.deep.equal(['safe']);
  });
});
