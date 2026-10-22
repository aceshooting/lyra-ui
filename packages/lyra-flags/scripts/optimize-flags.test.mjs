import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { put, scratchPackage } from './test-support.mjs';

const THRESHOLD = 20_000;
const BUDGET = 80_000;
const HEADER = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">';

/** Authored with far more precision than a 1000-unit viewBox needs, and as many separate paths. */
function preciseFlag(paths) {
  let body = '';
  for (let index = 0; index < paths; index++) {
    body += `  <path fill="#aabbcc" d="M 12.3456 34.5678 L ${100 + index}.4567 45.6789 L 99.1234 ${200 + index}.5678 Z"/>\n`;
  }
  return `${HEADER}\n  <!-- authored with a lot of precision -->\n${body}</svg>\n`;
}

/** One path of pseudo-random integer vertices: dense geometry that no encoding change can shrink much. */
function denseFlag(points) {
  let state = 7;
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  let data = 'M 0 0';
  for (let index = 0; index < points; index++) data += ` L ${Math.floor(next() * 1000)} ${Math.floor(next() * 1000)}`;
  return `${HEADER}<path fill="#112233" d="${data} Z"/></svg>\n`;
}

/** A flag of exactly `bytes` bytes: a comment absorbs the difference. */
function flagOfSize(bytes) {
  const frame = `${HEADER}<!---->\n<path d="M0 0h10v10z"/></svg>\n`;
  return frame.replace('<!---->', `<!--${'x'.repeat(bytes - Buffer.byteLength(frame))}-->`);
}

const read = (...parts) => readFileSync(join(...parts), 'utf8');

test('leaves flags at or under the size threshold untouched, including one of exactly 20,000 bytes', context => {
  const scratch = scratchPackage(context, 'optimize-flags.mjs');
  const flags = { small: `${HEADER}<path d="M0 0h10v10z"/></svg>\n`, edge: flagOfSize(THRESHOLD) };
  assert.equal(Buffer.byteLength(flags.edge), THRESHOLD);
  for (const [code, svg] of Object.entries(flags)) put(join(scratch.flags, `${code}.svg`), svg);
  const result = scratch.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^No flags exceeded the threshold \(or all were already processed\) -- nothing to do\.\n$/u);
  assert.equal(result.stderr, '');
  for (const [code, svg] of Object.entries(flags)) assert.equal(read(scratch.flags, `${code}.svg`), svg, code);
  assert.equal(existsSync(join(scratch.flags, 'detailed', 'edge.svg')), false);
});

test('optimizes a flag one byte over the threshold', context => {
  const scratch = scratchPackage(context, 'optimize-flags.mjs');
  const flag = flagOfSize(THRESHOLD + 1);
  put(join(scratch.flags, 'edge.svg'), flag);
  const result = scratch.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 flag\(s\) optimized\./u);
  assert.equal(read(scratch.flags, 'detailed', 'edge.svg'), flag, 'the pristine original is preserved verbatim');
  assert.ok(statSync(join(scratch.flags, 'edge.svg')).size < THRESHOLD, 'the standard flag shrinks');
});

