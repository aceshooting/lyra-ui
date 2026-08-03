#!/usr/bin/env node

import process from 'node:process';
import { generateTagAliases } from './generate-tag-aliases.mjs';

const { aliases, stale } = generateTagAliases({ check: true });
if (stale.length > 0) {
  console.error(
    `Stable tag aliases are stale (${stale.length}):\n${stale.map((file) => `  - ${file}`).join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log(`Stable tag aliases are fresh (${aliases.length} entries).`);
}
