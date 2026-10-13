#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeSchema, validateResult } from './lib/results.mjs';
import * as catalog from './fixtures/catalog.mjs';

export async function main(args) {
  const expected = `${JSON.stringify(makeSchema(catalog), null, 2)}\n`;
  const schemaFile = fileURLToPath(new URL('./result.schema.json', import.meta.url));
  if (args.length === 1 && args[0] === '--write') await writeFile(schemaFile, expected);
  else if (args.length === 1 && args[0] === '--check') {
    if (await readFile(schemaFile, 'utf8') !== expected) throw new Error('schema-stale');
  } else if (args.length === 2 && args[0] === '--validate') validateResult(JSON.parse(await readFile(args[1], 'utf8')), catalog);
  else throw new Error('invalid-options');
  process.stdout.write('Benchmark schema validation passed.\n');
}
function isMainModule() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (isMainModule()) {
  try { await main(process.argv.slice(2)); }
  catch { process.stderr.write('Benchmark schema validation failed.\n'); process.exitCode = 1; }
}
