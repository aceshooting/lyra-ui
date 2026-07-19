import { expect } from '@open-wc/testing';
import {
  layoutWordCloud,
  GAP,
  MAX_FONT_SIZE_PX,
  MAX_SPIRAL_ITERATIONS,
  MAX_WORDS,
  type PlacedWord,
} from './word-cloud-layout.js';

/** Deterministic stand-in for canvas measureText: width scales with text length and font size. */
const stubMeasure = (text: string, fontSize: number): number => text.length * fontSize * 0.6;

function boxesOverlap(a: PlacedWord, b: PlacedWord): boolean {
  const aw = a.rotated ? a.height : a.width;
  const ah = a.rotated ? a.width : a.height;
  const bw = b.rotated ? b.height : b.width;
  const bh = b.rotated ? b.width : b.height;
  return Math.abs(a.x - b.x) < (aw + bw) / 2 && Math.abs(a.y - b.y) < (ah + bh) / 2;
}

const baseOptions = {
  minFontSize: 10,
  maxFontSize: 50,
  scale: 'linear' as const,
  orientations: 'horizontal' as const,
  measureText: stubMeasure,
};

it('returns an empty result for no words', () => {
  const result = layoutWordCloud([], baseOptions);
  expect(result.placed).to.deep.equal([]);
  expect(result.skipped).to.deep.equal([]);
  expect(result.width).to.equal(0);
  expect(result.height).to.equal(0);
});

it('centers a single word inside a bounding box padded by GAP around its own size', () => {
  const result = layoutWordCloud([{ text: 'hi', weight: 1 }], baseOptions);
  expect(result.placed).to.have.length(1);
  const w = result.placed[0]!;
  expect(result.width).to.be.closeTo(w.width + 2 * GAP, 0.01);
  expect(result.height).to.be.closeTo(w.height + 2 * GAP, 0.01);
  expect(w.x).to.be.closeTo(result.width / 2, 0.01);
  expect(w.y).to.be.closeTo(result.height / 2, 0.01);
});

it('scales font size linearly between minFontSize and maxFontSize by weight', () => {
  const result = layoutWordCloud(
    [
      { text: 'small', weight: 0 },
      { text: 'big', weight: 10 },
    ],
    baseOptions,
  );
  const small = result.placed.find((w) => w.text === 'small')!;
  const big = result.placed.find((w) => w.text === 'big')!;
  expect(small.fontSize).to.equal(10);
  expect(big.fontSize).to.equal(50);
});

it('sqrt scale compresses a low-weight word toward a larger font than linear would', () => {
  const words = [
    { text: 'min', weight: 0 },
    { text: 'quarter', weight: 25 },
    { text: 'max', weight: 100 },
  ];
  const linear = layoutWordCloud(words, { ...baseOptions, scale: 'linear' });
  const sqrt = layoutWordCloud(words, { ...baseOptions, scale: 'sqrt' });
  const quarterLinear = linear.placed.find((w) => w.text === 'quarter')!.fontSize;
  const quarterSqrt = sqrt.placed.find((w) => w.text === 'quarter')!.fontSize;
  expect(quarterSqrt).to.be.greaterThan(quarterLinear);
});

it('gives every word the same, minimum font size when all weights are equal', () => {
  const result = layoutWordCloud(
    [
      { text: 'a', weight: 5 },
      { text: 'b', weight: 5 },
      { text: 'c', weight: 5 },
    ],
    baseOptions,
  );
  for (const w of result.placed) expect(w.fontSize).to.equal(baseOptions.minFontSize);
});

it('clamps a negative or non-finite weight for font-size scaling, without changing the reported weight', () => {
  const result = layoutWordCloud(
    [
      { text: 'negative', weight: -5 },
      { text: 'nan', weight: Number.NaN },
      { text: 'normal', weight: 10 },
    ],
    baseOptions,
  );
  const negative = result.placed.find((w) => w.text === 'negative')!;
  const nan = result.placed.find((w) => w.text === 'nan')!;
  // The original weight is echoed back untouched -- callers (event detail, aria-label)
  // must see what they passed in, not an internal clamped value.
  expect(negative.weight).to.equal(-5);
  expect(nan.weight).to.be.NaN;
  expect(negative.fontSize).to.equal(baseOptions.minFontSize);
  expect(nan.fontSize).to.equal(baseOptions.minFontSize);
});

it('places no two words overlapping', () => {
  const words = Array.from({ length: 20 }, (_, i) => ({ text: `word-${i}`, weight: (i % 7) + 1 }));
  const result = layoutWordCloud(words, baseOptions);
  expect(result.placed).to.have.length(20);
  for (let i = 0; i < result.placed.length; i++) {
    for (let j = i + 1; j < result.placed.length; j++) {
      expect(boxesOverlap(result.placed[i]!, result.placed[j]!), `word ${i} and ${j} overlap`).to.be.false;
    }
  }
});

it('never rotates a word when orientations is "horizontal", even with a random() stub that always would', () => {
  const result = layoutWordCloud([{ text: 'a', weight: 1 }], {
    ...baseOptions,
    orientations: 'horizontal',
    random: () => 0,
  });
  expect(result.placed[0]!.rotated).to.equal(false);
});

