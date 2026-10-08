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
  const specifiers = [...source.matchAll(/(?:from|import)\s*\(?\s*(["'])(\.\.\/[^"']*)\1/gu)].map((match) => match[2]);
  if (file === undefined) return specifiers;
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
