#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { isMainModule } from './is-main-module.mjs';
const packageDir = fileURLToPath(new URL('..', import.meta.url));
const outputPath = 'src/internal/scoped-definitions.generated.ts';
const quote = (value) => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

/** The registration graph is the single authority for each root's transitive closure. */
export function generateScopedDefinitions(manifest, graph) {
  const classes = new Map();
  for (const module of manifest.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (!declaration.tagName || !declaration.customElement || declaration.kind !== 'class') continue;
      if (!/^src\/components\/[a-z\d/-]+\.class\.ts$/.test(module.path)
        || !/^[A-Za-z_$][A-Za-z\d_$]*$/.test(declaration.name)) {
        throw new Error(`Invalid scoped class module: ${module.path}`);
      }
      if (classes.has(declaration.tagName)) throw new Error(`Duplicate scoped tag ${declaration.tagName}`);
      classes.set(declaration.tagName, { name: declaration.name, path: `../${module.path.slice(4).replace(/\.ts$/, '.js')}` });
    }
  }
  const entries = [...graph.entries].sort((a, b) => a.tag.localeCompare(b.tag));
  const tags = new Set();
  for (const entry of entries) {
    if (!classes.has(entry.tag)) throw new Error(`Missing scoped class for ${entry.tag}`);
    if (tags.has(entry.tag)) throw new Error(`Duplicate scoped registration ${entry.tag}`);
    tags.add(entry.tag);
    for (const tag of entry.registers) if (!classes.has(tag)) throw new Error(`Missing scoped dependency ${tag}`);
  }
  return [
    '// GENERATED FILE — do not edit. Regenerate with pnpm run scoped-definitions.',
    "import type { LyraScopedElementConstructor } from '../utilities/scoped-registry.js';",
    '',
    'export const scopedDefinitionLoaders: Readonly<Record<string, () => Promise<LyraScopedElementConstructor>>> = Object.freeze({',
    ...[...classes].filter(([tag]) => tags.has(tag)).sort(([a], [b]) => a.localeCompare(b)).map(([tag, declaration]) =>
      `  ${quote(tag)}: () => import(${quote(declaration.path)}).then((module) => module.${declaration.name}),`),
    '});',
    '',
    'export const scopedDefinitionClosures: Readonly<Record<string, readonly string[]>> = Object.freeze({',
    ...entries.map((entry) => `  ${quote(entry.tag)}: [${[...new Set([entry.tag, ...entry.registers])].sort().map(quote).join(', ')}],`),
    '});',
    '',
  ].join('\n');
}

export function generate({ check = false } = {}) {
  const manifest = JSON.parse(readFileSync(path.join(packageDir, 'custom-elements.json'), 'utf8'));
  const graph = JSON.parse(readFileSync(path.join(packageDir, 'registrations.json'), 'utf8'));
  const output = generateScopedDefinitions(manifest, graph);
  const target = path.join(packageDir, outputPath);
  if (check) {
    let actual;
    try { actual = readFileSync(target, 'utf8'); } catch { actual = ''; }
    if (actual !== output) throw new Error(`${outputPath} is stale; run pnpm run scoped-definitions.`);
  } else writeFileSync(target, output);
  return output;
}
if (isMainModule(import.meta.url)) {
  generate({ check: process.argv.includes('--check') });
  console.log('Scoped class definitions and dependency closures are current.');
}