it('rotates every word when orientations is "mixed" and random() always clears the threshold', () => {
  const words = Array.from({ length: 5 }, (_, i) => ({ text: `w${i}`, weight: i + 1 }));
  const result = layoutWordCloud(words, { ...baseOptions, orientations: 'mixed', random: () => 0 });
  expect(result.placed.every((w) => w.rotated)).to.be.true;
});

it('never rotates a word when orientations is "mixed" but random() never clears the threshold', () => {
  const words = Array.from({ length: 5 }, (_, i) => ({ text: `w${i}`, weight: i + 1 }));
  const result = layoutWordCloud(words, { ...baseOptions, orientations: 'mixed', random: () => 0.999 });
  expect(result.placed.every((w) => !w.rotated)).to.be.true;
});

it('caps placement at MAX_WORDS by weight, dropping the lightest words as skipped -- not just the tail of the array', () => {
  // Ascending weight: the 5 lightest words (w0..w4) are also the first 5 in the
  // array. A position-based cap would keep these and drop the last 5 (heaviest);
  // a weight-based cap must do the opposite.
  const words = Array.from({ length: MAX_WORDS + 5 }, (_, i) => ({ text: `w${i}`, weight: i }));
  const result = layoutWordCloud(words, baseOptions);
  expect(result.placed).to.have.length(MAX_WORDS);
  expect(result.skipped).to.have.length(5);
  const skippedTexts = result.skipped.map((w) => w.text).sort();
  expect(skippedTexts).to.deep.equal(['w0', 'w1', 'w2', 'w3', 'w4']);
  // The heaviest word, despite being last in the input, must survive.
  expect(result.placed.some((w) => w.text === `w${MAX_WORDS + 4}`)).to.be.true;
});

it('filters out blank/whitespace-only word text as skipped, not placed', () => {
  const result = layoutWordCloud(
    [
      { text: '', weight: 5 },
      { text: '   ', weight: 5 },
      { text: 'real', weight: 5 },
    ],
    baseOptions,
  );
  expect(result.placed).to.have.length(1);
  expect(result.placed[0]!.text).to.equal('real');
  expect(result.skipped).to.have.length(2);
});

it('retains the original array index on each placed word, independent of weight-sort order', () => {
  const words = [
    { text: 'lightest', weight: 1 },
    { text: 'heaviest', weight: 100 },
  ];
  const result = layoutWordCloud(words, baseOptions);
  expect(result.placed.find((w) => w.text === 'lightest')!.originalIndex).to.equal(0);
  expect(result.placed.find((w) => w.text === 'heaviest')!.originalIndex).to.equal(1);
});

it('clamps non-finite/negative minFontSize/maxFontSize to a sane positive default', () => {
  const { placed } = layoutWordCloud([{ text: 'a', weight: 1 }], {
    minFontSize: NaN,
    maxFontSize: -5,
    scale: 'linear',
    orientations: 'horizontal',
    measureText: stubMeasure,
  });
  expect(placed[0]!.fontSize).to.be.greaterThan(0);
  expect(Number.isFinite(placed[0]!.fontSize)).to.be.true;
});

it('swaps a reversed minFontSize/maxFontSize instead of inverting the weight-to-size mapping', () => {
  const { placed } = layoutWordCloud(
    [
      { text: 'small', weight: 1 },
      { text: 'big', weight: 10 },
    ],
    { minFontSize: 40, maxFontSize: 10, scale: 'linear', orientations: 'horizontal', measureText: stubMeasure },
  );
  const big = placed.find((p) => p.text === 'big')!;
  const small = placed.find((p) => p.text === 'small')!;
  expect(big.fontSize).to.be.greaterThan(small.fontSize);
});

it('clamps huge finite font-size bounds before measuring or placing words', () => {
  let measuredAt = 0;
  const { placed } = layoutWordCloud([{ text: 'bounded', weight: 1 }], {
    ...baseOptions,
    minFontSize: Number.MAX_VALUE,
    maxFontSize: Number.MAX_VALUE,
    measureText: (_text, fontSize) => {
      measuredAt = fontSize;
      return fontSize;
    },
  });

  expect(measuredAt).to.equal(MAX_FONT_SIZE_PX);
  expect(placed[0]!.fontSize).to.equal(MAX_FONT_SIZE_PX);
});

it('stops a pathological spiral after the hard iteration cap', () => {
  // A dense set of maximum-size square boxes eventually needs more spiral
  // work than the per-word budget. It remains a finite input, so the test
  // itself never relies on an actually non-terminating pre-fix case.
  const words = Array.from({ length: MAX_WORDS }, (_, i) => ({ text: `square-${i}`, weight: 1 }));
  const result = layoutWordCloud(
    words,
    {
      ...baseOptions,
      minFontSize: MAX_FONT_SIZE_PX,
      maxFontSize: MAX_FONT_SIZE_PX,
      measureText: () => MAX_FONT_SIZE_PX,
    },
  );

  expect(MAX_SPIRAL_ITERATIONS).to.equal(4096);
  expect(result.placed.length).to.be.lessThan(words.length);
  expect(result.skipped.length).to.equal(words.length - result.placed.length);
});
