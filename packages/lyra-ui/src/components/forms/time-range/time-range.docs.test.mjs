import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// wtr transpiles every `.ts` module through esbuild before a browser ever sees it, which strips
// JSDoc/comment text entirely -- so a colocated *.test.ts cannot observe class-doc prose at
// runtime. This file reads the real, on-disk TypeScript source directly (as the shipped
// custom-elements.json/editor-data generators do) so the regression test can actually see the
// comment text a consumer reads.
const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'time-range.class.ts'), 'utf8');

test('lr-time-range class doc does not attribute a stale not-visible-label carve-out to lr-slider', () => {
  // lr-slider's own label now renders as real visible text (label/hint/errorText parity with
  // lr-select) -- this class doc must stop claiming lr-slider "states" the same carve-out.
  assert.doesNotMatch(
    source,
    /the same carve-out `<lr-slider>` states for\s*\* its own single-handle `label`/,
    'time-range.class.ts must not claim lr-slider still carries the not-visible-label carve-out',
  );
});

test('lr-time-range class doc still explains its own no-visible-label design', () => {
  assert.match(
    source,
    /startLabel`\/`endLabel` here are per-handle\s*\* accessible-name overrides, not visible label text/,
    'time-range.class.ts should keep describing its own startLabel/endLabel design',
  );
});
