// Fails on any circular import among the shipped source modules (src/, excluding tests, stories
// and .d.ts). Circular imports quietly defeat tree-shaking and can scramble the side-effect
// registration order this library depends on (see check-registration-architecture.mjs /
// check-side-effects.mjs), so the gate is zero-tolerance -- consistent with the other bespoke
// contract checks, and with no third-party dependency of its own.
//
// Both static value imports AND `import type` edges count: `import type` is erased at runtime by
// verbatimModuleSyntax so a type-only cycle is harmless at execution time, but it is still a
// design smell and trivially avoided by extracting the shared type into its own leaf module (see
// tree-item.ts / emoji-types.ts). Dynamic `import()` is intentionally NOT an edge -- it is lazy by
// construction and therefore cannot form a synchronous initialization cycle.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

/** Recursively collect shipped .ts files (skip tests, stories, ambient decls). */
function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collect(full, out);
    } else if (
      entry.endsWith('.ts') &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.stories.ts') &&
      !entry.endsWith('.d.ts')
    ) {
      out.push(full);
    }
  }
  return out;
}

const files = collect(SRC);
const known = new Set(files);

/** Strip comments and string bodies so import specifiers are the only quoted text left of note. */
function stripNoise(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Resolve a relative specifier from `fromFile` to a known .ts module, or null. */
function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // bare / package import
  const base = resolve(dirname(fromFile), spec);
  const candidates = base.endsWith('.js')
    ? [base.replace(/\.js$/, '.ts')]
    : [`${base}.ts`, join(base, 'index.ts')];
  for (const c of candidates) if (known.has(c)) return c;
  return null;
}

const graph = new Map(); // file -> Set<file>
for (const file of files) {
  const code = stripNoise(readFileSync(file, 'utf8'));
  const deps = new Set();
  // `import ... from 'x'` and `export ... from 'x'` (covers `import type`, `export type`).
  for (const m of code.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) {
    const r = resolveSpec(file, m[1]);
    if (r && r !== file) deps.add(r);
  }
  // Side-effect `import 'x';` (require whitespace to avoid matching dynamic `import(`).
  for (const m of code.matchAll(/\bimport\s+['"]([^'"]+)['"]/g)) {
    const r = resolveSpec(file, m[1]);
    if (r && r !== file) deps.add(r);
  }
  graph.set(file, deps);
}

// DFS cycle detection (white/gray/black), recording each distinct cycle once.
const WHITE = 0, GRAY = 1, BLACK = 2;
const color = new Map(files.map((f) => [f, WHITE]));
const stack = [];
const cycles = [];
const seen = new Set();

function visit(node) {
  color.set(node, GRAY);
  stack.push(node);
  for (const dep of graph.get(node) ?? []) {
    if (color.get(dep) === GRAY) {
      const cyc = stack.slice(stack.indexOf(dep)).concat(dep);
      const key = [...cyc].sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        cycles.push(cyc);
      }
    } else if (color.get(dep) === WHITE) {
      visit(dep);
    }
  }
  stack.pop();
  color.set(node, BLACK);
}

for (const file of files) if (color.get(file) === WHITE) visit(file);

const rel = (f) => relative(ROOT, f);
if (cycles.length > 0) {
  console.error(`Found ${cycles.length} circular import(s) among shipped modules:\n`);
  for (const cyc of cycles) {
    console.error('  ' + cyc.map(rel).join('\n    -> '));
    console.error('');
  }
  console.error(
    'Break the cycle by extracting the shared symbol into its own leaf module (see tree-item.ts /\n' +
      'emoji-types.ts for the pattern), then re-export it from the original for the public path.',
  );
  process.exit(1);
}

console.log(`Import-cycle check passed: ${files.length} shipped modules, 0 circular imports.`);
