// Guards against the exact bug class that has already hit this repo twice:
// a component ships a public support type/interface but the root barrel
// (src/lyra.ts) never re-exports it. Unlike a hand-curated compile-check tuple,
// this script derives the closure from each class's public signatures, follows
// references into support modules and type-only re-exports, then resolves the
// real ES-module export graph rooted at lyra.ts.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  collectPublicSupportTypes,
  missingPublicSupportTypes,
} from './public-type-reachability.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = path.join(packageDir, 'src', 'components');
const rootBarrelPath = path.join(packageDir, 'src', 'lyra.ts');
const allowlistPath = path.join(packageDir, 'src', 'internal', 'root-registration-allowlist.ts');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

// --- Step 1: retain the direct EventMap census for its duplicate-name invariant. ---

const EVENT_MAP_DECLARATION_RE = /^export interface (Lyra\w*EventMap)\b/gm;

const classFiles = walk(componentsDir).filter((file) => file.endsWith('.class.ts'));
if (classFiles.length < 80) {
  throw new Error(`expected pure class modules for the component families, found ${classFiles.length}`);
}

/** @type {{ name: string, file: string }[]} */
const declaredEventMaps = [];
for (const file of classFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(EVENT_MAP_DECLARATION_RE)) {
    declaredEventMaps.push({ name: match[1], file });
  }
}

const declaredNames = new Set(declaredEventMaps.map((entry) => entry.name));
const duplicates = declaredEventMaps
  .map((entry) => entry.name)
  .filter((name, index, names) => names.indexOf(name) !== index);
if (duplicates.length) {
  throw new Error(`duplicate EventMap interface name(s) declared in more than one module: ${[...new Set(duplicates)].join(', ')}`);
}

// --- Step 2: resolve the real export graph reachable from src/lyra.ts. ---
// A TS module specifier like './components/foo/foo.js' points at the *source*
// file 'foo.ts' on disk (this repo imports with `.js` extensions per NodeNext
// resolution, but nothing is compiled yet when this script runs). We resolve
// each relative specifier to its `.ts` file (or `<dir>/index.ts`) and recurse
// into it the same way `tsc`/a bundler would when asked "what does this module
// export": local declarations are exported directly; `export { A, B as C }
// from '...'` and `export type { ... } from '...'` introduce the (possibly
// aliased) local names directly, without needing to also verify the target
// re-exports them; `export * from '...'` transitively pulls in everything the
// target module itself exports -- which is exactly the shape used by the
// per-component wrapper files (`foo.ts` doing `export * from './foo.class.js'`)
// and by the handful of `export * from './components/x/x.js'` lines in
// lyra.ts itself for the newest component families.

const DIRECT_DECLARATION_RE =
  /^export\s+(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:interface|type|class|function|const|let|enum)\s+(\w+)/gm;
const NAMED_EXPORT_RE = /^export\s+(?:type\s+)?\{([^}]*)\}\s*(?:from\s+['"]([^'"]+)['"])?\s*;/gm;
const WILDCARD_EXPORT_RE = /^export\s+(?:type\s+)?\*\s+from\s+['"]([^'"]+)['"]\s*;?/gm;
const NAMESPACE_EXPORT_RE = /^export\s+\*\s+as\s+\w+\s+from/gm;

