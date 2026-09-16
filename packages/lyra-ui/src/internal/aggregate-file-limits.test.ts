import { expect } from '@open-wc/testing';
import { AggregateFileLimitTracker } from './aggregate-file-limits.js';

function makeSizedFile(name: string, sizeBytes: number): File {
  const file = new File([], name, { type: 'text/plain' });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

function makeUnsizedFile(name: string): File {
  const file = new File([], name, { type: 'text/plain' });
  Object.defineProperty(file, 'size', { value: undefined });
  return file;
}

it('accepts files below both limits and increments both running totals', () => {
  const tracker = new AggregateFileLimitTracker();
  const limits = { maxFiles: 3, maxTotalSize: 1000 };
  expect(tracker.evaluate(makeSizedFile('a.bin', 100), limits)).to.equal(null);
  expect(tracker.evaluate(makeSizedFile('b.bin', 100), limits)).to.equal(null);
  expect(tracker.allowance(limits)).to.deep.equal({ remainingFiles: 1, remainingTotalSize: 800 });
});

it('rejects a file beyond maxFiles without counting it against the running size', () => {
  const tracker = new AggregateFileLimitTracker(2, 0);
  const limits = { maxFiles: 2, maxTotalSize: null };
  expect(tracker.evaluate(makeSizedFile('c.bin', 50), limits)).to.equal('maxFiles');
  expect(tracker.allowance(limits)).to.deep.equal({ remainingFiles: 0, remainingTotalSize: null });
});

it('rejects a file beyond maxTotalSize, reporting the true remaining byte allowance', () => {
  const tracker = new AggregateFileLimitTracker(0, 800);
  const limits = { maxFiles: null, maxTotalSize: 1000 };
  // 800 + 300 > 1000: rejected, but 200 bytes of room remain for a smaller file.
  expect(tracker.evaluate(makeSizedFile('big.bin', 300), limits)).to.equal('maxTotalSize');
  expect(tracker.allowance(limits)).to.deep.equal({ remainingFiles: null, remainingTotalSize: 200 });
  expect(tracker.evaluate(makeSizedFile('fits.bin', 150), limits)).to.equal(null);
  expect(tracker.allowance(limits)).to.deep.equal({ remainingFiles: null, remainingTotalSize: 50 });
});

it('null limits (both unset) never reject and report null allowance', () => {
  const tracker = new AggregateFileLimitTracker();
  const limits = { maxFiles: null, maxTotalSize: null };
  expect(tracker.evaluate(makeSizedFile('any.bin', 1_000_000), limits)).to.equal(null);
  expect(tracker.allowance(limits)).to.deep.equal({ remainingFiles: null, remainingTotalSize: null });
});

it('a non-finite file.size (synthetic preview item) never triggers maxTotalSize and contributes 0', () => {
  const tracker = new AggregateFileLimitTracker(0, 500);
  const limits = { maxFiles: null, maxTotalSize: 500 };
  expect(tracker.evaluate(makeUnsizedFile('preview.bin'), limits)).to.equal(null);
  expect(tracker.allowance(limits)).to.deep.equal({ remainingFiles: null, remainingTotalSize: 0 });
});

it('a baseline of 0/0 (the default) reproduces limit-only behavior with no externally held files', () => {
  const tracker = new AggregateFileLimitTracker(0, 0);
  const limits = { maxFiles: 1, maxTotalSize: 100 };
  expect(tracker.evaluate(makeSizedFile('only.bin', 100), limits)).to.equal(null);
  expect(tracker.evaluate(makeSizedFile('extra.bin', 1), limits)).to.equal('maxFiles');
});

it('normalizes a negative, NaN, or Infinity baseline to 0 rather than corrupting every comparison', () => {
  const limits = { maxFiles: 2, maxTotalSize: 100 };

  const negative = new AggregateFileLimitTracker(-5, -5);
  expect(negative.allowance(limits)).to.deep.equal({ remainingFiles: 2, remainingTotalSize: 100 });

  const nan = new AggregateFileLimitTracker(Number.NaN, Number.NaN);
  expect(nan.allowance(limits)).to.deep.equal({ remainingFiles: 2, remainingTotalSize: 100 });

  const infinite = new AggregateFileLimitTracker(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  expect(infinite.allowance(limits)).to.deep.equal({ remainingFiles: 2, remainingTotalSize: 100 });
});

it('a baseline already at or past the limit rejects every further file immediately', () => {
  const tracker = new AggregateFileLimitTracker(100, 250 * 1024 * 1024);
  const limits = { maxFiles: 100, maxTotalSize: 250 * 1024 * 1024 };
  expect(tracker.evaluate(makeSizedFile('one-more.bin', 1), limits)).to.equal('maxFiles');
  expect(tracker.allowance(limits)).to.deep.equal({ remainingFiles: 0, remainingTotalSize: 0 });
});