test('keeps the pristine original and derives a smaller, geometry-preserving standard flag from it', context => {
  const scratch = scratchPackage(context, 'optimize-flags.mjs');
  const small = `${HEADER}<path d="M0 0h10v10z"/></svg>\n`;
  const precise = preciseFlag(250);
  put(join(scratch.flags, 'zz.svg'), precise);
  put(join(scratch.flags, 'aa.svg'), precise);
  put(join(scratch.flags, 'mm.svg'), small);
  assert.ok(Buffer.byteLength(precise) > THRESHOLD);
  const result = scratch.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');

  for (const code of ['aa', 'zz']) {
    assert.equal(read(scratch.flags, 'detailed', `${code}.svg`), precise, `${code}: pristine original`);
    const standard = read(scratch.flags, `${code}.svg`);
    assert.ok(Buffer.byteLength(standard) < Buffer.byteLength(precise) / 2, `${code}: standard flag is much smaller`);
    assert.match(standard, /^<svg /u, `${code}: still an SVG document`);
    assert.equal(standard.includes('viewBox="0 0 1000 1000"'), true, `${code}: framing is kept`);
    assert.doesNotMatch(standard, /authored with a lot of precision/u, `${code}: comments are dropped`);
    assert.equal(standard.match(/<path\b/gu).length, 1, `${code}: sibling paths are merged`);
    assert.doesNotMatch(standard.match(/ d=(\x22|')(.*?)\1/u)[2], /\d\.\d/u, `${code}: coordinates are whole units`);
  }
  assert.equal(read(scratch.flags, 'mm.svg'), small);
  assert.equal(existsSync(join(scratch.flags, 'detailed', 'mm.svg')), false);

  const rows = result.stdout.split('\n').filter(line => /^\w+\s+\d+ B\s+\d+ B\s+-\d+\.\d%$/u.test(line));
  assert.deepEqual(rows.map(row => row.split(/\s+/u)[0]), ['aa', 'zz'], 'one row per optimized flag, in code order');
  for (const row of rows) assert.equal(Number(row.split(/\s+/u)[1]), Buffer.byteLength(precise));
  assert.match(result.stdout, new RegExp(`2 flag\\(s\\) optimized\\. Total: ${2 * Buffer.byteLength(precise)} B -> \\d+ B \\(-\\d+\\.\\d%\\)\\. Largest standard flag: (?:aa|zz) at \\d+ B\\. Pristine originals preserved in flags/detailed/\\. Run \`pnpm run build-compact\` then \`pnpm run generate\` next\\.`, 'u'));
});

test('re-running derives the standard flag from the pristine original, never from the optimized file', context => {
  const scratch = scratchPackage(context, 'optimize-flags.mjs');
  put(join(scratch.flags, 'aa.svg'), preciseFlag(250));
  assert.equal(scratch.run().status, 0);
  const first = read(scratch.flags, 'aa.svg');
  const pristine = read(scratch.flags, 'detailed', 'aa.svg');

  // A standard flag degraded by hand is restored from the original even though it is now tiny.
  writeFileSync(join(scratch.flags, 'aa.svg'), `${HEADER}<path d="M0 0h1"/></svg>\n`);
  const second = scratch.run();
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /1 flag\(s\) optimized\./u);
  assert.equal(read(scratch.flags, 'aa.svg'), first);
  assert.equal(read(scratch.flags, 'detailed', 'aa.svg'), pristine);
});

test('warns, without failing, when an optimized flag still exceeds the standard-tier budget', context => {
  const scratch = scratchPackage(context, 'optimize-flags.mjs');
  put(join(scratch.flags, 'zdense.svg'), denseFlag(14_000));
  put(join(scratch.flags, 'light.svg'), preciseFlag(250));
  const result = scratch.run();
  assert.equal(result.status, 0, result.stderr);
  const size = statSync(join(scratch.flags, 'zdense.svg')).size;
  assert.ok(size > BUDGET, `the fixture must stay over the budget (was ${size} B)`);
  assert.ok(statSync(join(scratch.flags, 'light.svg')).size <= BUDGET);
  assert.match(result.stdout, new RegExp(`Largest standard flag: zdense at ${size} B\\.`, 'u'));
  assert.match(result.stderr, new RegExp(`^\\nWARNING: 1 flag\\(s\\) still exceed the ${BUDGET} B standard-tier budget: zdense \\(${size} B\\)\\. Consider tuning`, 'u'));
});

test('refuses a malformed original and leaves the standard flag as it was', context => {
  const scratch = scratchPackage(context, 'optimize-flags.mjs');
  const broken = `${HEADER}<path d="${'M0 0 '.repeat(5_000)}"`;
  put(join(scratch.flags, 'bad.svg'), broken);
  assert.ok(Buffer.byteLength(broken) > THRESHOLD);
  const result = scratch.run();
  assert.notEqual(result.status, 0, 'a malformed SVG must fail the maintenance job');
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Error/u);
  assert.equal(read(scratch.flags, 'bad.svg'), broken);
});
