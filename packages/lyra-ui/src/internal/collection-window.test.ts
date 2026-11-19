import { expect } from '@open-wc/testing';
import { newestCollectionWindow } from './collection-window.js';

describe('newestCollectionWindow', () => {
  it('keeps the newest entries and reports the omitted count', () => {
    const items = [1, 2, 3, 4, 5];
    expect(newestCollectionWindow(items, 2)).to.deep.equal({ items: [4, 5], omitted: 3 });
    expect(newestCollectionWindow(items, 2.9)).to.deep.equal({ items: [4, 5], omitted: 3 });
  });

  it('returns the input itself when unlimited or already within the cap', () => {
    const items = [1, 2, 3];
    for (const max of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 3, 10]) {
      const result = newestCollectionWindow(items, max);
      expect(result.items === items).to.equal(true);
      expect(result.omitted).to.equal(0);
    }
  });
});
