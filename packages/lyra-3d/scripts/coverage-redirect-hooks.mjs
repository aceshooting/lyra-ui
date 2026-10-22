let from = '';
let to = '';

/** Receives the original and instrumented build locations from the preload. */
export function initialize(data) {
  ({ from, to } = data);
}

/**
 * Sends imports of the shipped build to the instrumented build, which has the same code plus
 * source maps. The target is chosen before resolution, so the shipped build need not exist.
 */
export function resolve(specifier, context, nextResolve) {
  const pathLike = /^(?:\.{1,2}\/|\/)/u.test(specifier) && context.parentURL;
  const url = specifier.startsWith('file:') ? specifier : pathLike ? new URL(specifier, context.parentURL).href : '';
  if (url.startsWith(from)) return nextResolve(to + url.slice(from.length), context);
  return nextResolve(specifier, context);
}
