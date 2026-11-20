import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { layoutChord } from './chord-layout.js';

const entities = ['a', 'b', 'c'].map(id => ({ id, label: id }));
const length = (start: number, end: number) => end - start;

describe('chord layout', () => {
  it('partitions each weighted arc among unique unordered relationships', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 6, maxLength: 6 }), weights => {
      const [a, b, c, d, e, f] = weights as [number, number, number, number, number, number];
      const matrix = [[a, b, c], [b, d, e], [c, e, f]];
      const result = layoutChord(entities, matrix);
      expect(result.status).to.equal('ready');
      expect(result.truncated).to.equal(false);
      expect(result.arcs.map(arc => arc.id)).to.deep.equal(['a', 'b', 'c']);
      expect(result.ribbons.length).to.equal(6);
      expect(new Set(result.ribbons.map(r => [r.sourceIndex, r.targetIndex].join(','))).size).to.equal(6);
      const totals = matrix.map(row => row.reduce((sum, v) => sum + v, 0));
      const first = result.arcs[0]!;
      const scale = length(first.startAngle, first.endAngle) / totals[0]!;
      for (const arc of result.arcs) {
        expect(arc.value).to.equal(totals[arc.index]);
        expect(length(arc.startAngle, arc.endAngle)).to.be.closeTo(scale * arc.value, 1e-10);
        const spans: [number, number][] = [];
        for (const r of result.ribbons) {
          expect(r.sourceIndex).to.be.at.most(r.targetIndex);
          if (r.source === arc.id) spans.push([r.sourceStartAngle, r.sourceEndAngle]);
          if (r.target === arc.id) spans.push([r.targetStartAngle, r.targetEndAngle]);
        }
        spans.sort((l, r) => l[0] - r[0]);
        expect(spans[0]![0]).to.be.closeTo(arc.startAngle, 1e-10);
        for (let i = 1; i < spans.length; i++) expect(spans[i]![0]).to.be.closeTo(spans[i - 1]![1], 1e-10);
        expect(spans.at(-1)![1]).to.be.closeTo(arc.endAngle, 1e-10);
      }
    }), propertyRuns());
  });

  it('renders one diagonal relationship with two equal adjacent ends and no zero-weight arcs', () => {
    const result = layoutChord(entities, [[0, 0, 0], [0, 4, 0], [0, 0, 0]]);
    expect(result.arcs.map(a => a.id)).to.deep.equal(['b']);
    const self = result.ribbons[0]!;
    expect(self.sourceEndAngle).to.equal(self.targetStartAngle);
    expect(self.sourceEndAngle - self.sourceStartAngle).to.be.closeTo(self.targetEndAngle - self.targetStartAngle, 1e-10);
    expect(layoutChord(entities.slice(0, 1), [[0]]).status).to.equal('empty');
  });

  it('rejects malformed matrices, duplicate IDs, and getters without reading source accessors', () => {
    const pair = entities.slice(0, 2);
    for (const matrix of [[[0, 1], [2, 0]], [[0], [0]], [[0, -1], [-1, 0]], [[0, Infinity], [Infinity, 0]]]) {
      expect(layoutChord(pair, matrix).status).to.equal('invalid');
    }
    const row = [0, 1];
    Object.defineProperty(row, 1, { get() { throw Error(); } });
    expect(layoutChord(pair, [row, [1, 0]]).status).to.equal('invalid');
    expect(layoutChord([pair[0]!, pair[0]!], [[0, 0], [0, 0]]).status).to.equal('invalid');
    expect(layoutChord(Array(33).fill(pair[0]!), []).status).to.equal('limit');
  });

  it('keeps extreme weights finite and reports unrepresentable endpoints', () => {
    const max = Number.MAX_VALUE;
    const tiny = Number.MIN_VALUE;
    const result = layoutChord(entities, [[max, max, 0], [max, tiny, 0], [0, 0, tiny]]);
    expect(result.status).to.equal('ready');
    expect(result.truncated).to.equal(true);
    expect(result.arcs[0]!.value).to.equal(max);
    for (const datum of [...result.arcs, ...result.ribbons]) {
      expect(Object.values(datum).filter(v => typeof v === 'number').every(Number.isFinite)).to.equal(true);
    }
  });
});
