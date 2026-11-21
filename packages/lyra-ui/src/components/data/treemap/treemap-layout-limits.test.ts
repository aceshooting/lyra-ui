import { expect } from '@open-wc/testing';
import { layoutTreemap, type LyraTreemapNode, type TreemapOmission } from './treemap-layout.js';

describe('treemap layout limits', () => {
  it('stops descending past the depth ceiling and reports the input omission', () => {
    let node: LyraTreemapNode = { id: 'leaf', label: 'leaf', value: 1 };
    for (let depth = 0; depth < 70; depth++) node = { id: 'n' + depth, label: 'n', children: [node] } as LyraTreemapNode;
    const reasons: TreemapOmission[] = [];
    const rects = layoutTreemap([node], 100, 100, reason => reasons.push(reason));
    expect(reasons).to.include('input');
    expect(rects.length).to.equal(0);
  });

  it('keeps zero-size entries for tiles too small to draw', () => {
    const nodes: LyraTreemapNode[] = [
      { id: 'big', label: 'big', value: 1e12 },
      { id: 'tiny', label: 'tiny', value: 1 },
      { id: 'group', label: 'group', children: [{ id: 'g1', label: 'g1', value: 1 }] } as LyraTreemapNode,
    ];
    const reasons: TreemapOmission[] = [];
    const rects = layoutTreemap(nodes, 1e-320, 1e-320, reason => reasons.push(reason));
    expect(rects.map(rect => rect.id).sort()).to.deep.equal(['big', 'g1', 'group', 'tiny']);
    expect(reasons).to.include('size');
    expect(rects.filter(rect => rect.width === 0).length).to.be.greaterThan(0);
  });

  it('returns nothing for an invalid frame or a non-array input', () => {
    expect(layoutTreemap([{ id: 'a', label: 'a', value: 1 }], 0, 10)).to.deep.equal([]);
    expect(layoutTreemap('x' as unknown as LyraTreemapNode[], 10, 10)).to.deep.equal([]);
  });
});
