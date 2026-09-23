import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// See time-range.docs.test.mjs for why this reads raw source/markdown instead of going through
// wtr: esbuild strips JSDoc/comment text from every `.ts` module before a browser ever sees it.
const here = dirname(fileURLToPath(import.meta.url));
const llmsData = readFileSync(join(here, '../../../../llms/data.md'), 'utf8');
const classSource = readFileSync(join(here, 'context-meter.class.ts'), 'utf8');
const gaugeSource = readFileSync(join(here, '../gauge/gauge.class.ts'), 'utf8');

function strokeConstant(source) {
  const match = source.match(/const STROKE = (\d+);/);
  assert.ok(match, 'expected a `const STROKE = <number>;` declaration');
  return Number(match[1]);
}

test('llms/data.md no longer claims lr-context-meter stroke matches lr-gauge', () => {
  assert.doesNotMatch(
    llmsData,
    /12px stroke, centered at 50,50\) intentionally matches `lr-gauge`'s own radial\s*numbers, so the two circular-meter components in the library share one visual scale\./,
    'llms/data.md must not claim the ring stroke matches lr-gauge -- the two STROKE constants differ',
  );
});

test('llms/data.md still states the real RADIUS/CENTER parity without overclaiming stroke', () => {
  assert.match(llmsData, /RADIUS\/CENTER match `lr-gauge`/, 'llms/data.md should state the true, narrower parity claim');
});

test('the STROKE constants actually differ, which is why the doc must not claim they match', () => {
  const contextMeterStroke = strokeConstant(classSource);
  const gaugeStroke = strokeConstant(gaugeSource);
  assert.notEqual(contextMeterStroke, gaugeStroke, 'this test itself would need updating if the constants were ever unified');
});
