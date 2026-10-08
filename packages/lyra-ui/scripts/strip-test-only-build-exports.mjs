import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSync } from 'oxc-parser';

// These private implementation helpers remain importable by source tests. They have no production
// importer, so their declarations and runtime bodies need not be emitted into the public package.
const TEST_ONLY_EXPORTS = Object.freeze({
  'internal/aria-controls': ['describeElement', 'undescribeElement'],
  'internal/converters': ['trueDefaultBooleanFromAttributeConverter'],
  'internal/deprecated-aliases': ['invertAlias'],
  'internal/dompurify-loader': ['__setDompurifyImporterForTesting'],
  'internal/text-quote': ['resolveTextQuote', 'findTextQuoteMatches'],
});

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && path.endsWith('.ts') && !path.endsWith('.test.ts') &&
      !path.endsWith('.stories.ts') && !path.includes('/fixtures/') ? [path] : [];
  });
}

function declarationName(node) {
  if (node.type === 'FunctionDeclaration' || node.type === 'TSDeclareFunction') return node.id?.name;
  if (node.type === 'VariableDeclaration' && node.declarations.length === 1) {
    return node.declarations[0].id?.name;
  }
  return undefined;
}

function assertNoOwnerReferences(file, source, names) {
  const parsed = parseSync(file, source, { sourceType: 'module', lang: 'ts' });
  const fatal = parsed.errors.filter((error) => error.severity !== 'Warning');
  if (fatal.length) throw new Error(`${file}: cannot inspect test-only source references`);
  const excluded = [...parsed.comments.map(({ start, end }) => ({ start, end }))];
  for (const name of names) {
    const declarations = parsed.program.body.filter((statement) =>
      statement.type === 'ExportNamedDeclaration' && declarationName(statement.declaration ?? {}) === name);
    if (declarations.length !== 1) throw new Error(`${file}: expected exactly one source export ${name}`);
    excluded.push({ start: declarations[0].start, end: declarations[0].end });
  }
  let visible = source;
  for (const { start, end } of excluded.sort((left, right) => right.start - left.start)) {
    visible = visible.slice(0, start) + ' '.repeat(end - start) + visible.slice(end);
  }
  for (const name of names) {
    if (new RegExp(`\\b${name}\\b`, 'u').test(visible)) {
      throw new Error(`${name} is still referenced by owning production source ${file}`);
    }
  }
}

function stripExportPlan(file, source, names) {
  const parsed = parseSync(file, source, { sourceType: 'module', lang: file.endsWith('.d.ts') ? 'dts' : 'js' });
  const fatal = parsed.errors.filter((error) => error.severity !== 'Warning');
  if (fatal.length) throw new Error(`${file}: cannot inspect test-only exports`);
  const removals = [];
  for (const statement of parsed.program.body) {
    if (statement.type !== 'ExportNamedDeclaration' || !statement.declaration) continue;
    const name = declarationName(statement.declaration);
    if (!names.includes(name)) continue;
    const preceding = parsed.comments.findLast((comment) => comment.end <= statement.start);
    const doc = preceding?.type === 'Block' && source.startsWith('/**', preceding.start) &&
      /^\s*$/u.test(source.slice(preceding.end, statement.start)) ? preceding : null;
    removals.push({ name, start: doc?.start ?? statement.start, end: statement.end });
  }
  for (const name of names) {
    if (removals.filter((removal) => removal.name === name).length !== 1) {
      throw new Error(`${file}: expected exactly one test-only export ${name}`);
    }
  }
  let updated = source;
  for (const removal of removals.sort((a, b) => b.start - a.start)) {
    updated = updated.slice(0, removal.start) + updated.slice(removal.end);
  }
  return updated;
}

/** Validate every candidate and production source reference before changing emitted files. */
export function stripTestOnlyBuildExports(packageDir, inventory = TEST_ONLY_EXPORTS) {
  const sources = sourceFiles(join(packageDir, 'src'));
  const writes = [];
  for (const [module, names] of Object.entries(inventory)) {
    const sourcePath = join(packageDir, 'src', `${module}.ts`);
    assertNoOwnerReferences(sourcePath, readFileSync(sourcePath, 'utf8'), names);
    for (const name of names) {
      const reference = new RegExp(`\\b${name}\\b`, 'u');
      for (const file of sources) {
        if (file === sourcePath) continue;
        if (reference.test(readFileSync(file, 'utf8'))) {
          throw new Error(`${name} is now referenced by production source ${file}`);
        }
      }
    }
    for (const extension of ['.js', '.d.ts']) {
      const file = join(packageDir, 'dist', `${module}${extension}`);
      const body = readFileSync(file, 'utf8');
      writes.push([file, stripExportPlan(file, body, names)]);
    }
  }
  for (const [file, body] of writes) writeFileSync(file, body);
  return { files: writes.length, exports: Object.values(inventory).flat().length };
}
