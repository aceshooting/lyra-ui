import { expect } from '@open-wc/testing';
import { spatialCoordinate, spatialOriginal, spatialPaintRadius, spatialCsv } from './chart-spatial-data.js';

const largest = Number.MAX_VALUE;

describe('spatial chart geometry and export', () => {
  it('maps extreme finite coordinates without overflowing and round-trips original values', () => {
    for (const value of [-largest, -largest / 2, 0, largest / 2, largest]) {
      const normalized = spatialCoordinate(value, -largest, largest);
      expect(normalized).to.equal((value / largest + 1) / 2);
      expect(spatialOriginal(normalized, -largest, largest)).to.equal(value);
    }
  });

  it('preserves narrow, subnormal, and collapsed domains', () => {
    for (const [min, max] of [[1, 1 + Number.EPSILON], [0, Number.MIN_VALUE], [-largest, -largest / 2]]) {
      expect(spatialCoordinate(min!, min!, max!)).to.equal(0);
      expect(spatialCoordinate(max!, min!, max!)).to.equal(1);
      expect(spatialOriginal(0, min!, max!)).to.equal(min);
      expect(spatialOriginal(1, min!, max!)).to.equal(max);
    }
    expect(spatialCoordinate(largest, largest, largest)).to.equal(0.5);
    expect(spatialOriginal(0.5, largest, largest)).to.equal(largest);
  });

  it('rejects invalid geometry instead of passing nonfinite coordinates to a renderer', () => {
    for (const args of [[NaN, 0, 1], [0, -Infinity, 1], [0, 1, -1], [2, 0, 1]]) {
      expect(() => spatialCoordinate(args[0]!, args[1]!, args[2]!)).to.throw(RangeError);
    }
    expect(() => spatialOriginal(Infinity, 0, 1)).to.throw(RangeError);
    expect(() => spatialOriginal(-0.1, 0, 1)).to.throw(RangeError);
  });

  it('clamps only paint radius to a finite plot diagonal', () => {
    expect(spatialPaintRadius(largest, 300, 400)).to.equal(500);
    expect(spatialPaintRadius(10, 300, 400)).to.equal(10);
    expect(spatialPaintRadius(largest, largest, largest)).to.equal(largest);
    expect(spatialPaintRadius(10, 0, 0)).to.equal(0);
    expect(() => spatialPaintRadius(-1, 300, 400)).to.throw(RangeError);
    expect(() => spatialPaintRadius(1, Infinity, 400)).to.throw(RangeError);
  });

  it('exports separate original points and density rows with formula-safe text', () => {
    const series = [{ id: '=series', label: '@Series' }];
    const point = { seriesId: '=series', id: '+id', sourceIndex: 999999, label: 'a,"b"', x: -largest, y: largest, radius: largest };
    const bin = { bounds: { minX: -largest, maxX: largest, minY: 0, maxY: 1 }, count: 1000000 };
    const lines = spatialCsv(series, [point], [bin]).split('\r\n');
    expect(lines[0]).to.equal('kind,seriesId,seriesLabel,id,sourceIndex,label,x,y,radius,minX,maxX,minY,maxY,count');
    expect(lines[1]).to.equal(`point,'=series,'@Series,'+id,999999,"a,""b""",${-largest},${largest},${largest},,,,,`);
    expect(lines[2]).to.equal(`bin,,,,,,,,,${-largest},${largest},0,1,1000000`);
    expect(point.radius).to.equal(largest);
  });

  it('formats numeric cells with original records before safe CSV escaping', () => {
    const point = { seriesId: 's', id: 'p', sourceIndex: 10, x: -2, y: 3, radius: 4 };
    const seen: string[] = [];
    const csv = spatialCsv([{ id: 's', label: 'Series' }], [point], [], (value, record, column) => {
      expect(record === point).to.equal(true);
      seen.push(column);
      return column === 'x' ? `=${value}` : undefined;
    });
    expect(csv.split('\r\n')[1]).to.equal("point,s,Series,p,10,,'=-2,3,4,,,,,");
    expect(seen).to.deep.equal(['sourceIndex', 'x', 'y', 'radius']);
  });

  it('keeps absent radius and point count empty and refuses oversized exports', () => {
    const point = { seriesId: 's', id: 'p', sourceIndex: 0, x: 0, y: 0 };
    expect(spatialCsv([{ id: 's', label: '' }], [point], []).split('\r\n')[1])
      .to.equal('point,s,,p,0,,0,0,,,,,,');
    expect(() => spatialCsv([{ id: 's', label: '' }], Array(1001).fill(point), [])).to.throw(RangeError);
  });
});
