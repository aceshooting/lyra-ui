let from = '';
let to = '';
let scope = '';
let name = '';

/** Receives the original and instrumented build locations, and the package root and name, from the preload. */
export function initialize(data) {
  ({ from, to, scope = '', name = '' } = data);
}

/**
 * Sends imports of the shipped build to the instrumented build, which has the same code plus
 * source maps. The target is chosen before resolution, so the shipped build need not exist.
 * Package self-references and `#` subpath imports issued from inside the package resolve through
 * the instrumented build's own package scope (coverage/build/package.json, the same name, exports
 * and imports with every target inside the instrumented build), not the shipped manifest.
 */
export function resolve(specifier, context, nextResolve) {
  const pathLike = /^(?:\.{1,2}\/|\/)/u.test(specifier) && context.parentURL;
  const url = specifier.startsWith('file:') ? specifier : pathLike ? new URL(specifier, context.parentURL).href : '';
  if (url.startsWith(from)) return nextResolve(to + url.slice(from.length), context);
  const packageSpecifier = specifier.startsWith('#') || (name && (specifier === name || specifier.startsWith(`${name}/`)));
  if (packageSpecifier && scope && context.parentURL?.startsWith(scope) && !context.parentURL.startsWith(to)
    && !context.parentURL.includes('/node_modules/')) {
    return nextResolve(specifier, { ...context, parentURL: new URL('../package.json', to).href });
  }
  return nextResolve(specifier, context);
}
