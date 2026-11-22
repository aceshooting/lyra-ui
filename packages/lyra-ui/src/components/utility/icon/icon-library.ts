/**
 * Registry of consumer-supplied icon sets for `<lr-icon library="…" name="…">`.
 *
 * A library is a pure name/family/variant-to-URL function plus an optional mutator. The component owns every
 * security-relevant step after that: the resolved URL still goes through the fetch-URL allowlist,
 * the response is still byte-capped, and the markup is still sanitized before it reaches the DOM.
 * A resolver therefore cannot widen what an icon is allowed to render.
 */

import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';

const ICON_LIBRARY_LISTENER_WARNING_KEY = 'lyra-icon-library-listener-threw';
const ICON_LIBRARY_LISTENER_WARNING = '<lr-icon> ignored a throwing icon library listener.';

/** Maps an icon name, family, and variant to the URL of a single SVG document. Async resolvers are
 *  awaited and generation-guarded, so stale results never start a request or replace a newer icon. */
export type LyraIconLibraryResolver = (
  name: string,
  family: string,
  variant: string,
) => string | Promise<string>;

/** Post-processes the sanitized `<svg>` element before it is rendered — recoloring, adding a
 *  `viewBox`, stripping a hardcoded `width`/`height`. It runs on already-sanitized, component-owned
 *  DOM and is trusted consumer code, so it must not reintroduce markup from an untrusted source. */
export type LyraIconLibraryMutator = (svg: SVGElement) => void;

export interface LyraIconLibraryOptions {
  resolver: LyraIconLibraryResolver;
  mutator?: LyraIconLibraryMutator;
  /** When `true`, the resolver returns a same-origin `sheet.svg#symbol-id` URL and the icon renders
   *  `<svg><use href="…"></use></svg>` instead of fetching and sanitizing a document. Cross-origin,
   *  `data:`, `blob:` and fragment-less results fail like any other unloadable icon. The mutator
   *  is not applied, because no fetched node exists. Default `false`. */
  spriteSheet?: boolean;
}

export interface LyraIconLibrary extends LyraIconLibraryOptions {
  readonly name: string;
}

const libraries = new Map<string, LyraIconLibrary>();
const listeners = new Set<(name: string) => void>();

function notify(name: string): void {
  // A throwing listener must not strand the rest of the registry mid-notification.
  for (const listener of [...listeners]) {
    try {
      listener(name);
    } catch {
      devWarnOnce(ICON_LIBRARY_LISTENER_WARNING_KEY, ICON_LIBRARY_LISTENER_WARNING);
    }
  }
}

/** Notification name sent to subscribers when the default family or variant changes.
 *  @internal */
export const ICON_DEFAULTS_CHANGED = '\u0000defaults';

let defaultFamily = '';
let defaultVariant = '';

/** Sets the family and, when given, the variant that icons use while their own `family` or
 *  `variant` is unset. They are forwarded to registered library resolvers; every rendered icon
 *  re-resolves immediately. An omitted `variant` keeps the current default variant. */
export function setDefaultIconFamily(family: string, variant?: string): void {
  defaultFamily = family;
  if (variant !== undefined) defaultVariant = variant;
  notify(ICON_DEFAULTS_CHANGED);
}

/** The default icon family, or an empty string when none was set. */
export function getDefaultIconFamily(): string {
  return defaultFamily;
}

/** The default icon variant, or an empty string when none was set. */
export function getDefaultIconVariant(): string {
  return defaultVariant;
}

/** Registers an icon library, replacing one already registered under the same name. Every
 *  currently rendered `<lr-icon>` using that library re-resolves immediately, so registration can
 *  happen after the icons are on the page. */
export function registerIconLibrary(name: string, options: LyraIconLibraryOptions): void {
  const library: LyraIconLibrary = {
    name,
    resolver: options.resolver,
    ...(options.mutator ? { mutator: options.mutator } : {}),
    ...(options.spriteSheet ? { spriteSheet: true } : {}),
  };
  libraries.set(name, library);
  notify(name);
}

/** Removes a library. Icons using it fall back to the built-in glyph set. */
export function unregisterIconLibrary(name: string): void {
  if (libraries.delete(name)) notify(name);
}

/** The library registered under `name`, or `undefined`. */
export function getIconLibrary(name: string): LyraIconLibrary | undefined {
  return libraries.get(name);
}

/** Subscribes to registration changes; the returned function unsubscribes. Used by connected
 *  `<lr-icon>` instances so a late `registerIconLibrary()` re-resolves what is already rendered.
 *  @internal */
export function subscribeIconLibrary(listener: (name: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
