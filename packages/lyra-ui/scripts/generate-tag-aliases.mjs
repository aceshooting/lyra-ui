#!/usr/bin/env node
import { isMainModule } from './is-main-module.mjs';

// Verifies the stable, tag-shaped component entry points such as
// `@aceshooting/lyra-ui/components/lr-input.js`. Each `src/components/lr-<tag>.ts` is the one
// authored registration module for its tag: it re-exports the side-effect-free class module and
// defines the element, independent of the component's family/folder layout. The inventory names it
// as the tag's `registrationModule`; this step checks that every inventory tag has exactly that
// entry, that the entry registers its tag, and that no tag-shaped entry is orphaned.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));
const TAG_PATTERN = /^lr-[a-z][a-z0-9-]*$/u;

function invariant(condition, message) {
  if (!condition) throw new Error(`Invalid tag-entry inventory: ${message}`);
}

/** Derives the deterministic entry list from component inventory data. */
export function deriveTagAliases(inventory) {
  invariant(inventory?.schemaVersion === 1, 'schemaVersion must be 1');
  invariant(Array.isArray(inventory.components), 'components must be an array');

  const seenTags = new Set();
  const aliases = inventory.components.map((component) => {
    invariant(TAG_PATTERN.test(component?.tag), 'every component needs a valid lr-* tag');
    invariant(!seenTags.has(component.tag), `duplicate tag ${component.tag}`);
    seenTags.add(component.tag);
    const sourceFile = `src/components/${component.tag}.ts`;
    invariant(
      component.registrationModule === sourceFile,
      `${component.tag}: invalid registrationModule (expected ${sourceFile})`,
    );
    return {
      tag: component.tag,
      registrationModule: component.registrationModule,
      sourceFile,
      exportPath: `./components/${component.tag}.js`,
      distFile: `dist/components/${component.tag}.js`,
    };
  });

  return aliases.sort((left, right) => left.tag.localeCompare(right.tag));
}

/** True when `source` registers `tag` through the prefix-aware `defineElement()` helper. */
export function registersTag(source, tag) {
  const localName = tag.slice('lr-'.length);
  return new RegExp(`\\bdefineElement\\(\\s*'${localName}'\\s*,`, 'u').test(source);
}

function readInventory(packageDir) {
  return JSON.parse(
    readFileSync(path.join(packageDir, 'scripts', 'fixtures', 'component-inventory.json'), 'utf8'),
  );
}

function existingEntryFiles(packageDir) {
  const componentDir = path.join(packageDir, 'src', 'components');
  if (!existsSync(componentDir)) return [];
  return readdirSync(componentDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^lr-[a-z0-9-]+\.ts$/u.test(entry.name))
    .map((entry) => `src/components/${entry.name}`)
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Returns every missing, non-registering or orphaned tag-shaped entry. The entries are authored
 * registration modules, so this never writes; `check` is accepted for command symmetry.
 */
export function generateTagAliases({ packageDir = defaultPackageDir } = {}) {
  const aliases = deriveTagAliases(readInventory(packageDir));
  const expected = new Set(aliases.map((alias) => alias.sourceFile));
  const stale = [];

  for (const alias of aliases) {
    const file = path.join(packageDir, alias.sourceFile);
    const source = existsSync(file) ? readFileSync(file, 'utf8') : undefined;
    if (source === undefined || !registersTag(source, alias.tag)) stale.push(alias.sourceFile);
  }
  for (const file of existingEntryFiles(packageDir)) {
    if (!expected.has(file)) stale.push(file);
  }

  return { aliases, stale: [...new Set(stale)].sort() };
}

function main() {
  const { aliases, stale } = generateTagAliases();
  if (stale.length > 0) {
    console.error(
      'Tag-shaped component entries are missing, do not register their tag, or have no inventory ' +
        `component (${stale.length}):\n${stale.map((file) => `  - ${file}`).join('\n')}`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`Tag-shaped component entries are complete (${aliases.length} entries).`);
}

if (isMainModule(import.meta.url)) main();
