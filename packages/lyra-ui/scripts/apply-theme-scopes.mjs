#!/usr/bin/env node
// Applies the `theme-scopes` migration rule (RFC 0002) to this repository's own tests and stories,
// so every fixture that sets a token-layer input (or an output other outputs derive from) inline is
// a theme scope, exactly as a consumer's code is after `lyra-ui-migrate --rule=theme-scopes`.
//
//   node scripts/apply-theme-scopes.mjs           rewrite in place, print a summary
//   node scripts/apply-theme-scopes.mjs --check   fail when a fixture still needs a marker
//
// Only markup insertions are applied or checked. The rule's review warnings (dynamic
// `setProperty()` inputs, stylesheet rules) need a human; `--report` lists them.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './is-main-module.mjs';
import { migrateThemeScopes } from './migration-theme-scopes.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FIXTURE = /\.(?:test|stories)\.ts$/;

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : FIXTURE.test(entry.name) ? [target] : [];
  });
}

function applyThemeScopes({ check = false, report = false } = {}) {
  const pending = [];
  const warnings = [];
  for (const file of walk(path.join(packageDir, 'src')).sort()) {
    const original = readFileSync(file, 'utf8');
    const relative = path.relative(packageDir, file).split(path.sep).join('/');
    const result = migrateThemeScopes(original, { file: relative });
    if (report) warnings.push(...result.warnings);
    if (!result.changes.length) continue;
    pending.push(...result.changes);
    if (!check) writeFileSync(file, result.content);
  }
  return { pending, warnings };
}

if (isMainModule(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { pending, warnings } = applyThemeScopes({ check, report: process.argv.includes('--report') });
  for (const entry of warnings) console.log(`${entry.file}:${entry.line}:${entry.column}  ${entry.warningCode}: ${entry.message}`);
  if (check && pending.length) {
    for (const entry of pending) console.error(`${entry.file}:${entry.line}:${entry.column}  ${entry.message}`);
    console.error(`${pending.length} fixture element(s) need data-lr-theme-scope; run \`pnpm run theme-scopes\`.`);
    process.exitCode = 1;
  } else {
    console.log(check
      ? 'Every inline token-layer input in tests and stories sits on a theme scope.'
      : `Marked ${pending.length} fixture element(s) with data-lr-theme-scope.`);
  }
}
