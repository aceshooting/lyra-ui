// Assembles the published tree from lyra-ui's build output: every real locale catalog
// (dist/translations, minus the pseudo-locales that stay in lyra-ui) with its private runtime
// import retargeted to the public `@aceshooting/lyra-ui/localization.js` entry.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  relativeSpecifiersOutsideCatalog,
  retargetCatalogImports,
} from '../../lyra-ui/scripts/translations-companion.mjs';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultSource = join(packageDir, '..', 'lyra-ui', 'dist', 'translations');
const defaultTarget = join(packageDir, 'dist');

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

// Only rewrite the compiler's flat string-literal catalog shape. Plurals and other expressions
// retain their original module representation.
function compactCatalog(source) {
  const header = /^(?:import"[^"]+";)?import\{(registerLyraLocale(?:Delta)?)\}from"@aceshooting\/lyra-ui\/localization\.js";const strings=\{/u.exec(source);
  if (!header) return source;
  const property = /([a-zA-Z]\w*):("(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*')([,}])/gyu;
  property.lastIndex = header[0].length;
  const keys = [];
  const literals = [];
  let end;
  for (let match; (match = property.exec(source));) {
    keys.push(match[1]);
    literals.push(match[2]);
    if (match[3] === '}') {
      end = property.lastIndex;
      break;
    }
  }
  if (!end || !source.startsWith(';' + header[1] + '(', end)) return source;

  let prefix = keys[0];
  for (const key of keys) {
    while (!key.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  const suffixes = JSON.stringify(keys.map(key => key.slice(prefix.length)).join(' '));
  let values = '[' + literals.join(',') + ']';
  try {
    const strings = JSON.parse(values);
    if (strings.every(text => !text.includes('|'))) values = JSON.stringify(strings.join('|')) + '.split("|")';
  } catch {
    // JavaScript also permits single-quoted strings and escapes outside JSON's grammar.
  }
  const expression = '((keys,values)=>Object.fromEntries(keys.map((key,i)=>[' +
    (prefix ? JSON.stringify(prefix) + '+' : '') + 'key,values[i]])))(' + suffixes + '.split(" "),' + values + ')';
  const start = header[0].length - 1;
  return Buffer.byteLength(expression) < Buffer.byteLength(source.slice(start, end))
    ? source.slice(0, start) + expression + source.slice(end) : source;
}

export function buildTranslations({ source = defaultSource, target = defaultTarget } = {}) {
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
    writeFileSync(join(target, file), compactCatalog(output));
  }
  writeFileSync(join(target, 'side-effect-only.d.ts'), 'export {};\n');
  return files.length;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  console.log(`Locale catalogs assembled: ${buildTranslations()} modules.`);
}
