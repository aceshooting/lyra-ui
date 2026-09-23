import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// See ../../forms/time-range/time-range.docs.test.mjs for why this reads raw source instead of
// going through wtr: esbuild strips JSDoc/comment text from every `.ts` module before a browser
// ever sees it.
const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'icon-button.class.ts'), 'utf8');
const upstreamTags = JSON.parse(readFileSync(join(here, '../../../../scripts/fixtures/upstream-tags.json'), 'utf8'));

test('lr-icon-button rel doc does not name a fictional wa-icon-button tag', () => {
  assert.doesNotMatch(source, /wa-icon-button/, 'icon-button.class.ts must not claim a wa-icon-button counterpart exists');
});

test('lr-icon-button rel doc still credits its real sl-icon-button upstream', () => {
  assert.match(source, /mirrors\s*\*\s*`sl-icon-button`'s own `rel`/, 'the rel doc should still credit the real Shoelace mapping');
});

test('the pinned upstream-tags fixture confirms wa-icon-button really does not exist', () => {
  const allWaTags = [...(upstreamTags.webawesome?.free ?? []), ...(upstreamTags.webawesome?.pro ?? [])];
  assert.ok(!allWaTags.includes('wa-icon-button'), 'wa-icon-button must be absent from the pinned Web Awesome inventory');
});
