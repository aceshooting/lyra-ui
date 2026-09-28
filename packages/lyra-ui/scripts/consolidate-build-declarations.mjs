import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parseSync } from 'oxc-parser';
import { deriveLocaleDeclarationExports, EMPTY_DECLARATION, localeDeclarationModules } from './declaration-entrypoints.mjs';

function invariant(condition, message) {
  if (!condition) throw new Error(`Declaration consolidation: ${message}`);
}

function parse(file, source) {
  const parsed = parseSync(file, source);
  invariant(parsed.errors.length === 0, `cannot parse ${file}`);
  return parsed.program;
}

function declarationTarget(file, specifier) {
  return resolve(dirname(file), specifier.replace(/\.js$/, '.d.ts'));
}

/** Consolidate only proven equivalent declaration entry points; runtime files are never changed. */
export function consolidateBuildDeclarations(packageDir) {
  const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
  const inventory = JSON.parse(readFileSync(join(packageDir, 'scripts/fixtures/component-inventory.json'), 'utf8'));
  const empty = resolve(packageDir, EMPTY_DECLARATION);
  const redirects = new Map();
  const locales = new Set(localeDeclarationModules(packageDir).map((module) => resolve(packageDir, `dist/translations/${module}.d.ts`)));
  for (const [route, target] of Object.entries(deriveLocaleDeclarationExports(packageDir))) {
    invariant(JSON.stringify(pkg.exports[route]) === JSON.stringify(target), `stale locale export ${route}; regenerate package exports`);
  }
  for (const file of locales) redirects.set(file, empty);
  for (const component of inventory.components) {
    const file = resolve(packageDir, `dist/components/${component.tag}.d.ts`);
    const target = resolve(packageDir, component.registrationModule.replace(/^src\//, 'dist/').replace(/\.ts$/, '.d.ts'));
    const route = pkg.exports[`./components/${component.tag}.js`];
    invariant(route?.types === `./${relative(packageDir, target).replaceAll('\\', '/')}` && route.default === `./dist/components/${component.tag}.js`, `stale alias export ${component.tag}`);
    invariant(existsSync(target), `missing registration declaration ${target}`);
    redirects.set(file, target);
  }

  // Validate every candidate before changing any file. A future public catalog export must not
  // silently disappear merely because its source lives beside today's side-effect catalogs.
  for (const [file, target] of redirects) {
    if (!existsSync(file)) {
      invariant(existsSync(empty), `missing declaration ${file}`);
      continue;
    }
    const body = parse(file, readFileSync(file, 'utf8')).body;
    if (locales.has(file)) {
      invariant(body.every((node) =>
        (node.type === 'ExportNamedDeclaration' && node.declaration === null && node.specifiers.length === 0 && node.source === null) ||
        (node.type === 'ImportDeclaration' && node.specifiers.length === 0 && node.source.value.startsWith('.') && locales.has(declarationTarget(file, node.source.value)))
      ), `catalog has a public declaration or external side effect: ${file}`);
    } else {
      invariant(body.length === 1 && body[0].type === 'ExportAllDeclaration' && !body[0].exported && body[0].source.value.startsWith('.') && declarationTarget(file, body[0].source.value) === target, `alias is not a transparent re-export: ${file}`);
    }
  }

  const rewrites = [];
  function visitDirectory(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) visitDirectory(file);
      else if (entry.name.endsWith('.d.ts') && !redirects.has(file) && file !== empty) {
        const source = readFileSync(file, 'utf8');
        const edits = [];
        for (const reference of source.matchAll(/\/\/\/\s*<reference\s+path\s*=\s*['"]([^'"]+)['"]/g)) {
          invariant(!redirects.has(declarationTarget(file, reference[1])), `unsupported reference path in ${file}`);
        }
        function visit(node) {
          if (!node || typeof node !== 'object') return;
          if (node.type === 'TSModuleDeclaration' && typeof node.id?.value === 'string' && node.id.value.startsWith('.')) {
            invariant(!redirects.has(declarationTarget(file, node.id.value)), `unsupported module augmentation in ${file}`);
          }
          // Oxc represents import/export sources and import-type arguments as string Literals.
          // Resolve only module-specifier positions, never string-literal types or documentation.
          const literal = ['ImportDeclaration', 'ExportAllDeclaration', 'ExportNamedDeclaration'].includes(node.type)
            ? node.source
            : node.type === 'TSImportType' ? node.source
              : node.type === 'TSExternalModuleReference' ? node.expression : null;
          if (typeof literal?.value === 'string' && literal.value.startsWith('.')) {
            const target = redirects.get(declarationTarget(file, literal.value));
            if (target) {
              let specifier = relative(dirname(file), target).replaceAll('\\', '/').replace(/\.d\.ts$/, '.js');
              if (!specifier.startsWith('.')) specifier = `./${specifier}`;
              edits.push({ start: literal.start, end: literal.end, value: JSON.stringify(specifier) });
            }
          }
          for (const [key, value] of Object.entries(node)) {
            if (key === 'parent') continue;
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value === 'object') visit(value);
          }
        }
        visit(parse(file, source));
        if (edits.length) {
          let updated = source;
          for (const edit of edits.sort((a, b) => b.start - a.start)) updated = updated.slice(0, edit.start) + edit.value + updated.slice(edit.end);
          rewrites.push([file, updated]);
        }
      }
    }
  }
  visitDirectory(resolve(packageDir, 'dist'));
  mkdirSync(dirname(empty), { recursive: true });
  writeFileSync(empty, 'export {};\n');
  for (const [file, source] of rewrites) writeFileSync(file, source);
  let removed = 0;
  for (const file of redirects.keys()) {
    if (existsSync(file)) { rmSync(file); removed++; }
  }
  return { removed, rewritten: rewrites.length };
}