function resolveModuleFile(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // not a relative import; nothing on disk to follow
  const withoutExt = spec.replace(/\.[jt]s$/, '');
  const base = path.resolve(path.dirname(fromFile), withoutExt);
  const candidates = [`${base}.ts`, path.join(base, 'index.ts')];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function parseNamedExportEntry(entry) {
  const trimmed = entry.trim().replace(/^type\s+/, '');
  if (!trimmed) return null;
  const asMatch = trimmed.match(/^(\S+)\s+as\s+(\S+)$/);
  return asMatch ? asMatch[2] : trimmed;
}

const unresolvableSpecs = [];
const exportsCache = new Map();

function getExportedNames(filePath, stack) {
  const resolved = path.resolve(filePath);
  if (exportsCache.has(resolved)) return exportsCache.get(resolved);
  if (stack.has(resolved)) return new Set(); // defend against re-export cycles
  stack.add(resolved);

  const source = fs.readFileSync(resolved, 'utf8');
  const names = new Set();

  for (const match of source.matchAll(DIRECT_DECLARATION_RE)) names.add(match[1]);

  for (const match of source.matchAll(NAMED_EXPORT_RE)) {
    for (const entry of match[1].split(',')) {
      const name = parseNamedExportEntry(entry);
      if (name) names.add(name);
    }
  }

  const namespaceReExports = [...source.matchAll(NAMESPACE_EXPORT_RE)];
  if (namespaceReExports.length) {
    unresolvableSpecs.push(`${path.relative(packageDir, resolved)}: uses \`export * as X from '...'\`, which this checker cannot resolve`);
  }

  for (const match of source.matchAll(WILDCARD_EXPORT_RE)) {
    const target = resolveModuleFile(resolved, match[1]);
    if (!target) {
      unresolvableSpecs.push(`${path.relative(packageDir, resolved)}: \`export * from '${match[1]}'\` does not resolve to a source file`);
      continue;
    }
    for (const name of getExportedNames(target, stack)) names.add(name);
  }

  stack.delete(resolved);
  exportsCache.set(resolved, names);
  return names;
}

const rootBarrelExports = getExportedNames(rootBarrelPath, new Set());

// --- Step 3: cross-reference every declared support type against the barrel's export graph. ---

const errors = [];
const publicSupportTypes = collectPublicSupportTypes({ packageDir });
for (const entry of missingPublicSupportTypes(publicSupportTypes, rootBarrelExports)) {
  errors.push(
    `${path.relative(packageDir, entry.file)}: public support type \`${entry.name}\` (reached from ` +
      `${entry.referencedBy}) is not re-exported by src/lyra.ts`,
  );
}

for (const message of unresolvableSpecs) errors.push(message);

// --- Sanity cross-check against the optional-peer allowlist. ---
// Components in ROOT_BARREL_OPTIONAL_PEER_TAGS (chart/map/graph/geojson-view
// and friends) are deliberately NOT side-effect-imported/registered by the
// root barrel so importing it stays free of optional peer dependencies -- but
// per the current convention (see `LyraGeojsonViewEventMap`,
// `LyraChartEventMap`, `LyraMapEventMap`, `LyraGraphEventMap`,
// `LyraLiteChartEventMap` in src/lyra.ts) their EventMap *types* are still
// exported directly. The loop above already enforces that generically; this
// just confirms the allowlist file itself parses so a future rename of the
// exported const doesn't silently stop this cross-check from meaning anything.
const allowlistSource = fs.readFileSync(allowlistPath, 'utf8');
const optionalPeerBlock = allowlistSource.match(/ROOT_BARREL_OPTIONAL_PEER_TAGS\s*=\s*\[([\s\S]*?)\]\s*as const/);
if (!optionalPeerBlock) {
  errors.push('src/internal/root-registration-allowlist.ts must define ROOT_BARREL_OPTIONAL_PEER_TAGS');
}

if (errors.length) {
  console.error(`Lyra public-type barrel reachability check failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):\n`);
  console.error(errors.map((message) => `  - ${message}`).join('\n'));
  console.error(
    '\nEvery exported type/interface in a component public signature or type-only class-module re-export ' +
      'must be reachable from src/lyra.ts, ' +
      "either as a direct named `export type { ... }` or transitively through an `export * from '...'` chain " +
      '(lyra.ts -> the component\'s own wrapper file -> its `.class.ts`). Add the missing export to src/lyra.ts.',
  );
  process.exitCode = 1;
} else {
  console.log(
    `Lyra public-type barrel reachability check passed: ${publicSupportTypes.length} support types ` +
      `(${declaredNames.size} EventMap types) all reachable from src/lyra.ts.`,
  );
}
