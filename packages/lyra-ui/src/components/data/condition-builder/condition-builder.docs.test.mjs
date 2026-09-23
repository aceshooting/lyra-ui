import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// See ../../forms/time-range/time-range.docs.test.mjs for why this reads raw source instead of
// going through wtr: esbuild strips JSDoc/comment text from every `.ts` module before a browser
// ever sees it.
const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'condition-builder.class.ts'), 'utf8');

test('lr-condition-builder remove-button doc documents a sizing cssprop, and its no-op trap', () => {
  const csspartDoc = source.match(/@csspart remove-button -[^]*?(?=\n\s*\*\s*@csspart)/);
  assert.ok(csspartDoc, 'expected the remove-button @csspart doc block');
  assert.match(
    csspartDoc[0],
    /--lr-icon-button-size-scope/,
    'the doc must mention a sizing cssprop at all, unlike today',
  );
  assert.match(
    csspartDoc[0],
    /NOT\s*\n?\s*\*?\s*`--lr-icon-button-size`/,
    'the doc must explicitly warn that the bare token is a no-op on a composing host',
  );
});
