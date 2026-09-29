#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTranslationCatalogInventory } from './check-translations.mjs';
import { validateTranslationReviews } from './translation-review.mjs';
import {
  readTranslationReviews,
  writeTranslationReviews,
} from './translation-review-source.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const check = args.length === 1 && args[0] === '--check';
if (args.length > 0 && !check) throw new Error('usage: node scripts/generate-translation-review-fixture.mjs [--check]');

async function validationContext() {
  const inventory = await readTranslationCatalogInventory({ packageDir });
  const upstream = JSON.parse(await readFile(path.join(packageDir, 'scripts/fixtures/upstream-tags.json'), 'utf8'));
  return {
    englishEntries: inventory.englishEntries,
    catalogs: inventory.catalogs,
    upstreamPins: { webawesome: upstream.webawesome, shoelace: upstream.shoelace },
  };
}

if (!check) {
  await writeTranslationReviews({ packageDir, validationContext: await validationContext() });
} else {
  const fixture = await readTranslationReviews({ packageDir });
  const errors = validateTranslationReviews(fixture, await validationContext());
  if (errors.length > 0) throw new Error(errors.join('\n'));
}
