#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCurrentCompatibilityContextSync } from './check-published-compatibility.mjs';
import { assembleComponentMetadata, readComponentMetadataSources } from './component-metadata-source.mjs';
import { isMainModule } from './is-main-module.mjs';
import { createMigrationRuntimeInventory, readRenameLedger } from './migrate-wa.mjs';

/** The exact `dist/cli/migration-contract.json` text; callers may pass a context already verified for this inventory. */
export function migrationContractText(packageDir = dirname(dirname(fileURLToPath(import.meta.url))), {
  componentInventory = JSON.parse(readFileSync(join(packageDir, 'scripts', 'fixtures', 'component-inventory.json'), 'utf8')),
  compatibilityContext = readCurrentCompatibilityContextSync(packageDir, componentInventory),
} = {}) {
  const { exportDeprecations } = assembleComponentMetadata(readComponentMetadataSources(packageDir));
  return `${JSON.stringify(createMigrationRuntimeInventory(componentInventory, {
    renameLedger: readRenameLedger(),
    exportDeprecations,
    compatibilityContext,
  }))}\n`;
}

if (isMainModule(import.meta.url)) process.stdout.write(migrationContractText());
