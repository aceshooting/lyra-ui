import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// See ../../forms/time-range/time-range.docs.test.mjs for why this reads raw source/markdown
// instead of going through wtr: esbuild strips JSDoc/comment text from every `.ts` module before a
// browser ever sees it.
const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'message-parts.class.ts'), 'utf8');
const llmsConversation = readFileSync(join(here, '../../../../llms/conversation.md'), 'utf8');

test('MessagePartRenderer/renderPart JSDoc documents that a defined return discards the built-in interactive wiring', () => {
  const typeDoc = source.match(/\/\*\*([^]*?)\*\/\s*\nexport type MessagePartRenderer/);
  assert.ok(typeDoc, 'expected a JSDoc block directly above the exported MessagePartRenderer type');
  assert.match(typeDoc[1], /lr-part-retry/, 'must name the error retry event lost by a custom render');
  assert.match(typeDoc[1], /lr-citation-select/, 'must name the citation-select event lost by a custom render');
  assert.match(
    typeDoc[1],
    /replaces?/i,
    'must state the full-replacement semantics, not just the undefined-delegates-to-built-in half',
  );
});

test('llms/conversation.md documents the same full-replacement, interactivity-loss contract', () => {
  assert.match(
    llmsConversation,
    /renderPart\?: MessagePartRenderer[^]*?fully\s+replaces/,
    'the authored consumer reference must state that a defined return fully replaces built-in rendering',
  );
  assert.match(
    llmsConversation,
    /lr-part-retry/,
    'the authored consumer reference must name at least one concrete affordance lost',
  );
});
