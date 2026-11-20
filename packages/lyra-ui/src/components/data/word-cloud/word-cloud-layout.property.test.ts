import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { layoutWordCloud, MAX_WORDS, type WordCloudWord } from './word-cloud-layout.js';

const word = fc.record({
  text: fc.string({ minLength: 0, maxLength: 12 }),
  weight: fc.oneof(fc.double({ min: -50, max: 1000, noNaN: true }), fc.constantFrom(Number.NaN, Infinity, -Infinity)),
});
const words = fc.array(word, { maxLength: 60 });
const sizes = fc.record({ min: fc.integer({ min: 1, max: 20 }), extra: fc.integer({ min: 0, max: 60 }) });
const measureText = (text: string, fontSize: number): number => text.length * fontSize * 0.6;

function layout(input: readonly WordCloudWord[], size: { min: number; extra: number }, scale: 'linear' | 'sqrt' = 'linear') {
  return layoutWordCloud(input, {
    minFontSize: size.min,
    maxFontSize: size.min + size.extra,
    scale,
    wordRotation: 'none',
    measureText,
    random: () => 0.5,
  });
}

describe('word cloud layout properties', () => {
  it('accounts for every input word exactly once and bounds the placed count', () => {
    fc.assert(fc.property(words, sizes, (input, size) => {
      const result = layout(input, size);
      expect(result.placed.length + result.skippedCount, 'placed + skipped = input').to.equal(input.length);
      expect(result.placed.length <= MAX_WORDS).to.equal(true);
      expect(new Set(result.placed.map((placed) => placed.originalIndex)).size, 'unique source indexes').to.equal(result.placed.length);
    }), propertyRuns());
  });

  it('keeps every font size inside the configured bounds, ordered by weight', () => {
    fc.assert(fc.property(words, sizes, fc.constantFrom('linear', 'sqrt'), (input, size, scale) => {
      const result = layout(input, size, scale);
      for (const placed of result.placed) {
        expect(placed.fontSize >= size.min - 1e-9 && placed.fontSize <= size.min + size.extra + 1e-9, 'font size in bounds').to.equal(true);
        expect(Number.isFinite(placed.x) && Number.isFinite(placed.y), 'finite position').to.equal(true);
      }
      for (let position = 1; position < result.placed.length; position++) {
        expect(result.placed[position]!.fontSize <= result.placed[position - 1]!.fontSize + 1e-9, 'heavier words are never smaller').to.equal(true);
      }
    }), propertyRuns());
  });

  it('never overlaps two placed words and reports a box that contains them', () => {
    fc.assert(fc.property(words, sizes, (input, size) => {
      const { placed, width, height } = layout(input, size);
      for (let a = 0; a < placed.length; a++) {
        const first = placed[a]!;
        expect(first.x - first.width / 2 >= -1e-9 && first.x + first.width / 2 <= width + 1e-9, 'inside width').to.equal(true);
        expect(first.y - first.height / 2 >= -1e-9 && first.y + first.height / 2 <= height + 1e-9, 'inside height').to.equal(true);
        for (let b = a + 1; b < placed.length; b++) {
          const second = placed[b]!;
          const overlapX = Math.abs(first.x - second.x) < (first.width + second.width) / 2;
          const overlapY = Math.abs(first.y - second.y) < (first.height + second.height) / 2;
          expect(overlapX && overlapY, `words ${a} and ${b} overlap`).to.equal(false);
        }
      }
    }), propertyRuns(60));
  });
});
