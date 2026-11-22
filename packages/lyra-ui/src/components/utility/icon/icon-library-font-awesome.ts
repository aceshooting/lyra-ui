/**
 * Opt-in Font Awesome preset for `<lr-icon library="…">`.
 *
 * Importing this module has no side effects and requests nothing: the built-in glyph set stays
 * the offline default. Only `registerFontAwesomeIconLibrary()` installs the resolver, and even
 * then an icon is fetched only when an `<lr-icon>` actually names that library. Every request
 * still runs the `<lr-icon>` pipeline: fetch-URL allowlist, 1 MiB byte cap before parsing,
 * unconditional DOMPurify SVG sanitizing, external-resource stripping, a shared bounded cache, and
 * a localized fail-closed alert plus `lr-error` on any failure.
 *
 * The resolver validates the icon name, family, and variant before building a URL, so a typo, a
 * path-like name, or a Pro family without a kit fails at once, without a network request.
 */

import {
  getIconLibrary,
  registerIconLibrary,
  unregisterIconLibrary,
  type LyraIconLibraryMutator,
  type LyraIconLibraryResolver,
} from './icon-library.js';

/** Font Awesome families understood by the preset. `classic` and `brands` are free; the rest need
 *  a Font Awesome kit code or a self-hosted `basePath` holding those SVG folders. */
export type LyraFontAwesomeFamily =
  | 'classic'
  | 'brands'
  | 'duotone'
  | 'sharp'
  | 'sharp-duotone'
  | 'chisel'
  | 'etch'
  | 'graphite'
  | 'jelly'
  | 'jelly-duo'
  | 'jelly-fill'
  | 'mosaic'
  | 'notdog'
  | 'notdog-duo'
  | 'pixel'
  | 'slab'
  | 'slab-press'
  | 'slab-duo'
  | 'slab-press-duo'
  | 'thumbprint'
  | 'utility'
  | 'utility-duo'
  | 'utility-fill'
  | 'vellum'
  | 'whiteboard';

/** Font Awesome variants (styles) understood by the preset. */
export type LyraFontAwesomeVariant = 'solid' | 'regular' | 'light' | 'thin' | 'semibold';

export interface LyraFontAwesomeIconLibraryOptions {
  /** Library name used by `<lr-icon library>`. Default `'fa'`. Passing `'default'` makes Font
   *  Awesome own every icon that sets no `library`. */
  name?: string;
  /** Font Awesome kit code. When set, icons load from Font Awesome's kit SVG host with the code as
   *  the `token` query parameter, and every family is allowed. Ignored when `basePath` is set. */
  kitCode?: string;
  /** Self-hosted root holding Font Awesome's `svgs/` folders, for example `/assets/fa/svgs`.
   *  Icons resolve to `<basePath>/<folder>/<name>.svg`, every family is allowed, and nothing is
   *  requested from a third-party host. */
  basePath?: string;
  /** Exact Font Awesome release (`major.minor.patch`) used for CDN and kit URLs. Default
   *  `FONT_AWESOME_DEFAULT_VERSION`. Pinning keeps every icon URL immutable and cacheable. */
  version?: string;
  /** Family used while neither the icon's `family` nor `setDefaultIconFamily()` names one.
   *  Default `'classic'`. */
  defaultFamily?: LyraFontAwesomeFamily;
  /** Variant used while neither the icon's `variant` nor `setDefaultIconFamily()` names one.
   *  Default: the family's first style (`solid` for the four-style families). */
  defaultVariant?: LyraFontAwesomeVariant;
}

/** Font Awesome release pinned by the preset when no `version` is given. */
export const FONT_AWESOME_DEFAULT_VERSION = '7.3.1';

const FOUR_STYLES: readonly LyraFontAwesomeVariant[] = ['solid', 'regular', 'light', 'thin'];

/** Styles each family offers, first entry being its default. A family with exactly one style
 *  always uses it, whatever variant is requested (as `brands` has no variants at all). */
const FAMILY_STYLES: Readonly<Record<LyraFontAwesomeFamily, readonly LyraFontAwesomeVariant[]>> = {
  classic: FOUR_STYLES,
  brands: [],
  duotone: FOUR_STYLES,
  sharp: FOUR_STYLES,
  'sharp-duotone': FOUR_STYLES,
  chisel: ['regular'],
  etch: ['solid'],
  graphite: ['thin'],
  jelly: ['regular'],
  'jelly-duo': ['regular'],
  'jelly-fill': ['regular'],
  mosaic: ['solid'],
  notdog: ['solid'],
  'notdog-duo': ['solid'],
  pixel: ['regular'],
  slab: ['regular'],
  'slab-press': ['regular'],
  'slab-duo': ['regular'],
  'slab-press-duo': ['regular'],
  thumbprint: ['light'],
  utility: ['semibold'],
  'utility-duo': ['semibold'],
  'utility-fill': ['semibold'],
  vellum: ['solid'],
  whiteboard: ['semibold'],
};

/** Folders published by the free package; everything else needs a kit or a self-hosted copy. */
const FREE_FOLDERS = new Set(['solid', 'regular', 'brands']);

const ICON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KIT_CODE = /^[A-Za-z0-9]+$/;
const VERSION = /^\d+\.\d+\.\d+$/;

function isFamily(value: string): value is LyraFontAwesomeFamily {
  return Object.prototype.hasOwnProperty.call(FAMILY_STYLES, value);
}

