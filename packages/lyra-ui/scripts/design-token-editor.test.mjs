#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeDesignTokenEditorProperties } from './design-token-editor.mjs';

const input = JSON.parse(
  readFileSync(new URL('./fixtures/token-editor.generated.json', import.meta.url), 'utf8'),
);
const properties = new Map([
  ['--lr-color-surface', [{ tag: 'lr-example', description: 'Component override.' }]],
]);
mergeDesignTokenEditorProperties(properties, input);

assert.equal(properties.size, input.properties.length);
assert.deepEqual(properties.get('--lr-theme-color-surface-default'), [
  {
    context: 'Application theme input',
    description: 'Canonical application theme input for color surface default.',
  },
]);
assert.equal(properties.get('--lr-color-surface').length, 2);
assert.match(
  properties.get('--lr-color-surface')[1].description,
  /Reads `--lr-theme-color-surface-default`\./,
);
assert.throws(
  () => mergeDesignTokenEditorProperties(new Map(), { schemaVersion: 1, properties: [{}] }),
  /Invalid generated design-token editor property/,
);

console.log('canonical design-token editor merge tests passed.');
