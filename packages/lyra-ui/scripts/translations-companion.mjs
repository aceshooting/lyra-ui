// Single source of truth for how the built-in locale catalogs reach consumers: lyra-ui compiles
// them (src/translations -> dist/translations) but does not publish them; the companion package
// @aceshooting/lyra-translations is assembled from that build output.
export const TRANSLATIONS_PACKAGE = '@aceshooting/lyra-translations';
const LOCALIZATION_ENTRY = '@aceshooting/lyra-ui/localization.js';

const INTERNAL_RUNTIME = /(["'])\.\.\/\.\.\/internal\/localization-runtime\.js\1/gu;
const LOADER_TARGET = /(["'])\.\.\/translations\//gu;

/** A catalog module imports lyra-ui's public localization entry instead of its private runtime. */
export function retargetCatalogImports(source) {
  return source.replace(INTERNAL_RUNTIME, `$1${LOCALIZATION_ENTRY}$1`);
}

/** lyra-ui's lazy locale loaders import the catalogs from the companion package. */
export function retargetLocaleLoaders(source) {
  return source.replace(LOADER_TARGET, `$1${TRANSLATIONS_PACKAGE}/`);
}

/**
 * Relative specifiers left in a companion module that would resolve outside the published package.
 * With `file` (the module's path inside the catalog tree, e.g. `de-CH/forms.js`), a specifier that
 * still resolves inside the tree, such as `../de/forms.js`, is fine; without it every `../` counts.
 */
export function relativeSpecifiersOutsideCatalog(source, file) {
  const specifiers = [...source.matchAll(/(?:from|import)\s*\(?\s*(["'])(\.{1,2}\/[^"']*)\1/gu)].map((match) => match[2]);
  if (file === undefined) return specifiers.filter((specifier) => specifier.startsWith('../'));
  const depth = file.split('/').length - 1;
  return specifiers.filter((specifier) => {
    let level = depth;
    for (const segment of specifier.split('/')) {
      if (segment === '..') level -= 1;
      else if (segment !== '.' && segment !== '') level += 1;
      if (level < 0) return true;
    }
    return false;
  });
}

// A minifier may print any message as a template literal; a catalog message never interpolates.
const QUOTES = ['"', "'", '`'];

/** End index (exclusive) of the quoted string literal opening at `start`. */
function stringLiteralEnd(source, start) {
  const quote = source[start];
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === '\\') index += 1;
    else if (quote === '`' && source.startsWith('${', index)) throw new Error('interpolated message in a catalog module');
    else if (source[index] === quote) return index + 1;
  }
  throw new Error('unterminated string literal in a catalog module');
}

/** End index (exclusive) of the message value (a string literal or a flat record) at `start`. */
function messageEnd(source, start) {
  if (QUOTES.includes(source[start])) return stringLiteralEnd(source, start);
  if (source[start] !== '{') throw new Error('unsupported message expression in a catalog module');
  for (let index = start + 1; index < source.length;) {
    const char = source[index];
    if (char === '}') return index + 1;
    index = QUOTES.includes(char) ? stringLiteralEnd(source, index) : index + 1;
  }
  throw new Error('unterminated plural record in a catalog module');
}

/**
 * Drops the named messages from a compiled catalog module's `strings` literal, leaving every other
 * byte of the module unchanged. Returns the rewritten source and the keys it removed; a module
 * without a catalog literal is returned untouched.
 */
export function omitCatalogMessages(source, keys) {
  const header = /const strings=\{/u.exec(source);
  if (!header || keys.size === 0) return { source, removed: [], catalog: Boolean(header) };
  const kept = [];
  const removed = [];
  let index = header.index + header[0].length;
  while (source[index] !== '}') {
    const keyMatch = /^(?:[$A-Z_a-z][$\w]*|"[^"\\]*"|'[^'\\]*')/u.exec(source.slice(index, index + 300));
    if (!keyMatch || source[index + keyMatch[0].length] !== ':')
      throw new Error('unsupported property in a catalog module');
    const valueStart = index + keyMatch[0].length + 1;
    const end = messageEnd(source, valueStart);
    const key = keyMatch[0].replace(/^["']|["']$/gu, '');
    if (keys.has(key)) removed.push(key);
    else kept.push(source.slice(index, end));
    index = source[end] === ',' ? end + 1 : end;
  }
  const body = `const strings={${kept.join(',')}`;
  return { source: source.slice(0, header.index) + body + source.slice(index), removed, catalog: true };
}

/**
 * Parses the generated `src/internal/locale-english-defaults.generated.ts` (written by
 * `locale-english-defaults.mjs`) into lowercase locale tag -> omitted key set.
 */
export function parseEnglishDefaultsModule(source) {
  const result = new Map();
  for (const match of source.matchAll(/^ {2}'([a-z0-9-]+)': '([$\w ]*)',$/gmu)) {
    result.set(match[1], new Set(match[2].split(' ').filter(Boolean)));
  }
  return result;
}
