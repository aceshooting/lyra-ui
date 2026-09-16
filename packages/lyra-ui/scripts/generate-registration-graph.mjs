#!/usr/bin/env node
import { isMainModule } from './is-main-module.mjs';

// Generates the published registration-graph artifact (`registrations.json`): for every stable
// per-tag entry (`src/components/lr-*.ts`, derived the same way `generate-tag-aliases.mjs` derives
// it), the complete set of `<lr-*>` tags that importing it defines as a side effect -- its own tag
// plus every composed-child registration its registration entry pulls in transitively. Importing
// `@aceshooting/lyra-ui/components/lr-table.js` also registers `<lr-empty>`, `<lr-pagination>`,
// `<lr-skeleton>` and `<lr-spinner>`, because `table.ts` imports those siblings' own registration
// entries (not their side-effect-free `*.class.js`) before calling `defineElement('table', ...)`.
//
// The transitive-import walk is NOT reimplemented here: it reuses
// `analyzeComponentDependencies()` from `check-component-dependencies.mjs`, which already resolves
// each registration entry's full import closure (static imports, re-exports, and lazy `import()`
// alike) and already separates the tags found there into directly-imported vs. reached-only-
// transitively. This generator's only new work is translating that per-`registrationModule` graph
// onto the stable per-tag entry specifiers `generate-tag-aliases.mjs` already derives, so a
// consumer wanting to statically verify "does importing this specifier register that tag" reads
// one small generated JSON file instead of parsing shipped minified JavaScript for import
// specifiers and `defineElement(...)` call literals.
//
// Two entry shapes:
//  - Per-tag entries (one per `scripts/fixtures/component-inventory.json` component): `tag`,
//    the stable alias `entry` (`./components/lr-<tag>.js`), `registrationModule` (the `src/` path),
//    `distModule` (the same module's own published deep specifier, e.g.
//    `./components/data/table/table.js` -- useful when a caller already has that path rather than
//    the alias), `registers`, `localeKeys`.
//  - Published integration-bridge entries, for a registration specifier that installs an
//    integration (an optional-peer resolver, a lazy document-format registrar) without being any
//    single component's own per-tag alias -- `flag-peer.js`, `archive-viewer-register.js`,
//    `ebook-viewer-register.js`. These have no owning `tag` (the field is omitted, not defined to
//    `lr-` prefix rules for tags), and `entry`/`distModule` both hold the one published specifier
//    that names them, since there is no separate alias to distinguish from the underlying module.
//    Their `registers`/`localeKeys` are derived from the real transitive import closure of that
//    module -- including the lazy `import()` a document-format registrar uses to load its viewer
//    once a matching file actually appears -- never inferred from the module's file name.
//
// `localeKeys` (both shapes): the `LyraMessageKey`s reachable by every tag the entry registers,
// reusing `reachableCatalogKeys()` from `generate-default-string-slices.mjs` -- the exact per-class
// reachability walk that already derives the tree-shakeable default-string slices, dynamic-key
// (e.g. a `{ triggerKey: 'attachmentTriggerFiles' }`-shaped lookup table) fallback included. Not
// re-derived here: this generator only unions that per-class result across an entry's `registers`.
//
// Not folded into `custom-elements.json`: that manifest declares one custom element per FAMILY
// source module (one `LyraTable` class declaration under `src/components/data/table/`), with no
// field mapping a stable per-tag ENTRY specifier to that declaration and none for the extra tags a
// given entry's side effects register -- decision 22 explicitly forbids adding fields to it for
// this.
//
// Run directly: `node scripts/generate-registration-graph.mjs` (writes), `--check` (verifies
// freshness without writing). Wired into `pnpm run registration-graph` / `check:registration-graph`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';
import { analyzeComponentDependencies, collectSources, locallyRegisteredTags } from './check-component-dependencies.mjs';
import { DEFAULT_STRING_SLICE_EXCLUSIONS } from './default-string-slice-exclusions.mjs';
import { applyConfiguredExclusions, catalogEntries, reachableCatalogKeys } from './generate-default-string-slices.mjs';
import { deriveTagAliases } from './generate-tag-aliases.mjs';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));

function invariant(condition, message) {
  if (!condition) throw new Error(`Invalid registration graph: ${message}`);
}

/**
 * Published registration specifiers that are not per-tag component aliases. Each is validated
 * below against the real `package.json#exports` map and the real shipped source tree -- this list
 * only says WHICH modules to read; it never stands in for reading them.
 */
