/**
 * Locale-change subscription and the opt-in locale bridge.
 *
 * Part of the curated `@aceshooting/lyra-ui/utilities/*` surface: supported and semver-covered,
 * unlike the `internal/` modules it forwards to.
 *
 * `subscribeLyraLocale()` is the *active locale* subscription every component already uses
 * internally. It is distinct from `subscribeLyraLocaleRegistry()` on the
 * `@aceshooting/lyra-ui/localization.js` entry, which fires only when a catalog is REGISTERED --
 * the two answer different questions, and the registry one is not a substitute for an application
 * that needs to react to the locale actually in force.
 *
 * The runtime is imported here rather than the full-catalog `internal/localization.js` entry, so
 * bridging the locale never drags the complete built-in message catalog into an application bundle.
 */
import {
  getLyraLocale,
  getLyraLocaleDirection,
  subscribeLyraLocale,
} from '../internal/localization-runtime.js';

export { subscribeLyraLocale } from '../internal/localization-runtime.js';

/** Options for {@linkcode bridgeLyraLocale}. */
export interface LyraLocaleBridgeOptions {
  /** Element whose `lang`/`dir` mirror the active locale. Defaults to `document.documentElement`.
   *  Pass an application root when the bridge should scope to a subtree instead of the page. */
  target?: Element;
  /** Also mirror the locale's writing direction onto `dir`, resolved through
   *  `getLyraLocaleDirection()`. Default `true`; set `false` when the application owns `dir`
   *  itself (a bidi editor, a preview pane rendering the opposite direction on purpose). */
  direction?: boolean;
}

/** Idempotent disposer returned by {@linkcode bridgeLyraLocale}. */
export type LyraLocaleBridgeCleanup = () => void;

/**
 * Mirrors the active Lyra locale onto an element's `lang` (and, by default, `dir`), keeping them in
 * sync for as long as the returned disposer has not been called.
 *
 * `setLyraLocale()` only tells *this library* which locale is in force. Everything else on the page
 * reads the platform `lang`/`dir` cascade instead: `:lang()` selectors, hyphenation and quote
 * marks, spelling dictionaries, a screen reader's pronunciation of untranslated prose, and any
 * third-party widget. An application that switches locale at runtime therefore has to write those
 * attributes itself, and hand-rolling that is where the two drift apart. This is that glue, in one
 * supported place.
 *
 * Strictly opt-in: nothing here runs at import time, and the library never calls it for you --
 * components read the inherited cascade and no component forces a direction of its own.
 *
 * With no active locale set (the default state, where components inherit from the document), the
 * bridge leaves the target's authored `lang`/`dir` exactly as it found them rather than blanking
 * them, and it restores them again if the active locale is later cleared.
 *
 * ```ts
 * import { bridgeLyraLocale } from '@aceshooting/lyra-ui/utilities/localization.js';
 * import { setLyraLocale } from '@aceshooting/lyra-ui/localization.js';
 *
 * const stop = bridgeLyraLocale();       // mirrors onto <html>
 * setLyraLocale('ar');                   // <html lang="ar" dir="rtl">
 * stop();                                // restores whatever <html> carried before
 * ```
 *
 * @throws TypeError when no target element is given and no ambient `document` exists (SSR) -- the
 * bridge is a DOM operation and silently doing nothing there would hide the mistake.
 */
export function bridgeLyraLocale(options: LyraLocaleBridgeOptions = {}): LyraLocaleBridgeCleanup {
  const target = options.target ?? globalThis.document?.documentElement;
  if (!target || typeof target.setAttribute !== 'function') {
    throw new TypeError('bridgeLyraLocale() requires a target element when there is no document.');
  }
  const mirrorDirection = options.direction !== false;
  const previousLang = target.getAttribute('lang');
  const previousDir = target.getAttribute('dir');
  let disposed = false;

  const restore = (name: string, value: string | null): void => {
    if (value === null) target.removeAttribute(name);
    else target.setAttribute(name, value);
  };

  const apply = (): void => {
    const locale = getLyraLocale();
    if (!locale) {
      restore('lang', previousLang);
      if (mirrorDirection) restore('dir', previousDir);
      return;
    }
    target.setAttribute('lang', locale);
    if (mirrorDirection) target.setAttribute('dir', getLyraLocaleDirection(locale));
  };

  apply();
  // A catalog registration also notifies, which is wanted rather than merely tolerated: a locale's
  // declared `dir` arrives with its catalog, so `getLyraLocaleDirection()` can only answer
  // correctly once that import has landed.
  const unsubscribe = subscribeLyraLocale(apply);

  return () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    restore('lang', previousLang);
    if (mirrorDirection) restore('dir', previousDir);
  };
}
