import { expect } from '@open-wc/testing';
import { EmbeddingRows, type EmbeddingPoint } from './embedding-explorer-data.js';
import type { LyraPointColumns } from '../../../internal/typed-columns.js';

describe('EmbeddingRows', () => {
  const points: EmbeddingPoint[] = [
    { id: 'b', x: 1, y: 1, cluster: 'beta' },
    { id: 'a', x: 2, y: 3, cluster: 'alpha' },
    { id: 'loose', x: 3, y: 5 },
  ];

  it('reads ordinary points by position and reports a bad index as absent', () => {
    const rows = new EmbeddingRows(null, points);

    expect(rows.count).to.equal(3);
    expect(rows.point(1)?.id).to.equal('a');
    for (const index of [-1, 3, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(rows.point(index), String(index)).to.equal(undefined);
    }
    expect(rows.indices.get('loose')).to.equal(2);
    expect(rows.bounds).to.deep.equal({ minX: 1, maxX: 3, minY: 1, maxY: 5 });
  });

  it('numbers ordinary points by sorted cluster and puts an unclustered point in the unnamed bucket', () => {
    const rows = new EmbeddingRows(null, points);

    expect(rows.clusters).to.deep.equal(['', 'alpha', 'beta']);
    expect([0, 1, 2].map((index) => rows.category(index))).to.deep.equal([2, 1, 0]);
    expect(rows.category(99), 'a row beyond the data reads as the unnamed bucket').to.equal(0);
  });

  it('serves typed-column rows with their label, depth and cluster name when those columns exist', () => {
    const columns: LyraPointColumns = {
      ids: ['p0', 'p1'],
      x: new Float32Array([0, 4]),
      y: new Float32Array([0, 2]),
      z: new Float32Array([1, 3]),
      cluster: new Uint16Array([1, 0]),
      clusters: ['north', 'south'],
      labels: ['First', 'Second'],
    };
    const rows = new EmbeddingRows(columns);

    expect(rows.point(0)).to.deep.equal({ id: 'p0', x: 0, y: 0, z: 1, label: 'First', cluster: 'south' });
    expect(rows.point(1)).to.deep.equal({ id: 'p1', x: 4, y: 2, z: 3, label: 'Second', cluster: 'north' });
    expect(rows.category(0)).to.equal(1);
    expect(rows.data().mode).to.equal('3d');
  });

  it('omits the optional label, depth and cluster of typed-column rows that lack those columns', () => {
    const rows = new EmbeddingRows({ ids: ['only'], x: new Float32Array([5]), y: new Float32Array([6]) });

    expect(rows.point(0)).to.deep.equal({ id: 'only', x: 5, y: 6 });
    expect(rows.category(0)).to.equal(0);
    expect(rows.data().mode).to.equal('2d');
    expect(rows.point(1)).to.equal(undefined);
  });
});
