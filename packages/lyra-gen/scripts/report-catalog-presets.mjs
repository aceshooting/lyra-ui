#!/usr/bin/env node
/** Deterministic measurements of emitted prompt text, with no model/token estimate. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { catalogPresetNames, catalogPresets, initialCatalog } from '../dist/catalog.js';
import { buildCatalogPrompt } from '../dist/prompts.js';

const arguments_ = process.argv.slice(2);
assert.ok(arguments_.length <= 1 && arguments_.every(argument => ['--write', '--check'].includes(argument)), 'Use --write, --check, or no argument.');
const fixture = new URL('./fixtures/catalog-preset-prompts.json', import.meta.url);
const fullPrompt = buildCatalogPrompt(initialCatalog);
const fullBytes = Buffer.byteLength(fullPrompt, 'utf8');
const measurements = Object.fromEntries([['full', initialCatalog], ...catalogPresetNames.map(name => [name, catalogPresets[name]])].map(([name, catalog]) => {
  const prompt = buildCatalogPrompt(catalog);
  const utf8Bytes = Buffer.byteLength(prompt, 'utf8');
  return [name, {
    catalog: { id: catalog.id, version: catalog.version },
    roles: Object.keys(catalog.components).sort(), actionNames: Object.keys(catalog.actions ?? {}).sort(),
    utf16CodeUnits: prompt.length, unicodeCodePoints: [...prompt].length, utf8Bytes,
    bytesRemovedFromFull: fullBytes - utf8Bytes,
    promptSha256: createHash('sha256').update(prompt, 'utf8').digest('hex'),
  }];
}));
const report = {
  format: 'lyra-gen-preset-prompt-measurements', version: '1',
  boundary: 'Exact output of buildCatalogPrompt for the full reviewed catalog and each action-closed named preset; includes metadata/examples and fixed prompt instructions.',
  providerUsage: { measuredTokens: null, measuredModelErrorRate: null, modelCalls: 0 },
  interpretation: 'UTF-8 bytes and character counts describe prompt text only. No tokenizer, model-quality, latency or cost result is inferred.',
  measurements,
};
if (arguments_.includes('--write')) await writeFile(fixture, `${JSON.stringify(report, null, 2)}\n`);
if (arguments_.includes('--check')) assert.deepEqual(report, JSON.parse(await readFile(fixture, 'utf8')), 'Preset prompt measurements changed; regenerate and review the fixture.');
console.log(JSON.stringify(report, null, 2));
