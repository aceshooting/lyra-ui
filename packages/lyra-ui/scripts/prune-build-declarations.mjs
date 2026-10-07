import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { parseSync } from 'oxc-parser';

function declarationFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return declarationFiles(file);
    return entry.isFile() && file.endsWith('.d.ts') ? [resolve(file)] : [];
  });
}

function within(directory, file) {
  const rel = relative(directory, file);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep);
}

function declarationTarget(file, specifier) {
  if (specifier.endsWith('.d.ts')) return resolve(dirname(file), specifier);
  if (specifier.endsWith('.js')) return resolve(dirname(file), `${specifier.slice(0, -3)}.d.ts`);
  return resolve(dirname(file), `${specifier}.d.ts`);
}

function relativeReferences(file, source) {
  const parsed = parseSync(file, source, { lang: 'dts', sourceType: 'module' });
  const fatal = parsed.errors.filter((error) => error.severity !== 'Warning');
  if (fatal.length) throw new Error(`${file}: cannot inspect declaration references: ` +
    fatal.map((error) => error.message).join('; '));
  const references = [];
  const seen = new WeakSet();
  function visit(node) {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    const literal = ['ImportDeclaration', 'ExportAllDeclaration', 'ExportNamedDeclaration'].includes(node.type)
      ? node.source
      : node.type === 'TSImportType' ? node.source
        : node.type === 'TSExternalModuleReference' ? node.expression
          : node.type === 'TSModuleDeclaration' ? node.id : null;
    if (typeof literal?.value === 'string' && literal.value.startsWith('.')) {
      references.push(literal.value);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'parent') continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(parsed.program);
  for (const match of source.matchAll(/\/\/\/\s*<reference\s+path\s*=\s*['"]([^'"]+)['"]/gu)) {
    if (match[1].startsWith('.')) references.push(match[1]);
  }
  return references;
}

function exportTargets(value) {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(exportTargets);
  return [];
}

/** Keep every declaration reachable from a published types route or a string export's JS twin. */
export function pruneUnreachableBuildDeclarations(packageDir) {
  const dist = resolve(packageDir, 'dist');
  const files = declarationFiles(dist);
  const fileSet = new Set(files);
  const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
  const roots = new Set();
  for (const target of [pkg.types, ...exportTargets(pkg.exports)]) {
    if (typeof target !== 'string' || !target.startsWith('./dist/')) continue;
    const declarationPattern = target.endsWith('.js') ? `${target.slice(0, -3)}.d.ts` : target;
    if (!declarationPattern.endsWith('.d.ts') && !declarationPattern.includes('*')) continue;
    if (declarationPattern.includes('*')) {
      const pattern = new RegExp(`^${declarationPattern.slice(2).split('*').map((part) =>
        part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('.*')}$`, 'u');
      for (const file of files) {
        if (pattern.test(relative(packageDir, file).replaceAll('\\', '/'))) roots.add(file);
      }
    } else {
      const file = resolve(packageDir, declarationPattern);
      if (!within(dist, file)) throw new Error(`declaration export escapes dist: ${target}`);
      if (fileSet.has(file)) roots.add(file);
      else if (target.endsWith('.d.ts')) throw new Error(`missing published declaration root: ${target}`);
    }
  }

  const reachable = new Set();
  const queue = [...roots];
  while (queue.length) {
    const file = queue.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);
    for (const specifier of relativeReferences(file, readFileSync(file, 'utf8'))) {
      const target = declarationTarget(file, specifier);
      if (!within(dist, target)) throw new Error(`${file}: declaration reference escapes dist: ${specifier}`);
      if (!fileSet.has(target)) {
        // CSS and other published assets may be imported only for their runtime side effect.
        const asset = resolve(dirname(file), specifier);
        if (specifier.endsWith('.css') && existsSync(asset)) continue;
        throw new Error(`${file}: unresolved relative declaration reference ${specifier}`);
      }
      queue.push(target);
    }
  }

  const removedPaths = files.filter((file) => !reachable.has(file)).sort();
  // All roots and the complete transitive reference closure were checked before this first write.
  for (const file of removedPaths) rmSync(file);
  return { kept: reachable.size, removedPaths: removedPaths.map((file) =>
    relative(packageDir, file).replaceAll('\\', '/')) };
}
