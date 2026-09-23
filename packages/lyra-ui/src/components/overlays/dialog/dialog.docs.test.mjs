import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// See ../../forms/time-range/time-range.docs.test.mjs for why this reads raw source instead of
// going through wtr: esbuild strips JSDoc/comment text from every `.ts` module before a browser
// ever sees it.
const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'dialog.class.ts'), 'utf8');

test('lr-dialog close-button doc warns that --lr-icon-button-size is a no-op here', () => {
  const csspartDoc = source.match(/@csspart close-button__control[^]*?(?=\n\s*\*\s*@csspart)/);
  assert.ok(csspartDoc, 'expected the close-button__control @csspart doc block');
  assert.match(
    csspartDoc[0],
    /--lr-icon-button-size-scope/,
    'the doc must point to --lr-icon-button-size-scope, matching lr-copy-button\'s reference doc',
  );
  assert.match(
    csspartDoc[0],
    /NOT `--lr-icon-button-size`/,
    'the doc must explicitly warn that the bare token is a no-op on a composing host',
  );
});
