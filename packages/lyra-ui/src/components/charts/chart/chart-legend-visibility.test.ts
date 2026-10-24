import { expect } from '@open-wc/testing';
import { legendVisibilityDetail, normalizeHiddenDatasets } from './chart-legend-visibility.js';

describe('chart legend visibility snapshots', () => {
  it('leaves an unset list distinct from an explicitly empty one', () => {
    expect(normalizeHiddenDatasets(undefined, 3)).to.equal(undefined);
    expect(normalizeHiddenDatasets([], 3)).to.deep.equal([]);
  });

  it('keeps unique in-range integer indexes in ascending order', () => {
    expect(normalizeHiddenDatasets([2, 0, 2, 5, -1, 1.5, Number.NaN], 3)).to.deep.equal([0, 2]);
    expect(normalizeHiddenDatasets([0, 1, 2], 2.9)).to.deep.equal([0, 1]);
  });

  it('hides nothing when the dataset count is not a finite number', () => {
    for (const count of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -4]) {
      expect(normalizeHiddenDatasets([0, 1], count), String(count)).to.deep.equal([]);
    }
  });

  it('treats a list that is not an array as hiding nothing', () => {
    expect(normalizeHiddenDatasets('0' as unknown as readonly number[], 3)).to.deep.equal([]);
    expect(normalizeHiddenDatasets({ 0: 1, length: 1 } as unknown as readonly number[], 3)).to.deep.equal([]);
  });

  it('copies the hidden list into an event detail a listener cannot use to mutate state', () => {
    const hidden = [0, 2];
    const detail = legendVisibilityDetail(1, false, hidden);
    expect(detail).to.deep.equal({ datasetIndex: 1, visible: false, hiddenDatasets: [0, 2] });
    (detail.hiddenDatasets as number[]).push(9);
    expect(hidden).to.deep.equal([0, 2]);
  });
});
