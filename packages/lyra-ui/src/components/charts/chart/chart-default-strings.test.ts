import { expect } from '@open-wc/testing';
import { LyraChart } from './chart.class.js';
import { LyraBarChart } from './bar-chart.class.js';
import { LyraHistogram } from './histogram.class.js';

type WithStrings = { defaultStrings: Readonly<Record<string, string>> };

describe('chart default-string slices', () => {
  for (const [name, ctor] of [['lr-chart', LyraChart], ['lr-bar-chart', LyraBarChart], ['lr-histogram', LyraHistogram]] as const) {
    it(`${name} carries no generic collapse/details/navigation strings it never renders`, () => {
      const keys = Object.keys((ctor as unknown as WithStrings).defaultStrings);
      expect(keys.filter((key) => ['collapse', 'details', 'navigation'].includes(key))).to.deep.equal([]);
      expect(keys.includes('chart')).to.equal(true);
    });
  }
});
