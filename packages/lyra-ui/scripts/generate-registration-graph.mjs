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
// specifiers and `defineElement(...)` call literals -- fr_IZcp_YakOYwAQKvCSqpWUg.
//
// Not folded into `custom-elements.json`: that manifest declares one custom element per FAMILY
// source module (one `LyraTable` class declaration under `src/components/data/table/`), with no
// field mapping a stable per-tag ENTRY specifier to that declaration and none for the extra tags a
// given entry's side effects register — decision 22 explicitly forbids adding fields to it for
// this.
//
// Run directly: `node scripts/generate-registration-graph.mjs` (writes), `--check` (verifies
// freshness without writing). Wired into `pnpm run registration-graph` / `check:registration-graph`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeComponentDependencies, collectSources } from './check-component-dependencies.mjs';
import { deriveTagAliases } from './generate-tag-aliases.mjs';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));

function invariant(condition, message) {
  if (!condition) throw new Error(`Invalid registration graph: ${message}`);
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
export function deriveRegistrationGraph(inventory, { packageDir = defaultPackageDir } = {}) {
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

  const entries = aliases.map((alias) => {
    const component = byTag.get(alias.tag);
    invariant(component, `${alias.tag}: missing from the component-dependency graph`);
    const registers = [
      ...new Set([alias.tag, ...component.directComponents, ...component.transitiveComponents]),
    ].sort((left, right) => left.localeCompare(right));
    return {
      tag: alias.tag,
      entry: alias.exportPath,
      registrationModule: alias.registrationModule,
      registers,
    };
  });

  return { entries, findings };
}

/** Compact single-line JSON, trailing newline -- same shape as `custom-elements.json`. */
export function renderRegistrationGraph(entries) {
  const artifact = {
    $comment:
      'Generated registration-graph metadata. For each stable per-tag entry (`entry`), `registers` '
      + 'lists every <lr-*> tag that importing it defines as a side effect: its own tag plus any '
      + "composed-child registration its registration entry pulls in transitively (e.g. lr-table.js "
      + 'also registers lr-empty/lr-pagination/lr-skeleton/lr-spinner). Run '
      + '`pnpm run registration-graph` (scripts/generate-registration-graph.mjs) to refresh.',
    schemaVersion: 1,
    entries,
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
export function checkRegistrationGraph(packageDir = defaultPackageDir) {
  const { entries, findings } = deriveRegistrationGraph(readInventory(packageDir), { packageDir });
  const expected = renderRegistrationGraph(entries);
  const path = artifactPath(packageDir);
  const stale = !existsSync(path) || readFileSync(path, 'utf8') !== expected;
  return { stale, expected, path, entries, findings };
}

export function generateRegistrationGraph(packageDir = defaultPackageDir) {
  const { entries, findings } = deriveRegistrationGraph(readInventory(packageDir), { packageDir });
  writeFileSync(artifactPath(packageDir), renderRegistrationGraph(entries));
  return { entries, findings };
}

function run(argv) {
  const unknown = argv.filter((argument) => argument !== '--check');
  if (unknown.length > 0) {
    console.error(`Unknown option(s): ${unknown.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  if (argv.includes('--check')) {
    const { stale, entries, findings, path } = checkRegistrationGraph();
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

  const { entries, findings } = generateRegistrationGraph();
  console.log(
    `Registration graph generated (${entries.length} entries, ${findings.length} component-dependency finding(s)).`,
  );
}

if (isMainModule(import.meta.url)) run(process.argv.slice(2));
