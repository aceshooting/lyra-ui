// Assembles the published tree from lyra-ui's build output: every real locale catalog
// (dist/translations, minus the pseudo-locales that stay in lyra-ui) with its private runtime
// import retargeted to the public `@aceshooting/lyra-ui/localization.js` entry.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  omitCatalogMessages,
  parseEnglishDefaultsModule,
  relativeSpecifiersOutsideCatalog,
  retargetCatalogImports,
} from '../../lyra-ui/scripts/translations-companion.mjs';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultSource = join(packageDir, '..', 'lyra-ui', 'dist', 'translations');
const defaultTarget = join(packageDir, 'dist');
const defaultEnglishDefaults = join(packageDir, '..', 'lyra-ui', 'src', 'internal', 'locale-english-defaults.generated.ts');

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

// Only rewrite the compiler's flat catalog shape: string literals and plural records whose
// categories are string literals. Any other expression retains its original module representation.
const STRING_LITERAL = String.raw`"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*'`;
const PLURAL_ENTRY = String.raw`(?:zero|one|two|few|many|other):(?:${STRING_LITERAL})`;
const CATALOG_VALUE = String.raw`${STRING_LITERAL}|\{${PLURAL_ENTRY}(?:,${PLURAL_ENTRY})*\}`;

function compactCatalog(source) {
  const header = /^(?:import"[^"]+";)?import\{(registerLyraLocale(?:Delta)?)\}from"@aceshooting\/lyra-ui\/localization\.js";const strings=\{/u.exec(source);
  if (!header) return source;
  const property = new RegExp(String.raw`([a-zA-Z]\w*):(${CATALOG_VALUE})([,}])`, 'gyu');
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
    // Plural records keep their literal text and replace an empty placeholder by position.
    const plurals = [];
    const strings = literals.map((literal, index) => literal.startsWith('{') ? (plurals.push(index + ':' + literal), '') : JSON.parse(literal));
    if (strings.every(text => typeof text === 'string' && !text.includes('|'))) {
      values = JSON.stringify(strings.join('|')) + '.split("|")' +
        (plurals.length ? '.map((p=>(value,i)=>p[i]??value)({' + plurals.join(',') + '}))' : '');
    }
  } catch {
    // JavaScript also permits single-quoted strings and escapes outside JSON's grammar.
  }
  const expression = '((keys,values)=>Object.fromEntries(keys.map((key,i)=>[' +
    (prefix ? JSON.stringify(prefix) + '+' : '') + 'key,values[i]])))(' + suffixes + '.split(" "),' + values + ')';
  const start = header[0].length - 1;
  return Buffer.byteLength(expression) < Buffer.byteLength(source.slice(start, end))
    ? source.slice(0, start) + expression + source.slice(end) : source;
}

// A message equal to the English default is omitted where the runtime falls straight back to that
// default (lyra-ui's scripts/locale-english-defaults.mjs decides which); every listed message must
// be found in its locale's catalogs, so the list and the published catalogs cannot drift apart.
export function buildTranslations({ source = defaultSource, target = defaultTarget, englishDefaults = defaultEnglishDefaults } = {}) {
  if (!existsSync(source)) {
    throw new Error('packages/lyra-ui/dist/translations is missing; run `pnpm --filter @aceshooting/lyra-ui build` first.');
  }
  const omitted = parseEnglishDefaultsModule(readFileSync(englishDefaults, 'utf8'));
  rmSync(target, { recursive: true, force: true });
  const files = catalogFiles(source);
  if (files.length === 0) throw new Error('lyra-ui emitted no locale catalogs.');
  const removedByLocale = new Map();
  for (const file of files) {
    const locale = file.includes('/') ? file.slice(0, file.indexOf('/')).toLowerCase() : '';
    const trimmed = omitCatalogMessages(retargetCatalogImports(readFileSync(join(source, file), 'utf8')),
      omitted.get(locale) ?? new Set());
    const output = trimmed.source;
    const stray = relativeSpecifiersOutsideCatalog(output, file);
    if (stray.length > 0) throw new Error(`${file} imports outside the catalog tree: ${stray.join(', ')}`);
    if (trimmed.catalog) {
      const removed = removedByLocale.get(locale) ?? [];
      removed.push(...trimmed.removed);
      removedByLocale.set(locale, removed);
    }
    mkdirSync(dirname(join(target, file)), { recursive: true });
    writeFileSync(join(target, file), compactCatalog(output));
  }
  for (const [locale, removed] of removedByLocale) {
    const expected = omitted.get(locale);
    if (expected && removed.length !== expected.size)
      throw new Error(`${locale}: the published catalogs do not carry exactly the listed English-default messages`);
  }
  writeFileSync(join(target, 'side-effect-only.d.ts'), 'export {};\n');
  return files.length;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  console.log(`Locale catalogs assembled: ${buildTranslations()} modules.`);
}
