import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const canonical = JSON.parse(read('../tokens/canonical-tokens.json')).tokens;
const css = read('../src/styles/palette.css');
const STEPS = ['05', '10', '20', '30', '40', '50', '60', '70', '80', '90', '95'];
// Hue name -> the tooling ramp the palette republishes unchanged.
const DIRECT = { gray: 'neutral', red: 'danger', orange: 'warning', green: 'success', blue: 'brand' };

test('palette.css republishes the tooling ramps for the five direct hues', () => {
  for (const [hue, variant] of Object.entries(DIRECT)) {
    for (const step of STEPS) {
      const expected = canonical[`--lr-ramp-${variant}-${step}`].values.light;
      assert.ok(css.includes(`--lr-color-${hue}-${step}: ${expected};`), `${hue}-${step} must equal ramp ${variant}-${step}`);
    }
  }
});

test('palette.css declares every step of every hue exactly once', () => {
  for (const hue of ['gray', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink']) {
    for (const step of STEPS) {
      assert.equal(css.split(`--lr-color-${hue}-${step}:`).length - 1, 1, `${hue}-${step}`);
    }
  }
});