const PUBLISHED_INTEGRATION_MODULES = [
  'src/components/media/flag/flag-peer.ts',
  'src/components/viewers/archive-viewer/archive-viewer-register.ts',
  'src/components/viewers/ebook-viewer/ebook-viewer-register.ts',
].sort();

/** `src/components/<rest>.ts` -> `./components/<rest>.js`, the published deep specifier a
 *  `registrationModule` ships under in `package.json#exports` (distinct from a per-tag entry's
 *  stable alias, e.g. `./components/lr-table.js`, which re-exports it). */
function publishedSpecifierFor(registrationModule) {
  const prefix = 'src/components/';
  invariant(registrationModule.startsWith(prefix), `${registrationModule}: expected a src/components/ path`);
  return `./components/${registrationModule.slice(prefix.length).replace(/\.ts$/u, '.js')}`;
}

function parseModule(file, source) {
  const result = parseSync(file, source);
  if (result.errors.length > 0) {
    throw new Error(
      `${file}: registration-graph parser failed: ${result.errors.map((error) => error.message ?? String(error)).join('; ')}`,
    );
  }
  return result.program;
}

function visitNodes(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) for (const child of value) visitNodes(child, visitor);
    else if (value && typeof value === 'object') visitNodes(value, visitor);
  }
}

/**
 * Every relative specifier a module imports, statically or via a lazy `import()` -- the same
 * import shapes `check-component-dependencies.mjs`'s own `moduleImports()` follows (type-only
 * imports/exports excluded, a dynamic `import('literal')` or single-quasi template counted),
 * scoped down to just the specifier strings this closure walk needs.
 */
function importedSpecifiers(program) {
  const specifiers = [];
  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration' && typeof statement.source?.value === 'string') {
      if (statement.importKind === 'type') continue;
      const values = statement.specifiers.filter(
        (specifier) => specifier.type !== 'ImportSpecifier' || specifier.importKind !== 'type',
      );
      if (statement.specifiers.length > 0 && values.length === 0) continue;
      specifiers.push(statement.source.value);
    } else if (
      (statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportAllDeclaration') &&
      typeof statement.source?.value === 'string'
    ) {
      if (statement.exportKind === 'type') continue;
      if (
        statement.type === 'ExportNamedDeclaration' &&
        statement.specifiers.length > 0 &&
        statement.specifiers.every((specifier) => specifier.exportKind === 'type')
      ) continue;
      specifiers.push(statement.source.value);
    }
  }
  visitNodes(program, (node) => {
    if (node.type !== 'ImportExpression') return;
    if (node.source?.type === 'Literal' && typeof node.source.value === 'string') {
      specifiers.push(node.source.value);
    } else if (
      node.source?.type === 'TemplateLiteral' &&
      node.source.expressions.length === 0 &&
      node.source.quasis.length === 1
    ) {
      specifiers.push(node.source.quasis[0].value.cooked);
    }
  });
  return specifiers;
}

/** Resolve a relative specifier against the same virtual `files` map
 *  `check-component-dependencies.mjs` builds (`.js` -> `.ts`, plus `/index.ts`). */
function resolveRelativeSpecifier(files, fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = posix.normalize(posix.join(posix.dirname(fromFile), specifier));
  const candidates = base.endsWith('.js')
    ? [base.replace(/\.js$/u, '.ts')]
    : [base, `${base}.ts`, posix.join(base, 'index.ts')];
  for (const candidate of candidates) if (files.has(candidate)) return candidate;
  return null;
}

/**
 * The `<lr-*>` tags importing `entryFile` registers, by the same transitive-import-closure rule
 * (static imports, re-exports, and lazy `import()` alike) `check-component-dependencies.mjs` uses
 * for every inventory component's own registration entry -- exposed here for a published
 * registration specifier that is not itself one of the inventory's per-tag components (an
 * integration bridge such as an optional-peer resolver or a lazy document-format registrar).
 */
function registeredTagsFrom(entryFile, { files, registrationByModule, knownTags }) {
  const seen = new Set([entryFile]);
  const queue = [entryFile];
  const registered = new Set();
  while (queue.length > 0) {
    const file = queue.pop();
    const source = files.get(file);
    invariant(source !== undefined, `${entryFile}: ${file} is not part of the shipped source tree`);
    const tag = registrationByModule.get(file);
    if (tag) registered.add(tag);
    for (const local of locallyRegisteredTags(source, file)) {
      if (knownTags.has(local)) registered.add(local);
    }
    for (const specifier of importedSpecifiers(parseModule(file, source))) {
      const resolved = resolveRelativeSpecifier(files, file, specifier);
      if (!resolved || seen.has(resolved)) continue;
      seen.add(resolved);
      queue.push(resolved);
    }
  }
  return [...registered].sort((left, right) => left.localeCompare(right));
}

