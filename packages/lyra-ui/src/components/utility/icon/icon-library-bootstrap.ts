/**
 * Opt-in Bootstrap Icons preset for `<lr-icon library="…">`.
 *
 * Bootstrap Icons (MIT) is the vocabulary Shoelace's `<sl-icon>` resolves by default, so
 * registering this preset under `'default'` keeps migrated `<lr-icon name="gear">` markup
 * rendering the same glyphs.
 *
 * Importing this module has no side effects and requests nothing: the built-in glyph set stays
 * the offline default. Only `registerBootstrapIconLibrary()` installs the resolver, and even then
 * an icon is fetched only when an `<lr-icon>` actually names that library. Every request still runs
 * the `<lr-icon>` pipeline: fetch-URL allowlist, 1 MiB byte cap before parsing, unconditional
 * DOMPurify SVG sanitizing, external-resource stripping, a shared bounded cache, and a localized
 * fail-closed alert plus `lr-error` on any failure.
 *
 * The resolver validates the icon name before building a URL, so a typo in its shape or a
 * path-like name fails at once, without a network request.
 */

import {
  getIconLibrary,
  registerIconLibrary,
  unregisterIconLibrary,
  type LyraIconLibraryMutator,
  type LyraIconLibraryResolver,
} from './icon-library.js';

export interface LyraBootstrapIconLibraryOptions {
  /** Library name used by `<lr-icon library>`. Default `'bi'`. Passing `'default'` makes Bootstrap
   *  Icons own every icon that sets no `library`, as Shoelace's default library did. */
  name?: string;
  /** Self-hosted folder holding the Bootstrap Icons SVG files (the package's `icons/` folder), for
   *  example `/assets/bootstrap-icons`. Icons resolve to `<basePath>/<name>.svg` and nothing is
   *  requested from a third-party host. */
  basePath?: string;
  /** Exact Bootstrap Icons release (`major.minor.patch`) used for the CDN URL. Default
   *  `BOOTSTRAP_ICONS_DEFAULT_VERSION`. Pinning keeps every icon URL immutable and cacheable.
   *  Ignored when `basePath` is set. */
  version?: string;
}

/** Bootstrap Icons release pinned by the preset when no `version` is given. */
export const BOOTSTRAP_ICONS_DEFAULT_VERSION = '1.13.2';

const ICON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+$/;

function validateOptions(options: LyraBootstrapIconLibraryOptions): void {
  if (options.version !== undefined && !VERSION.test(options.version)) {
    throw new TypeError('Bootstrap Icons version must be an exact major.minor.patch release');
  }
  if (options.basePath !== undefined && (options.basePath.trim() === '' || /[?#]/.test(options.basePath))) {
    throw new TypeError('Bootstrap Icons basePath must be a non-empty path without a query or fragment');
  }
}

/**
 * Builds the resolver the preset registers, for composing with other libraries or wrapping. It
 * accepts `house` and the copy-pasted class form `bi-house`, and rejects any other name shape (so
 * no name can add path segments, a query, or a fragment) by throwing, which `<lr-icon>` reports
 * as a localized load failure. Bootstrap Icons has no families or variants, so `family` and
 * `variant` are ignored; a filled glyph is its own name, such as `house-fill`.
 */
export function createBootstrapIconResolver(options: LyraBootstrapIconLibraryOptions = {}): LyraIconLibraryResolver {
  validateOptions(options);
  const version = options.version ?? BOOTSTRAP_ICONS_DEFAULT_VERSION;
  const basePath = options.basePath === undefined ? undefined : withoutTrailingSlashes(options.basePath);
  return (name) => {
    const iconName = name.startsWith('bi-') ? name.slice(3) : name;
    if (!ICON_NAME.test(iconName)) throw new RangeError(`Invalid Bootstrap Icons name: ${name}`);
    if (basePath !== undefined) return `${basePath}/${iconName}.svg`;
    return `https://cdn.jsdelivr.net/npm/bootstrap-icons@${version}/icons/${iconName}.svg`;
  };
}

/** Paints Bootstrap Icons SVGs with the text color: sets `fill="currentColor"` on the root when
 *  the document declares no fill (published files already do), so a self-hosted or edited copy
 *  still follows `color`. */
export const bootstrapIconMutator: LyraIconLibraryMutator = (svg) => {
  if (!svg.hasAttribute('fill')) svg.setAttribute('fill', 'currentColor');
};

/**
 * Registers the Bootstrap Icons preset under `options.name` (default `'bi'`) and returns a
 * function that unregisters it again, but only while that name still holds this registration.
 * Options are validated here, so a malformed version or base path throws at the call site. Icons
 * load from a pinned jsDelivr release unless `basePath` points at a self-hosted copy.
 */
export function registerBootstrapIconLibrary(options: LyraBootstrapIconLibraryOptions = {}): () => void {
  const name = options.name ?? 'bi';
  const resolver = createBootstrapIconResolver(options);
  registerIconLibrary(name, { resolver, mutator: bootstrapIconMutator });
  return () => {
    if (getIconLibrary(name)?.resolver === resolver) unregisterIconLibrary(name);
  };
}

/** Drops trailing `/` characters with a linear scan; a regex anchored at the end backtracks
 *  quadratically on long runs of `/` in caller-supplied input. */
function withoutTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) end -= 1;
  return value.slice(0, end);
}
