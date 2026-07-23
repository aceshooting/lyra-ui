#!/usr/bin/env node

import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { comparePngs } from './visual-regression-compare.mjs';

function solidPng(width, height, rgba = [255, 255, 255, 255]) {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = rgba[0];
    png.data[i + 1] = rgba[1];
    png.data[i + 2] = rgba[2];
    png.data[i + 3] = rgba[3];
  }
  return png;
}

const baseline = solidPng(1280, 800);
const missingSmallControl = solidPng(1280, 800);
for (let y = 40; y < 80; y += 1) {
  for (let x = 40; x < 80; x += 1) {
    const offset = (y * missingSmallControl.width + x) * 4;
    missingSmallControl.data[offset] = 0;
    missingSmallControl.data[offset + 1] = 0;
    missingSmallControl.data[offset + 2] = 0;
  }
}

const smallControlComparison = comparePngs(
  PNG.sync.write(baseline),
  PNG.sync.write(missingSmallControl),
);
assert.equal(
  smallControlComparison.status,
  'mismatch',
  'a completely changed 40x40 control must fail even in a full-viewport screenshot',
);

const identicalComparison = comparePngs(PNG.sync.write(baseline), PNG.sync.write(baseline));
assert.equal(identicalComparison.status, 'match');
assert.equal(identicalComparison.diffPixels, 0);

console.log('visual-regression comparison: small controls are blocking and identical images match.');
