// Assembles the published tree from lyra-ui's build output: every real locale catalog
// (dist/translations, minus the pseudo-locales that stay in lyra-ui) with its private runtime
// import retargeted to the public `@aceshooting/lyra-ui/localization.js` entry.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  relativeSpecifiersOutsideCatalog,
  retargetCatalogImports,
} from '../../lyra-ui/scripts/translations-companion.mjs';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(packageDir, '..', 'lyra-ui', 'dist', 'translations');
const target = join(packageDir, 'dist');

function catalogFiles(directory, prefix = '') {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (prefix === '' && entry.name === 'pseudo') continue;
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...catalogFiles(join(directory, entry.name), `${relative}/`));
    else if (entry.name.endsWith('.js')) files.push(relative);
  }
  return files;
}

export function buildTranslations() {
  if (!existsSync(source)) {
    throw new Error('packages/lyra-ui/dist/translations is missing; run `pnpm --filter @aceshooting/lyra-ui build` first.');
  }
  rmSync(target, { recursive: true, force: true });
  const files = catalogFiles(source);
  if (files.length === 0) throw new Error('lyra-ui emitted no locale catalogs.');
  for (const file of files) {
    const output = retargetCatalogImports(readFileSync(join(source, file), 'utf8'));
    const stray = relativeSpecifiersOutsideCatalog(output, file);
    if (stray.length > 0) throw new Error(`${file} imports outside the catalog tree: ${stray.join(', ')}`);
    mkdirSync(dirname(join(target, file)), { recursive: true });
    writeFileSync(join(target, file), output);
  }
  writeFileSync(join(target, 'side-effect-only.d.ts'), 'export {};\n');
  return files.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`Locale catalogs assembled: ${buildTranslations()} modules.`);
}
