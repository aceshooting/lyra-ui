import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const EMPTY_DECLARATION = './dist/internal/side-effect-only.d.ts';

/** Real catalogs register strings as side effects; pseudo catalogs export their strings. */
export function localeDeclarationModules(packageDir) {
  const root = join(packageDir, 'src/translations');
  if (!existsSync(root)) return [];
  const modules = [];
  function visit(directory, prefix = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'pseudo') continue;
      const name = `${prefix}${entry.name}`;
      if (entry.isDirectory()) visit(join(directory, entry.name), `${name}/`);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) modules.push(name.slice(0, -3));
    }
  }
  visit(root);
  return modules.sort();
}

export function deriveLocaleDeclarationExports(packageDir) {
  const exports = {};
  for (const module of localeDeclarationModules(packageDir)) {
    for (const extension of ['.js', '.d.ts']) {
      exports[`./translations/${module}${extension}`] = {
        types: EMPTY_DECLARATION,
        default: extension === '.d.ts' ? EMPTY_DECLARATION : `./dist/translations/${module}${extension}`,
      };
    }
  }
  return exports;
}
