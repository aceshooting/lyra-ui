// Guards two silent-drift classes in repository automation:
//   1. a package.json test script names a literal source path that no longer exists, and a runner
//      silently drops only that stale argument;
//   2. a packed-consumer fixture names a package subpath that no longer matches package.json#exports
//      or whose exported target has moved.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));
const LITERAL_PATH = /(?<![\w*?[\]{}])(?:src|scripts|test)\/[\w./-]+\.(?:ts|mjs|js|json|css)\b/g;

export function collectLiteralScriptPaths(scripts) {
  const entries = [];
  for (const [script, body] of Object.entries(scripts ?? {})) {
    if (typeof body !== 'string') continue;
    for (const path of body.match(LITERAL_PATH) ?? []) {
      if (!path.includes('*')) entries.push({ script, path });
    }
  }
  return entries;
}

export function extractPackageSpecifiers(source, packageName) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(['"])(?<specifier>${escaped}(?:/[a-zA-Z0-9._/-]+)?)\\1`, 'g');
  return [...new Set([...source.matchAll(pattern)].map((match) => match.groups.specifier))].sort();
}

function runtimeExportTarget(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return null;
  if (typeof value.default === 'string') return value.default;
  if (typeof value.import === 'string') return value.import;
  for (const [condition, target] of Object.entries(value)) {
    if (condition === 'types') continue;
    const resolved = runtimeExportTarget(target);
    if (resolved) return resolved;
  }
  return null;
}

export function resolvePackageExport(specifier, pkg) {
  if (typeof pkg?.name !== 'string' || !pkg.exports || typeof pkg.exports !== 'object') return null;
  const key = specifier === pkg.name
    ? '.'
    : specifier.startsWith(`${pkg.name}/`)
      ? `./${specifier.slice(pkg.name.length + 1)}`
      : null;
  if (!key) return null;

  if (Object.hasOwn(pkg.exports, key)) return runtimeExportTarget(pkg.exports[key]);
  for (const [pattern, value] of Object.entries(pkg.exports)) {
    const star = pattern.indexOf('*');
    if (star < 0) continue;
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue;
    const capture = key.slice(prefix.length, key.length - suffix.length);
    const target = runtimeExportTarget(value);
    return target?.replaceAll('*', capture) ?? null;
  }
  return null;
}

function sourceCandidate(packageDir, exportTarget) {
  if (!exportTarget.startsWith('./dist/')) return join(packageDir, exportTarget.replace(/^\.\//, ''));
  const sourceRelative = exportTarget
    .slice('./dist/'.length)
    .replace(/\.js$/, '.ts');
  return join(packageDir, 'src', sourceRelative);
}

export function validatePackedConsumerSpecifiers({ sources, pkg, packageDir }) {
  const errors = [];
  const specifiers = new Set();
  for (const { file, source } of sources) {
    for (const specifier of extractPackageSpecifiers(source, pkg.name)) {
      specifiers.add(specifier);
      const target = resolvePackageExport(specifier, pkg);
      if (!target) {
        errors.push(`${file}: "${specifier}" is not reachable through package.json#exports`);
        continue;
      }
      const candidate = sourceCandidate(packageDir, target);
      if (!existsSync(candidate)) {
        errors.push(`${file}: "${specifier}" resolves to missing target ${target}`);
      }
    }
  }
  return { errors: [...new Set(errors)].sort(), specifiers: [...specifiers].sort() };
}

function run(packageDir = defaultPackageDir) {
  const packageJsonPath = join(packageDir, 'package.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const errors = [];
  const paths = collectLiteralScriptPaths(pkg.scripts);
  for (const entry of paths) {
    if (!existsSync(join(packageDir, entry.path))) {
      errors.push(`scripts.${entry.script}: "${entry.path}" does not exist`);
    }
  }

  const workspaceRoot = resolve(packageDir, '..', '..');
  const packedScripts = [
    'scripts/check-packed-consumer.mjs',
    'scripts/check-packed-framework-types.mjs',
  ];
  const packedSources = [];
  for (const file of packedScripts) {
    const absolute = join(workspaceRoot, file);
    if (!existsSync(absolute)) {
      errors.push(`${file} does not exist`);
      continue;
    }
    packedSources.push({ file, source: readFileSync(absolute, 'utf8') });
  }
  const specifierResult = validatePackedConsumerSpecifiers({
    sources: packedSources,
    pkg,
    packageDir,
  });
  errors.push(...specifierResult.errors);

  if (errors.length > 0) {
    console.error(`package script/specifier check failed with ${errors.length} finding(s):\n`);
    for (const error of errors) console.error(`- ${error}`);
    console.error(
      '\nLiteral runner paths and packed-consumer package subpaths must stay synchronized with ' +
        'the source tree and package exports.',
    );
    return 1;
  }

  console.log(
    `package script/specifier check passed: ${paths.length} literal path(s) and ` +
      `${specifierResult.specifiers.length} packed-consumer package specifier(s) resolve`,
  );
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run();
}
