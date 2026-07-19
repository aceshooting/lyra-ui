#!/usr/bin/env node
/**
 * One-time codemod: moves every packages/lyra-ui/src/components/<name>/ directory to
 * src/components/<family>/<name>/ per scripts/component-families.json, rewriting every
 * relative import that crosses the new nesting boundary.
 *
 * Two passes, in this exact order, so every rewrite is computed against a stable, still-flat
 * filesystem layout before anything physically moves:
 *   1. For every .ts file anywhere under src/components (any depth -- some components nest a
 *      fixtures/ subfolder), resolve each relative import against the file's CURRENT location,
 *      compute where that same file will live POST-move, and rewrite the import spec to the new
 *      relative path. Written back in place, pre-move.
 *   2. Physically move each src/components/<name> directory (whole subtree, one rename each) to
 *      src/components/<family>/<name>.
 *
 * Run once: `node scripts/restructure-components.mjs`. This script does no verification of its
 * own -- follow it with `tsc --noEmit` and the full test suite.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname, basename, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const srcRoot = join(packageRoot, 'src');
const componentsRoot = join(srcRoot, 'components');
const { directories: dirToFamily } = JSON.parse(
  readFileSync(join(packageRoot, 'scripts', 'component-families.json'), 'utf8'),
);

function newComponentDir(name) {
  const family = dirToFamily[name];
  if (!family) throw new Error(`no family assigned for src/components/${name} -- update scripts/component-families.json`);
  return join(componentsRoot, family, name);
}

/** Where a directory will live post-move -- unchanged for anything outside src/components/
 *  entirely (src/internal, src/ai, src/ itself, ...); shifted one level deeper under its
 *  family for anything inside it (any depth, e.g. a nested fixtures/ subfolder moves with its
 *  owning component). */
function newDirFor(dir) {
  const relFromComponents = relative(componentsRoot, dir);
  if (relFromComponents === '' || relFromComponents.startsWith('..')) return dir;
  const [name, ...rest] = relFromComponents.split(sep);
  return join(newComponentDir(name), ...rest);
}

function walkTsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTsFiles(p));
    else if (entry.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

// Matches `import '...'`, `import x from '...'`, `import type x from '...'`, `export * from '...'`,
// and `import('...')`  -- anything with a relative-path string literal after `import`/`from`.
const IMPORT_SPEC_RE = /(from\s+|import\s*\(?\s*)(['"])(\.[^'"]+)\2/g;

// Every .ts file under src/ is a rewrite candidate, not just files inside src/components/ --
// the root barrel (src/lyra.ts), src/performance.test.ts, src/ai/*.ts, and a handful of
// src/internal/*.ts files all hold their own '../components/<name>/...' references into the
// directories this codemod is about to move, even though those files' own locations don't move.
function rewriteImportsInFile(filePath) {
  const oldFileDir = dirname(filePath);
  const newFileDir = newDirFor(oldFileDir);

  const src = readFileSync(filePath, 'utf8');
  const next = src.replace(IMPORT_SPEC_RE, (match, prefix, quote, spec) => {
    const oldTargetAbs = resolve(oldFileDir, spec);
    const newTargetAbs = join(newDirFor(dirname(oldTargetAbs)), basename(oldTargetAbs));
    let newSpec = relative(newFileDir, newTargetAbs).split(sep).join('/');
    if (!newSpec.startsWith('.')) newSpec = './' + newSpec;
    if (newSpec === spec) return match;
    return `${prefix}${quote}${newSpec}${quote}`;
  });
  if (next !== src) writeFileSync(filePath, next);
}

const allFiles = walkTsFiles(srcRoot);
for (const file of allFiles) rewriteImportsInFile(file);

let moved = 0;
for (const name of Object.keys(dirToFamily)) {
  const from = join(componentsRoot, name);
  const to = newComponentDir(name);
  mkdirSync(dirname(to), { recursive: true });
  renameSync(from, to);
  moved++;
}

console.log(`Rewrote imports in ${allFiles.length} files and moved ${moved} component directories.`);
