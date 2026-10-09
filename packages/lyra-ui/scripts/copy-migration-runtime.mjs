import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const runtimeModules = Object.freeze([
  'lyra-ui.mjs',
  'init-agents.mjs',
  'agent-registry.mjs',
  'is-main-module.mjs',
  'migrate-wa.mjs',
  'html-comments.mjs',
  'migration-contract.mjs',
  'migration-analysis.mjs',
  'migration-renames.mjs',
  'migration-transforms.mjs',
  'component-inventory.mjs',
  'lyra-rename-ledger.mjs',
  'migration-theme-scopes.mjs',
  'theme-scope-vocabulary.generated.mjs',
  'css-declarations.mjs',
]);

/** Copies the standalone CLIs' (lyra-ui, lyra-ui-migrate) module closure without contributor-only scripts or fixtures. */
export function copyMigrationRuntimeModules(sourceDirectory, outputDirectory) {
  mkdirSync(outputDirectory, { recursive: true });
  for (const module of runtimeModules) {
    copyFileSync(join(sourceDirectory, module), join(outputDirectory, module));
  }
}
