import { expect } from '@open-wc/testing';
import { regionHighlightLabel, sameRegionRect } from './region-highlight-layer.js';

describe('region highlight helpers', () => {
  const rect = { x: 1, y: 2, width: 3, height: 4 };

  it('compares region anchors by page and every rect edge', () => {
    expect(sameRegionRect({ rect }, { rect: { ...rect } })).to.equal(true);
    expect(sameRegionRect({ page: 1, rect }, { rect })).to.equal(false);
    expect(sameRegionRect({ rect }, { rect: { ...rect, height: 5 } })).to.equal(false);
  });

  it('names an action by its label, else by its position among the highlights', () => {
    const calls: Array<[string, Record<string, string>]> = [];
    const localize = (key: 'highlightWithLabel' | 'highlightOfTotal', values: Record<string, string>): string => {
      calls.push([key, values]);
      return key;
    };
    expect(regionHighlightLabel({ label: 'Result' }, 0, 2, 'en', localize)).to.equal('highlightWithLabel');
    expect(regionHighlightLabel({}, 1, 12, 'en', localize)).to.equal('highlightOfTotal');
    expect(calls).to.deep.equal([
      ['highlightWithLabel', { label: 'Result' }],
      ['highlightOfTotal', { index: '2', total: '12' }],
    ]);
  });
});
