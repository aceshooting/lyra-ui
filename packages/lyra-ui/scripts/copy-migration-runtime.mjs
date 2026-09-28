import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const runtimeModules = Object.freeze([
  'migrate-wa.mjs',
  'migration-contract.mjs',
  'migration-analysis.mjs',
  'migration-renames.mjs',
  'migration-transforms.mjs',
  'component-inventory.mjs',
  'lyra-rename-ledger.mjs',
]);

/** Copies the standalone CLI's module closure without contributor-only scripts or fixtures. */
export function copyMigrationRuntimeModules(sourceDirectory, outputDirectory) {
  mkdirSync(outputDirectory, { recursive: true });
  for (const module of runtimeModules) {
    copyFileSync(join(sourceDirectory, module), join(outputDirectory, module));
  }
}
