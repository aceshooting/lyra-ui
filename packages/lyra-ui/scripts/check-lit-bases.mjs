// Drift guard prototype: recompute the set of class names that (transitively) extend LitElement using the
// oxc parser (AST, not regex) and compare it with both plugin base-class lists in an oxlint config.
// usage: node check-lit-bases.mjs <oxlintrc.json> <srcRoot> [<srcRoot> ...]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseSync } from 'oxc-parser';
import { parseJsonc } from './lib/jsonc.mjs';

const [configPath, ...roots] = process.argv.slice(2);

const config = parseJsonc(readFileSync(configPath, 'utf8'));

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts') && !name.endsWith('.test.ts') && !name.endsWith('.stories.ts')) yield p;
  }
}

// names the plugin's isLitClass() would test: Identifier, or (recursively) call-expression arguments
function baseNames(node) {
  if (!node) return [];
  if (node.type === 'Identifier') return [node.name];
  if (node.type === 'CallExpression') return node.arguments.flatMap(baseNames);
  return [];
}

const edges = new Map();
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(visit); return; }
  if ((node.type === 'ClassDeclaration' || node.type === 'ClassExpression') && node.id?.name) {
    const set = edges.get(node.id.name) ?? new Set();
    baseNames(node.superClass).forEach((n) => set.add(n));
    edges.set(node.id.name, set);
  }
  for (const k of Object.keys(node)) if (k !== 'parent') visit(node[k]);
}

let files = 0;
let parseErrors = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    const { program, errors } = parseSync(file, readFileSync(file, 'utf8'), { lang: 'ts' });
    if (errors.length) {
      console.error('parse errors in', file, errors.length);
      parseErrors += errors.length;
    }
    visit(program);
    files++;
  }
}
const lit = new Set(['LitElement']);
for (let changed = true; changed;) {
  changed = false;
  for (const [cls, parents] of edges) if (!lit.has(cls) && [...parents].some((p) => lit.has(p))) { lit.add(cls); changed = true; }
}
const usedAsBase = new Set();
for (const [, parents] of edges) for (const p of parents) if (lit.has(p)) usedAsBase.add(p);
usedAsBase.delete('LitElement');

const plugins = Object.fromEntries(['lit', 'wc'].map((name) => {
  const declared = new Set(config.settings?.[name]?.elementBaseClasses ?? []);
  return [name, {
    declared: declared.size,
    missing: [...usedAsBase].filter((base) => !declared.has(base)).sort(),
    stale: [...declared].filter((base) => !usedAsBase.has(base)).sort(),
  }];
}));
console.log(JSON.stringify({ files, classes: edges.size, litDerived: lit.size - 1, requiredBases: usedAsBase.size, plugins, parseErrors }, null, 1));
process.exitCode = parseErrors || Object.values(plugins).some(({ missing, stale }) => missing.length || stale.length) ? 1 : 0;
