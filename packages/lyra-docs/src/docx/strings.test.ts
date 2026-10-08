import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { DOCX_EDITOR_STRINGS } from './strings.js';

const classSource = readFileSync(resolve('src/docx/docx-editor.class.ts'), 'utf8');
const strings: Readonly<Record<string, string>> = DOCX_EDITOR_STRINGS;

test('every key the editor localizes has an English default', () => {
  const keys = new Set([...classSource.matchAll(/(?:localize\(|: )'(docxEditor[A-Za-z]+)'/gu)].map(match => match[1]!));
  assert(keys.size > 40);
  assert.deepEqual([...keys].filter(key => !Object.hasOwn(strings, key)), []);
});

test('size-limit and resize messages interpolate through placeholders, not concatenation', () => {
  assert.match(strings['docxEditorErrorTooLarge']!, /\{size\}.*\{elements\}/u);
  assert.match(strings['docxEditorResizeImageWithSize']!, /\{action\}.*\{dimensions\}/u);
  assert.match(strings['docxEditorErrorMount']!, /shadow root/u);
  assert.match(strings['docxEditorErrorEngine']!, /engine/u);
});
