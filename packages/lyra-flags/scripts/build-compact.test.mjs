import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { put, scratchPackage } from './test-support.mjs';

const SIZE = 128;
const CEILING = 12_000;
const FRAME = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">';

/** Left half blue, right half red: enough to prove orientation and colour survive the raster. */
const SPLIT = `${FRAME}<rect width="500" height="1000" fill="#0000ff"/><rect x="500" width="500" height="1000" fill="#ff0000"/></svg>`;
const GRADIENT = `${FRAME}<defs><linearGradient id="g"><stop offset="0" stop-color="#ffd000"/><stop offset="1" stop-color="#009a44"/></linearGradient></defs><rect width="1000" height="1000" fill="url(#g)"/></svg>`;
/** Fractal noise cannot be compressed, so the raster is far over the sanity ceiling. */
const NOISE = `${FRAME}<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="3"/></filter><rect width="1000" height="1000" filter="url(#n)"/></svg>`;

function addOriginals(scratch, originals) {
  for (const [code, svg] of Object.entries(originals)) put(join(scratch.flags, 'detailed', `${code}.svg`), svg);
}

const compact = (scratch, code) => join(scratch.flags, 'compact', `${code}.webp`);

async function pixels(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  return { info, at: (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)] };
}

test('reports an empty set of originals and creates nothing', context => {
  const scratch = scratchPackage(context, 'build-compact.mjs');
  put(join(scratch.flags, 'detailed', '.keep'), '');
  const result = scratch.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'No flags/detailed/*.svg originals found — nothing to rasterize.\n');
  assert.equal(result.stderr, '');
  assert.equal(existsSync(join(scratch.flags, 'compact')), false);
});

test('rasterizes each pristine original to a 128 px WebP, in code order, and reports exact totals', async context => {
  const scratch = scratchPackage(context, 'build-compact.mjs');
  addOriginals(scratch, { bb: SPLIT, aa: GRADIENT });
  put(join(scratch.flags, 'detailed', 'notes.txt'), 'not a flag');
  const result = scratch.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.deepEqual(readdirSync(join(scratch.flags, 'compact')).sort(), ['aa.webp', 'bb.webp']);

  const sizes = {};
  for (const code of ['aa', 'bb']) {
    const bytes = readFileSync(compact(scratch, code));
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    const { format, width, height } = await sharp(bytes).metadata();
    assert.deepEqual({ format, width, height }, { format: 'webp', width: SIZE, height: SIZE }, code);
    sizes[code] = bytes.length;
  }
  const total = sizes.aa + sizes.bb;
  const largest = sizes.aa >= sizes.bb ? 'aa' : 'bb';
  assert.equal(result.stdout, `Rasterized 2 compact flag(s) to flags/compact/*.webp at ${SIZE}px, q80. `
    + `Total ${(total / 1024).toFixed(1)} KB, avg ${Math.round(total / 2)} B, largest ${largest} at ${sizes[largest]} B. `
    + 'Run `pnpm run generate` next.\n');

  const { at } = await pixels(compact(scratch, 'bb'));
  const [leftRed, , leftBlue] = at(24, 64);
  const [rightRed, , rightBlue] = at(104, 64);
  assert.ok(leftBlue > 200 && leftRed < 60, 'the left half stays blue');
  assert.ok(rightRed > 200 && rightBlue < 60, 'the right half stays red');
});

test('rewrites existing rasters identically when run again', context => {
  const scratch = scratchPackage(context, 'build-compact.mjs');
  addOriginals(scratch, { aa: GRADIENT });
  assert.equal(scratch.run().status, 0);
  const first = readFileSync(compact(scratch, 'aa'));
  assert.equal(scratch.run().status, 0);
  assert.deepEqual(readFileSync(compact(scratch, 'aa')), first);
});

test('warns, without failing, when a raster exceeds the sanity ceiling', context => {
  const scratch = scratchPackage(context, 'build-compact.mjs');
  addOriginals(scratch, { aa: SPLIT, noise: NOISE });
  const result = scratch.run();
  assert.equal(result.status, 0, result.stderr);
  const size = statSync(compact(scratch, 'noise')).size;
  assert.ok(size > CEILING, `the fixture must stay over the ceiling (was ${size} B)`);
  assert.ok(statSync(compact(scratch, 'aa')).size <= CEILING);
  assert.match(result.stderr, new RegExp(`^\\nWARNING: 1 compact raster\\(s\\) exceed the ${CEILING} B sanity ceiling: noise \\(${size} B\\)\\. Check the source art`, 'u'));
});

test('refuses a corrupt original instead of shipping a missing raster, and prints no summary', context => {
  const scratch = scratchPackage(context, 'build-compact.mjs');
  addOriginals(scratch, { aa: SPLIT, bb: 'this is not an SVG' });
  const result = scratch.run();
  assert.notEqual(result.status, 0, 'a corrupt original must fail the maintenance job');
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Error/u);
  assert.equal(existsSync(compact(scratch, 'bb')), false);
});