/**
 * The Font Awesome SVG folder for a family and variant, for example `classic`/`solid` → `solid`,
 * `duotone`/`light` → `duotone-light`, `sharp-duotone`/`thin` → `sharp-duotone-thin`, and
 * `brands` → `brands`. An empty family or variant takes the family's default. Throws a
 * `RangeError` for a family or variant Font Awesome does not publish, so a custom resolver can
 * reuse the same validation.
 */
export function fontAwesomeIconFolder(family: string, variant = ''): string {
  const resolvedFamily = family || 'classic';
  if (!isFamily(resolvedFamily)) throw new RangeError(`Unknown Font Awesome family: ${resolvedFamily}`);
  if (resolvedFamily === 'brands') return 'brands';
  const styles = FAMILY_STYLES[resolvedFamily];
  let style: LyraFontAwesomeVariant;
  if (styles.length === 1) style = styles[0]!;
  else if (!variant) style = styles[0]!;
  else if ((styles as readonly string[]).includes(variant)) style = variant as LyraFontAwesomeVariant;
  else throw new RangeError(`Font Awesome family ${resolvedFamily} has no ${variant} variant`);
  if (resolvedFamily === 'classic') return style;
  if (resolvedFamily === 'duotone' && style === 'solid') return 'duotone';
  return `${resolvedFamily}-${style}`;
}

function validateOptions(options: LyraFontAwesomeIconLibraryOptions): void {
  if (options.kitCode !== undefined && !KIT_CODE.test(options.kitCode)) {
    throw new TypeError('Font Awesome kitCode must be alphanumeric');
  }
  if (options.version !== undefined && !VERSION.test(options.version)) {
    throw new TypeError('Font Awesome version must be an exact major.minor.patch release');
  }
  if (options.basePath !== undefined && (options.basePath.trim() === '' || /[?#]/.test(options.basePath))) {
    throw new TypeError('Font Awesome basePath must be a non-empty path without a query or fragment');
  }
  if (options.defaultFamily !== undefined && !isFamily(options.defaultFamily)) {
    throw new TypeError(`Unknown Font Awesome family: ${String(options.defaultFamily)}`);
  }
  if (options.defaultVariant !== undefined) {
    fontAwesomeIconFolder(options.defaultFamily ?? 'classic', options.defaultVariant);
  }
}

/**
 * Builds the resolver the preset registers, for composing with other libraries or wrapping. It
 * accepts `house` and the copy-pasted class form `fa-house`, rejects any other name shape (so no
 * name can add path segments, a query, or a fragment), and throws, which `<lr-icon>` reports as
 * a localized load failure, for an unknown family or variant, or for a Pro family without a
 * `kitCode` or `basePath`.
 */
export function createFontAwesomeIconResolver(
  options: LyraFontAwesomeIconLibraryOptions = {},
): LyraIconLibraryResolver {
  validateOptions(options);
  const version = options.version ?? FONT_AWESOME_DEFAULT_VERSION;
  const basePath = options.basePath?.replace(/\/+$/, '');
  const kitCode = options.kitCode;
  return (name, family, variant) => {
    const iconName = name.startsWith('fa-') ? name.slice(3) : name;
    if (!ICON_NAME.test(iconName)) throw new RangeError(`Invalid Font Awesome icon name: ${name}`);
    const resolvedFamily = family || options.defaultFamily || 'classic';
    const resolvedVariant = variant || (family ? '' : (options.defaultVariant ?? ''));
    const folder = fontAwesomeIconFolder(resolvedFamily, resolvedVariant);
    if (basePath !== undefined) return `${basePath}/${folder}/${iconName}.svg`;
    if (kitCode) {
      return `https://ka-p.fontawesome.com/releases/v${version}/svgs/${folder}/${iconName}.svg?token=${kitCode}`;
    }
    if (!FREE_FOLDERS.has(folder)) {
      throw new RangeError(`Font Awesome ${folder} icons need a kitCode or a self-hosted basePath`);
    }
    return `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@${version}/svgs/${folder}/${iconName}.svg`;
  };
}

/** Paints Font Awesome SVGs with the text color: sets `fill="currentColor"` on the root when the
 *  document declares no fill (older self-hosted releases), and leaves duotone `.fa-primary`/
 *  `.fa-secondary` layers to `<lr-icon>`'s `--primary-*`/`--secondary-*` hooks. */
export const fontAwesomeIconMutator: LyraIconLibraryMutator = (svg) => {
  if (!svg.hasAttribute('fill')) svg.setAttribute('fill', 'currentColor');
};

/**
 * Registers the Font Awesome preset under `options.name` (default `'fa'`) and returns a function
 * that unregisters it again, but only while that name still holds this registration. Options are
 * validated here, so a malformed kit code, version, base path, or default throws at the call
 * site. The free tier (`classic` solid/regular and `brands`) loads from a pinned jsDelivr release;
 * a `kitCode` or `basePath` unlocks the other families.
 */
export function registerFontAwesomeIconLibrary(options: LyraFontAwesomeIconLibraryOptions = {}): () => void {
  const name = options.name ?? 'fa';
  const resolver = createFontAwesomeIconResolver(options);
  registerIconLibrary(name, { resolver, mutator: fontAwesomeIconMutator });
  return () => {
    if (getIconLibrary(name)?.resolver === resolver) unregisterIconLibrary(name);
  };
}
