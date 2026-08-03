#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';
import { literalLocalizeCalls } from './check-default-strings.mjs';

const defaultPackageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const IMPORT_START = '// GENERATED DEFAULT-STRING SLICE IMPORT: START';
const IMPORT_END = '// GENERATED DEFAULT-STRING SLICE IMPORT: END';
const CLASS_START = '  // GENERATED DEFAULT-STRING SLICE: START';
const CLASS_END = '  // GENERATED DEFAULT-STRING SLICE: END';

function parseProgram(file, source) {
  const result = parseSync(file, source);
  if (result.errors.length > 0) {
    throw new SyntaxError(
      `${file} could not be parsed:\n${result.errors.map((error) => error.message ?? String(error)).join('\n')}`,
    );
  }
  return result.program;
}

function visitAst(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) for (const child of value) visitAst(child, visitor);
    else if (value && typeof value === 'object') visitAst(value, visitor);
  }
}

function literalString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw;
  }
  return undefined;
}

function propertyName(property) {
  if (property?.computed) return undefined;
  if (property?.key?.type === 'Identifier') return property.key.name;
  if (property?.key?.type === 'Literal' && typeof property.key.value === 'string') {
    return property.key.value;
  }
  return undefined;
}

export function catalogEntries(source, file = 'localization.ts') {
  const program = parseProgram(file, source);
  let object;
  visitAst(program, (node) => {
    if (
      !object &&
      node.type === 'VariableDeclarator' &&
      node.id?.type === 'Identifier' &&
      node.id.name === 'DEFAULT_STRINGS' &&
      node.init?.type === 'ObjectExpression'
    ) {
      object = node.init;
    }
  });
  if (!object) throw new Error(`${file} does not declare DEFAULT_STRINGS as an object literal`);
  const entries = new Map();
  for (const property of object.properties) {
    if (property.type !== 'Property') continue;
    const key = propertyName(property);
    if (!key) throw new Error(`${file}: DEFAULT_STRINGS contains an unsupported computed key`);
    if (!/^[$A-Z_a-z][$\w]*$/.test(key)) {
      throw new Error(`${file}: default-string key ${JSON.stringify(key)} is not an identifier`);
    }
    if (entries.has(key)) throw new Error(`${file}: duplicate DEFAULT_STRINGS key ${key}`);
    entries.set(key, source.slice(property.value.start, property.value.end));
  }
  return entries;
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    if (entry.isFile() && entry.name.endsWith('.class.ts')) return [fullPath];
    return [];
  }));
  return nested.flat();
}

function runtimeImports(program) {
  const imports = [];
  for (const node of program.body) {
    if (typeof node.source?.value !== 'string') continue;
    if (node.type === 'ImportDeclaration') {
      if (node.importKind === 'type') continue;
      if (
        node.specifiers.length > 0 &&
        node.specifiers.every(
          (specifier) => specifier.type === 'ImportSpecifier' && specifier.importKind === 'type',
        )
      ) continue;
      imports.push(node.source.value);
      continue;
    }
    if (node.type === 'ExportNamedDeclaration') {
      if (node.exportKind === 'type') continue;
      if (
        node.specifiers.length > 0 &&
        node.specifiers.every(
          (specifier) => specifier.type === 'ExportSpecifier' && specifier.exportKind === 'type',
        )
      ) continue;
      imports.push(node.source.value);
      continue;
    }
    if (node.type === 'ExportAllDeclaration' && node.exportKind !== 'type') {
      imports.push(node.source.value);
    }
  }
  return imports;
}

function dependencyCandidates(file, specifier) {
  if (!specifier.startsWith('.')) return [];
  const absolute = path.resolve(path.dirname(file), specifier);
  if (specifier.endsWith('.js')) return [absolute.slice(0, -3) + '.ts'];
  if (specifier.endsWith('.ts')) return [absolute];
  if (path.extname(specifier)) return [];
  return [`${absolute}.ts`, path.join(absolute, 'index.ts')];
}

