#!/usr/bin/env node
import { isMainModule } from './is-main-module.mjs';
import { runTranslationCatalogSizeCheck } from './check-translation-catalog-size.mjs';
import { runTranslationCatalogCheck } from './check-translations.mjs';
import { runDefaultStringSlicesCli } from './generate-default-string-slices.mjs';
import { runTranslationSlicesCli } from './generate-translation-slices.mjs';

// The four catalog checks share one reachability walk; remedies: `pnpm run default-string-slices`, `pnpm run translation-slices`.
export const LOCALIZATION_CATALOG_CHECKS = Object.freeze([
  ['default-string slices', () => runDefaultStringSlicesCli()],
  ['translation slices', () => runTranslationSlicesCli()],
  ['translation catalogs', () => runTranslationCatalogCheck()],
  ['translation catalog sizes', () => runTranslationCatalogSizeCheck()],
]);

export async function runLocalizationCatalogChecks(checks = LOCALIZATION_CATALOG_CHECKS) {
  const failed = [];
  for (const [name, run] of checks) {
    let status;
    try {
      status = await run();
    } catch (error) {
      console.error(error instanceof Error ? error.stack ?? error.message : error);
      status = 1;
    }
    if (status !== 0) failed.push(name);
  }
  if (failed.length > 0) {
    console.error(`Localization catalog checks failed: ${failed.join(', ')}.`);
    return 1;
  }
  return 0;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = await runLocalizationCatalogChecks();
}
