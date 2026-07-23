import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

// Pixelmatch filters the low-amplitude anti-aliasing differences through its own threshold. Keep
// the remaining absolute allowance deliberately small: screenshots cover the full viewport so a
// percentage-only allowance can otherwise exceed the entire painted area of a compact control.
export const PIXELMATCH_THRESHOLD = 0.1;
export const MAX_DIFF_PIXELS = 32;

export function comparePngs(baselineBuffer, currentBuffer) {
  let baseline;
  let current;
  try {
    baseline = PNG.sync.read(baselineBuffer);
    current = PNG.sync.read(currentBuffer);
  } catch (error) {
    return {
      status: 'error',
      message: `could not decode PNG: ${error instanceof Error ? error.message : error}`,
    };
  }
  if (baseline.width !== current.width || baseline.height !== current.height) {
    return {
      status: 'mismatch',
      reason: `dimension change: baseline ${baseline.width}x${baseline.height} vs current ${current.width}x${current.height}`,
      diffPng: null,
    };
  }
  const diff = new PNG({ width: baseline.width, height: baseline.height });
  const diffPixels = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    baseline.width,
    baseline.height,
    { threshold: PIXELMATCH_THRESHOLD },
  );
  const ratio = diffPixels / (baseline.width * baseline.height);
  return {
    status: diffPixels > MAX_DIFF_PIXELS ? 'mismatch' : 'match',
    diffPixels,
    ratio,
    diffPng: diffPixels > 0 ? PNG.sync.write(diff) : null,
  };
}