/**
 * `{ entries, findings }` for the real component tree under `packageDir`. `findings` are
 * `analyzeComponentDependencies`'s own component-dependency findings, forwarded rather than
 * swallowed: `check:component-dependencies` is the gate that fails the build on them, this
 * generator only lets a caller (the test suite, `checkRegistrationGraph`) see what it saw while
 * deriving the graph, rather than silently trusting a possibly-incomplete registration entry.
 *
 * @param {{schemaVersion: 1, components: Array<{tag: string, classModule: string,
 *   registrationModule: string}>}} inventory
 */
export async function deriveRegistrationGraph(inventory, { packageDir = defaultPackageDir } = {}) {
  invariant(inventory?.schemaVersion === 1, 'schemaVersion must be 1');
  invariant(Array.isArray(inventory.components), 'components must be an array');

  const components = inventory.components.map(({ tag, classModule, registrationModule }) => ({
    tag,
    classModule,
    registrationModule,
  }));
  const files = collectSources(join(packageDir, 'src'), new Map());
  const { findings, graph } = analyzeComponentDependencies({ components, files });
  const byTag = new Map(graph.map((component) => [component.tag, component]));
  const aliases = deriveTagAliases(inventory);

  const registrationByModule = new Map(components.map((component) => [component.registrationModule, component.tag]));
  const knownTags = new Set(components.map((component) => component.tag));
  const classModuleByTag = new Map(components.map((component) => [component.tag, component.classModule]));
  const packageJson = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));

  const catalogFile = join(packageDir, 'src', 'internal', 'localization.ts');
  const catalogKeys = new Set(catalogEntries(readFileSync(catalogFile, 'utf8'), catalogFile).keys());
  const sourceRoot = join(packageDir, 'src');
  const sourceCache = new Map();
  const localeKeysByTag = new Map();
  async function localeKeysForTag(tag) {
    if (localeKeysByTag.has(tag)) return localeKeysByTag.get(tag);
    const promise = (async () => {
      const classModule = classModuleByTag.get(tag);
      invariant(classModule, `${tag}: missing classModule for locale-key reachability`);
      const file = join(packageDir, classModule);
      const source = files.get(classModule);
      invariant(source !== undefined, `${classModule}: missing from the shipped source tree`);
      const discovered = await reachableCatalogKeys(file, catalogKeys, sourceRoot, sourceCache);
      // Same conservative-discovery-then-validated-exclusion narrowing
      // generateDefaultStringSlices() applies to its own per-class slice, so `localeKeys` matches
      // the keys the registered class's real `defaultStrings` block ships, not the more
      // conservative raw whole-graph walk.
      return applyConfiguredExclusions({
        packageDir,
        file,
        source,
        keys: discovered,
        catalogKeys,
        exclusions: DEFAULT_STRING_SLICE_EXCLUSIONS,
      });
    })();
    localeKeysByTag.set(tag, promise);
    return promise;
  }
  async function localeKeysForRegisters(registers) {
    const perTag = await Promise.all(registers.map((tag) => localeKeysForTag(tag)));
    return [...new Set(perTag.flat())].sort((left, right) => left.localeCompare(right));
  }

  function assertPublished(specifier) {
    invariant(packageJson.exports?.[specifier] !== undefined, `${specifier}: not a published package.json#exports entry`);
  }

  const entries = await Promise.all(
    aliases.map(async (alias) => {
      const component = byTag.get(alias.tag);
      invariant(component, `${alias.tag}: missing from the component-dependency graph`);
      const registers = [
        ...new Set([alias.tag, ...component.directComponents, ...component.transitiveComponents]),
      ].sort((left, right) => left.localeCompare(right));
      const distModule = publishedSpecifierFor(alias.registrationModule);
      assertPublished(distModule);
      const localeKeys = await localeKeysForRegisters(registers);
      return {
        tag: alias.tag,
        entry: alias.exportPath,
        registrationModule: alias.registrationModule,
        distModule,
        registers,
        localeKeys,
      };
    }),
  );

  const integrationEntries = await Promise.all(
    PUBLISHED_INTEGRATION_MODULES.map(async (registrationModule) => {
      invariant(
        !registrationByModule.has(registrationModule),
        `${registrationModule}: already a per-tag registrationModule, not an integration bridge`,
      );
      invariant(files.has(registrationModule), `${registrationModule}: missing from the shipped source tree`);
      const distModule = publishedSpecifierFor(registrationModule);
      assertPublished(distModule);
      const registers = registeredTagsFrom(registrationModule, { files, registrationByModule, knownTags });
      invariant(registers.length > 0, `${registrationModule}: registers nothing -- confirm it is really a registration bridge`);
      const localeKeys = await localeKeysForRegisters(registers);
      return {
        entry: distModule,
        registrationModule,
        distModule,
        registers,
        localeKeys,
      };
    }),
  );
  integrationEntries.sort((left, right) => left.entry.localeCompare(right.entry));

  // Integration bridges are kept OUT of `entries`. Every `entries` member has always carried a
  // `tag`, and a reader written against the first shape of this artifact keys by it; mixing in
  // tag-less rows would silently hand such a reader `undefined`. A separate array is additive, so
  // the schema stays at version 1.
  return { entries, integrations: integrationEntries, findings };
}

