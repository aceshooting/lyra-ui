import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// See ../../forms/time-range/time-range.docs.test.mjs for why this reads raw source instead of
// going through wtr: esbuild strips JSDoc/comment text from every `.ts` module before a browser
// ever sees it.
const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'page.class.ts'), 'utf8');

test('visiblePixelsInViewport JSDoc documents its null-argument sentinel divergence from wa-page', () => {
  const methodDoc = source.match(/\/\*\*([^]*?)\*\/\s*\n\s*visiblePixelsInViewport\(/);
  assert.ok(methodDoc, 'expected a JSDoc block directly above visiblePixelsInViewport');
  assert.match(
    methodDoc[1],
    /wa-page/,
    'the inline doc cem reads for this method must call out the divergence from wa-page, matching llms/layout.md',
  );
  assert.match(
    methodDoc[1],
    /null/i,
    'the doc must mention the null-argument case specifically',
  );
});
