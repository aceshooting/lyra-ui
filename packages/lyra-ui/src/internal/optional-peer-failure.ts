/** Why an optional peer could not be used: not installed, or installed but unusable. */
export type OptionalPeerFailure = 'missing' | 'failed';

const MODULE_NOT_FOUND_CODES: ReadonlySet<string> = new Set(['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND']);
// Module-resolution failures, by environment: Chromium, Firefox, WebKit, Node/webpack, Vite.
const UNRESOLVED_MODULE =
  /Failed to resolve module specifier|was a bare specifier, but was not remapped|does not resolve to a valid URL|Cannot find (?:module|package) |Failed to resolve import /;

/**
 * Classifies an optional peer's import rejection. `missing` means the module could not be
 * resolved at all (the package is not installed, or not mapped for the browser); everything else
 * -- a network or fetch failure, a JSON/syntax error, an incompatible package `exports` map, a
 * missing import attribute -- is `failed`: the peer was found but could not be loaded. Unknown
 * values are `failed`, so a wrong guess never tells a developer to install a package they have.
 */
export function classifyOptionalPeerImportError(error: unknown): OptionalPeerFailure {
  if (typeof error !== 'object' || error === null) return 'failed';
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code === 'string' && MODULE_NOT_FOUND_CODES.has(code)) return 'missing';
  return typeof message === 'string' && UNRESOLVED_MODULE.test(message) ? 'missing' : 'failed';
}
