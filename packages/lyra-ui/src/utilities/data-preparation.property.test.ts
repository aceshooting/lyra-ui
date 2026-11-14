import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { prepareLyraWordCloud } from './data-preparation.js';

describe('data preparation properties', () => {
  it('matches stable full sorting for top-K words regardless of read batch boundaries', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(fc.integer({ min: -3, max: 20 }), { maxLength: 96 }),
      fc.integer({ min: 1, max: 40 }),
      fc.integer({ min: 1, max: 17 }),
      async (weights, maxWords, batchSize) => {
        const words = weights.map((weight, index) => ({ id: `word-${index}`, text: `Word ${index}`, weight }));
        const readIndices: number[] = [];
        const result = await prepareLyraWordCloud({
          revision: 'snapshot', count: words.length,
          read: (start, count) => {
            expect(count).to.be.at.least(1).and.at.most(batchSize);
            readIndices.push(...Array.from({ length: count }, (_, index) => start + index));
            return words.slice(start, start + count);
          },
        }, { maxWords, batchSize });
        const valid = words.filter(word => word.weight >= 0);
        const expected = [...valid].sort((a, b) => b.weight - a.weight).slice(0, maxWords);
        expect(result.words).to.deep.equal(expected);
        expect(result.counts).to.deep.equal({ sourceCount: words.length, validCount: valid.length,
          invalidCount: words.length - valid.length });
        expect(result.totalWeight).to.equal(valid.reduce((total, word) => total + word.weight, 0));
        expect(result.retainedWeight).to.equal(expected.reduce((total, word) => total + word.weight, 0));
        expect(readIndices).to.deep.equal(weights.map((_, index) => index));
        expect(Object.isFrozen(result.words)).to.equal(true);
        expect(result.words.every(Object.isFrozen)).to.equal(true);
      },
    ), propertyRuns());
  });
});