function isRuntimeHelper(rootFile, candidate, sourceRoot) {
  const relative = path.relative(sourceRoot, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
  if (
    candidate.endsWith('.test.ts') ||
    candidate.endsWith('.stories.ts') ||
    candidate.endsWith('.styles.ts') ||
    candidate.endsWith('default-strings.generated.ts') ||
    candidate.endsWith(path.join('internal', 'localization.ts')) ||
    candidate.endsWith(path.join('internal', 'localization-runtime.ts'))
  ) {
    return false;
  }
  return true;
}

/**
 * Collect catalog keys that can reach one component class through its authored runtime import
 * graph. Dynamic calls such as `localize(FILE_SIZE_UNIT_KEYS[unit])` do not expose a literal at
 * the call expression, so the key map in the helper module has to be considered as well. Class,
 * story, test and style imports are deliberate graph boundaries: another class owns its own
 * slice, while non-runtime sources must never pull messages into a component bundle.
 */
async function reachableCatalogKeys(rootFile, catalogKeys, sourceRoot, sourceCache) {
  const found = new Set();
  const visited = new Set();
  const visitFile = async (file) => {
    if (visited.has(file) || !isRuntimeHelper(rootFile, file, sourceRoot)) return;
    visited.add(file);
    let source;
    try {
      source = sourceCache.get(file) ?? await readFile(file, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    sourceCache.set(file, source);
    const clean = withoutGeneratedBlocks(source);
    const program = parseProgram(file, clean);
    // A class may re-export a runtime key map (attachment-chip.class.ts does this for file-size
    // units). Traverse that class's exports/imports, but do not inherit the nested component's own
    // message literals: that class owns its own generated slice.
    if (file === rootFile || !file.endsWith('.class.ts')) {
      visitAst(program, (node) => {
        const value = literalString(node);
        if (value !== undefined && catalogKeys.has(value)) found.add(value);
      });
    }
    for (const specifier of runtimeImports(program)) {
      for (const candidate of dependencyCandidates(file, specifier)) {
        await visitFile(candidate);
      }
    }
  };
  await visitFile(rootFile);
  return [...found].sort();
}

function withoutGeneratedBlocks(source) {
  const importPattern = new RegExp(
    `\\n?${IMPORT_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?` +
      `${IMPORT_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`,
    'g',
  );
  const classPattern = new RegExp(
    `\\n?${CLASS_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?` +
      `${CLASS_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`,
    'g',
  );
  return source.replace(importPattern, '').replace(classPattern, '');
}

function constantName(key) {
  return `LYRA_DEFAULT_${key}`;
}

function relativeImport(fromFile, generatedFile) {
  let specifier = path.relative(path.dirname(fromFile), generatedFile).replaceAll(path.sep, '/');
  if (!specifier.startsWith('.')) specifier = `./${specifier}`;
  return specifier.replace(/\.ts$/, '.js');
}

export function rewriteClassSource(source, file, generatedFile, keys) {
  const clean = withoutGeneratedBlocks(source);
  if (keys.length === 0) return clean;
  const program = parseProgram(file, clean);
  const exportedClassNames = new Set(
    program.body
      .filter((node) => node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'ClassDeclaration')
      .map((node) => node.declaration.id?.name)
      .filter(Boolean),
  );
  const classes = [];
  visitAst(program, (node) => {
    if (node.type !== 'ClassDeclaration' || !/^Lyra[A-Z]/.test(node.id?.name ?? '')) return;
    const classKeys = [...new Set(
      literalLocalizeCalls(clean.slice(node.start, node.end), file)
        .map(({ key }) => key),
    )].sort();
    classes.push({ node, keys: classKeys });
  });
  let classifiedKeys = [...new Set(classes.flatMap((entry) => entry.keys))].sort();
  const unclassifiedKeys = keys.filter((key) => !classifiedKeys.includes(key));
  if (unclassifiedKeys.length > 0) {
    const exported = classes.filter(({ node }) => exportedClassNames.has(node.id?.name));
    const target = exported.length === 1 ? exported[0] : classes.length === 1 ? classes[0] : undefined;
    if (target) target.keys = [...new Set([...target.keys, ...unclassifiedKeys])].sort();
  }
  classifiedKeys = [...new Set(classes.flatMap((entry) => entry.keys))].sort();
  const localizedClasses = classes.filter((entry) => entry.keys.length > 0);
  if (localizedClasses.length === 0 || classifiedKeys.join('\0') !== keys.join('\0')) {
    throw new Error(
      `${file}: could not assign every literal localize key to a Lyra class ` +
        `(file=${keys.join(',')}; classes=${classifiedKeys.join(',')})`,
    );
  }
  const importNames = keys.map(constantName);
  const importBlock =
    `${IMPORT_START}\n` +
    `import type { LyraLocaleStrings } from '${relativeImport(file, generatedFile).replace(/default-strings\.generated\.js$/, 'localization.js')}';\n` +
    `import { ${importNames.join(', ')} } from '${relativeImport(file, generatedFile)}';\n` +
    `${IMPORT_END}\n`;
  const lastImportEnd = program.body
    .filter((node) => node.type === 'ImportDeclaration')
    .at(-1)?.end ?? 0;
  let withImport = clean.slice(0, lastImportEnd) +
    `${lastImportEnd === 0 ? '' : '\n'}${importBlock}` + clean.slice(lastImportEnd);
  // The import insertion precedes the class and shifts its original body offset by exactly this
  // many characters. Insert into the freshly shifted source without reparsing or touching any
  // unrelated class text.
  const importDelta = withImport.length - clean.length;
  for (const entry of localizedClasses.sort((a, b) => b.node.body.start - a.node.body.start)) {
    const ownDefaults = entry.keys
      .map((key) => `    ${key}: ${constantName(key)},`)
      .join('\n');
    const classBlock =
      `\n${CLASS_START}\n` +
      `  /** @internal */\n` +
      `  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {\n` +
      `    ...super.defaultStrings,\n${ownDefaults}\n` +
      `  };\n${CLASS_END}\n`;
    const bodyStart = entry.node.body.start + importDelta;
    withImport = withImport.slice(0, bodyStart + 1) + classBlock + withImport.slice(bodyStart + 1);
  }
  return withImport;
}

function generatedCatalogSource(entries, usedKeys) {
  const lines = [
    '// GENERATED by scripts/generate-default-string-slices.mjs -- do not edit by hand.',
    "import type { LyraMessage } from './localization.js';",
    '',
  ];
  for (const key of usedKeys) {
    lines.push(`export const ${constantName(key)}: LyraMessage = ${entries.get(key)};`);
  }
  lines.push('');
  return lines.join('\n');
}

export async function generateDefaultStringSlices({
  packageDir = defaultPackageDir,
  write = false,
} = {}) {
  const catalogFile = path.join(packageDir, 'src', 'internal', 'localization.ts');
  const generatedFile = path.join(packageDir, 'src', 'internal', 'default-strings.generated.ts');
  const entries = catalogEntries(await readFile(catalogFile, 'utf8'), catalogFile);
  const files = (await sourceFiles(path.join(packageDir, 'src', 'components'))).sort();
  const sourceRoot = path.join(packageDir, 'src');
  const sourceCache = new Map();
  const rewrites = [];
  const allUsedKeys = new Set();
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    sourceCache.set(file, source);
    const keys = await reachableCatalogKeys(file, new Set(entries.keys()), sourceRoot, sourceCache);
    for (const key of keys) {
      if (!entries.has(key)) throw new Error(`${file}: localize key ${key} has no DEFAULT_STRINGS entry`);
      allUsedKeys.add(key);
    }
    const expected = rewriteClassSource(source, file, generatedFile, keys);
    if (expected !== source) rewrites.push({ file, source: expected });
  }
  const usedKeys = [...allUsedKeys].sort();
  const unusedKeys = [...entries.keys()].filter((key) => !allUsedKeys.has(key)).sort();
  const generated = generatedCatalogSource(entries, usedKeys);
  let actualGenerated = '';
  try {
    actualGenerated = await readFile(generatedFile, 'utf8');
  } catch {}
  const generatedChanged = actualGenerated !== generated;
  if (write) {
    await Promise.all(rewrites.map(({ file, source }) => writeFile(file, source)));
    if (generatedChanged) await writeFile(generatedFile, generated);
  }
  return {
    classFileCount: files.length,
    rewrittenFileCount: rewrites.length,
    usedKeyCount: usedKeys.length,
    unusedKeys,
    generatedChanged,
    fingerprint: createHash('sha256').update(generated).digest('hex'),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const write = process.argv.includes('--write');
  const result = await generateDefaultStringSlices({ write });
  if (!write && (result.rewrittenFileCount > 0 || result.generatedChanged)) {
    console.error(
      `Default-string slices are stale (${result.rewrittenFileCount} class files, ` +
        `${result.generatedChanged ? 'generated catalog changed' : 'catalog current'}); rerun with --write.`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Default-string slices ${write ? 'generated' : 'verified'}: ${result.usedKeyCount} keys across ` +
        `${result.classFileCount} class files (${result.fingerprint.slice(0, 12)}).`,
    );
  }
}
