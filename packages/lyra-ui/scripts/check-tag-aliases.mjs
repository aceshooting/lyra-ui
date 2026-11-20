#!/usr/bin/env node

import process from 'node:process';
import { generateTagAliases } from './generate-tag-aliases.mjs';

const { aliases, stale } = generateTagAliases();
if (stale.length > 0) {
  console.error(
    'Tag-shaped component entries are missing, do not register their tag, or have no inventory ' +
      `component (${stale.length}):\n${stale.map((file) => `  - ${file}`).join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log(`Tag-shaped component entries are complete (${aliases.length} entries).`);
}