/** Compact single-line JSON, trailing newline -- same shape as `custom-elements.json`. */
export function renderRegistrationGraph(entries, integrations = []) {
  const artifact = {
    $comment:
      'Generated registration-graph metadata. `entries` has one row per stable alias '
      + '`./components/lr-<tag>.js`, always carrying `tag`. `integrations` lists the published '
      + 'integration-bridge specifiers -- an optional-peer resolver, a lazy document-format '
      + 'registrar -- that install an integration without being any single component\'s own '
      + 'alias, so they carry no `tag`. For every row, `registers` lists every <lr-*> tag that '
      + 'importing `entry` defines as a side effect, direct or transitive (e.g. lr-table.js also '
      + 'registers lr-empty/lr-pagination/lr-skeleton/lr-spinner); `distModule` is that '
      + 'registration module\'s own published deep specifier (equal to `entry` for an integration '
      + 'bridge); `localeKeys` lists every LyraMessageKey the registered tags can reach, from the '
      + 'same reachability analysis generate-default-string-slices.mjs uses for the tree-shakeable '
      + 'locale slices. `integrations`, `distModule` and `localeKeys` are additive to schema '
      + 'version 1. Run `pnpm run registration-graph` (scripts/generate-registration-graph.mjs) to '
      + 'refresh.',
    schemaVersion: 1,
    entries,
    integrations,
  };
  return `${JSON.stringify(artifact)}\n`;
}

function artifactPath(packageDir) {
  return join(packageDir, 'registrations.json');
}

function readInventory(packageDir) {
  return JSON.parse(
    readFileSync(join(packageDir, 'scripts', 'fixtures', 'component-inventory.json'), 'utf8'),
  );
}

/** `{ stale, expected, path, entries, findings }` without writing anything. */
export async function checkRegistrationGraph(packageDir = defaultPackageDir) {
  const { entries, integrations, findings } = await deriveRegistrationGraph(readInventory(packageDir), { packageDir });
  const expected = renderRegistrationGraph(entries, integrations);
  const path = artifactPath(packageDir);
  const stale = !existsSync(path) || readFileSync(path, 'utf8') !== expected;
  return { stale, expected, path, entries, integrations, findings };
}

export async function generateRegistrationGraph(packageDir = defaultPackageDir) {
  const { entries, integrations, findings } = await deriveRegistrationGraph(readInventory(packageDir), { packageDir });
  writeFileSync(artifactPath(packageDir), renderRegistrationGraph(entries, integrations));
  return { entries, integrations, findings };
}

async function run(argv) {
  const unknown = argv.filter((argument) => argument !== '--check');
  if (unknown.length > 0) {
    console.error(`Unknown option(s): ${unknown.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  if (argv.includes('--check')) {
    const { stale, entries, findings, path } = await checkRegistrationGraph();
    if (stale) {
      console.error(`${path} is stale; run \`pnpm run registration-graph\`.`);
      process.exitCode = 1;
      return;
    }
    console.log(
      `Registration graph is fresh (${entries.length} entries, ${findings.length} component-dependency finding(s)).`,
    );
    return;
  }

  const { entries, findings } = await generateRegistrationGraph();
  console.log(
    `Registration graph generated (${entries.length} entries, ${findings.length} component-dependency finding(s)).`,
  );
}

if (isMainModule(import.meta.url)) await run(process.argv.slice(2));
