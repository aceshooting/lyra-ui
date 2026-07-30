#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';

const componentsRoot = fileURLToPath(new URL('../src/components/', import.meta.url));
const localizationFile = fileURLToPath(new URL('../src/internal/localization.ts', import.meta.url));
const packageRoot = fileURLToPath(new URL('../', import.meta.url));

function parseProgram(file, source) {
  const result = parseSync(file, source);
  if (result.errors.length > 0) {
    const details = result.errors.map((error) => error.message ?? String(error)).join('\n');
    throw new SyntaxError(`${file} could not be parsed:\n${details}`);
  }
  return result.program;
}

function visitAst(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) visitAst(child, visitor);
    } else if (value && typeof value === 'object') {
      visitAst(value, visitor);
    }
  }
}

function literalString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw;
  }
  return undefined;
}

function lineAt(source, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

export function defaultStringKeys(source, file = 'localization.ts') {
  const program = parseProgram(file, source);
  let defaults;
  visitAst(program, (node) => {
    if (
      defaults ||
      node.type !== 'VariableDeclarator' ||
      node.id?.type !== 'Identifier' ||
      node.id.name !== 'DEFAULT_STRINGS' ||
      node.init?.type !== 'ObjectExpression'
    ) {
      return;
    }
    defaults = node.init;
  });
  if (!defaults) throw new Error(`${file} does not declare DEFAULT_STRINGS as an object literal`);

  const keys = new Set();
  for (const property of defaults.properties) {
    if (property.type !== 'Property' || property.computed) continue;
    const key =
      property.key.type === 'Identifier'
        ? property.key.name
        : property.key.type === 'Literal' && typeof property.key.value === 'string'
          ? property.key.value
          : undefined;
    if (key) keys.add(key);
  }
  return keys;
}

export function literalLocalizeCalls(source, file = 'component.ts') {
  const program = parseProgram(file, source);
  const calls = [];
  visitAst(program, (node) => {
    if (
      node.type !== 'CallExpression' ||
      node.callee?.type !== 'MemberExpression' ||
      node.callee.computed ||
      node.callee.property?.type !== 'Identifier' ||
      node.callee.property.name !== 'localize'
    ) {
      return;
    }
    const key = literalString(node.arguments?.[0]);
    if (key) calls.push({ key, line: lineAt(source, node.start ?? 0) });
  });
  return calls;
}

export function findMissingDefaultStrings(componentSources, localizationSource) {
  const defaults = defaultStringKeys(localizationSource);
  return componentSources
    .flatMap(({ file, source }) =>
      literalLocalizeCalls(source, file)
        .filter(({ key }) => !defaults.has(key))
        .map(({ key, line }) => ({ file, key, line })),
    )
    .sort((a, b) => a.key.localeCompare(b.key) || a.file.localeCompare(b.file) || a.line - b.line);
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(path)));
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.stories.ts')
    ) {
      files.push(path);
    }
  }
  return files;
}

async function main() {
  const files = (await sourceFiles(componentsRoot)).sort();
  const [localizationSource, ...sources] = await Promise.all([
    readFile(localizationFile, 'utf8'),
    ...files.map((file) => readFile(file, 'utf8')),
  ]);
  const componentSources = files.map((file, index) => ({
    file: relative(packageRoot, file),
    source: sources[index],
  }));
  const calls = componentSources.flatMap(({ file, source }) => literalLocalizeCalls(source, file));
  const missing = findMissingDefaultStrings(componentSources, localizationSource);
  if (missing.length > 0) {
    console.error('Literal component localize() keys missing from DEFAULT_STRINGS:');
    for (const finding of missing) {
      console.error(`- ${finding.key}: ${finding.file}:${finding.line}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`Default-string contract passed (${new Set(calls.map(({ key }) => key)).size} literal component keys).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
