#!/usr/bin/env node

// Generates stable, tag-shaped component entry points such as
// `@aceshooting/lyra-ui/components/lr-input.js`. The alias is intentionally
// independent of the component's family/folder layout and re-exports the
// existing registration entry so importing it keeps the normal define-once
// behavior.

import {
  existsSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));
const GENERATED_MARKER = '// GENERATED FILE — stable tag-shaped component entry point.';
const TAG_PATTERN = /^lr-[a-z][a-z0-9-]*$/u;
const REGISTRATION_PATTERN = /^src\/components\/[a-z0-9-/]+\.ts$/u;

function invariant(condition, message) {
  if (!condition) throw new Error(`Invalid tag-alias inventory: ${message}`);
}

function registrationSpecifier(registrationModule) {
  return `./${registrationModule
    .slice('src/components/'.length)
    .replace(/\.ts$/u, '.js')}`;
}

/** Derives the deterministic alias list from component inventory data. */
export function deriveTagAliases(inventory) {
  invariant(inventory?.schemaVersion === 1, 'schemaVersion must be 1');
  invariant(Array.isArray(inventory.components), 'components must be an array');

  const seenTags = new Set();
  const aliases = inventory.components.map((component) => {
    invariant(TAG_PATTERN.test(component?.tag), 'every component needs a valid lr-* tag');
    invariant(!seenTags.has(component.tag), `duplicate tag ${component.tag}`);
    seenTags.add(component.tag);
    invariant(
      REGISTRATION_PATTERN.test(component.registrationModule),
      `${component.tag}: invalid registrationModule`,
    );
    return {
      tag: component.tag,
      registrationModule: component.registrationModule,
      specifier: registrationSpecifier(component.registrationModule),
      sourceFile: `src/components/${component.tag}.ts`,
      exportPath: `./components/${component.tag}.js`,
      distFile: `dist/components/${component.tag}.js`,
    };
  });

  return aliases.sort((left, right) => left.tag.localeCompare(right.tag));
}

/** Renders one alias module. Export-star deliberately preserves both registration and named types. */
export function renderTagAlias(alias) {
  return [
    GENERATED_MARKER,
    '// Run `node scripts/generate-tag-aliases.mjs` to refresh.',
    `export * from '${alias.specifier}';`,
    '',
  ].join('\n');
}

function readInventory(packageDir) {
  return JSON.parse(
    readFileSync(path.join(packageDir, 'scripts', 'fixtures', 'component-inventory.json'), 'utf8'),
  );
}

function existingAliasFiles(packageDir) {
  const componentDir = path.join(packageDir, 'src', 'components');
  return readdirSync(componentDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^lr-[a-z0-9-]+\.ts$/u.test(entry.name))
    .map((entry) => path.join(componentDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Generates aliases or, with `check`, returns every stale/missing path without mutating the tree.
 * Stale files are removed only when they carry this generator's marker.
 */
export function generateTagAliases({ packageDir = defaultPackageDir, check = false } = {}) {
  const aliases = deriveTagAliases(readInventory(packageDir));
  const expectedFiles = new Set();
  const stale = [];

  for (const alias of aliases) {
    const file = path.join(packageDir, alias.sourceFile);
    const expected = renderTagAlias(alias);
    expectedFiles.add(file);
    const actual = existsSync(file) ? readFileSync(file, 'utf8') : undefined;
    if (actual !== expected) {
      stale.push(path.relative(packageDir, file).replaceAll(path.sep, '/'));
      if (!check) writeFileSync(file, expected);
    }
  }

  for (const file of existingAliasFiles(packageDir)) {
    if (expectedFiles.has(file)) continue;
    const source = readFileSync(file, 'utf8');
    invariant(
      source.startsWith(GENERATED_MARKER),
      `${path.relative(packageDir, file)} looks like an alias but is not generator-owned`,
    );
    stale.push(path.relative(packageDir, file).replaceAll(path.sep, '/'));
    if (!check) unlinkSync(file);
  }

  return { aliases, stale: [...new Set(stale)].sort() };
}

function main() {
  const check = process.argv.includes('--check');
  const { aliases, stale } = generateTagAliases({ check });
  if (check && stale.length > 0) {
    console.error(
      `Stable tag aliases are stale (${stale.length}):\n${stale.map((file) => `  - ${file}`).join('\n')}`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    check
      ? `Stable tag aliases are fresh (${aliases.length} entries).`
      : `Stable tag aliases generated (${aliases.length} entries).`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
