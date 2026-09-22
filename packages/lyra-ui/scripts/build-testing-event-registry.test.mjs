import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildRegistrySource, main } from './build-testing-event-registry.mjs';

const packageDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputFile = path.join(packageDirectory, 'src', 'testing', 'lyra-tag-event-map.ts');

test('building the registry source keeps the tracked output available to concurrent readers', () => {
  const before = readFileSync(outputFile, 'utf8');
  const beforeMtime = statSync(outputFile).mtimeNs;

  assert.equal(typeof buildRegistrySource(), 'string');
  assert.equal(readFileSync(outputFile, 'utf8'), before);
  assert.equal(statSync(outputFile).mtimeNs, beforeMtime);
});

test('freshness checks are read-only and preserve stale detection', () => {
  const before = readFileSync(outputFile, 'utf8');
  const beforeMtime = statSync(outputFile).mtimeNs;

  assert.equal(main(['--check']), 0);
  assert.equal(readFileSync(outputFile, 'utf8'), before);
  assert.equal(statSync(outputFile).mtimeNs, beforeMtime);
});
