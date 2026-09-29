import {
  getLyraLocale,
  getLyraLocaleDirection,
  resolveLyraString as resolveRuntimeLyraString,
  subscribeLyraLocale,
} from './internal/localization-runtime.js';
import type { LyraLocaleStrings } from './internal/localization-types.js';

/**
 * Side-effect-free public access to Lyra's application-level localization runtime.
 *
 * Import this entry when an application needs to register or select a locale without registering
 * the component graph exposed by the package root. Locale tags share one canonical public BCP-47
 * spelling across registration, active selection and enumeration (`PT_BR` becomes `pt-BR`), while
 * catalogs are retained as bounded immutable snapshots rather than caller-owned objects.
 *
 * It also carries the active-locale subscription (`subscribeLyraLocale()`), the opt-in `lang`/`dir`
 * bridge (`bridgeLyraLocale()`) and the scoped resolver (`resolveLyraScopedString()`). These are the
 * same bindings exposed by the retained root and utility barrels.
 */
export {
  getLyraLocale,
  getLyraLocaleDirection,
  getRegisteredLyraLocaleKeys,
  getRegisteredLyraLocales,
  registerLyraLocale,
  registerLyraLocaleDelta,
  resolveLyraDirection,
  resolveLyraLocale,
  resolveLyraString,
  setLyraLocale,
  subscribeLyraLocaleRegistry,
  LYRA_DEFAULT_STRINGS,
} from './internal/localization.js';
export type {
  LyraLocaleDirection,
  LyraLocaleMeta,
  LyraLocaleStrings,
  LyraMessage,
  LyraMessageKey,
  LyraPluralCategory,
  LyraPluralMessage,
} from './internal/localization.js';
export { subscribeLyraLocale } from './internal/localization-runtime.js';

/**
 * Scoped variant of the full-catalog `resolveLyraString()` (`@aceshooting/lyra-ui/localization.js`):
 * resolves `key` through the same override -> fallback -> registered-locale-catalog chain, but
 * against a caller-supplied `defaults` record instead of the complete built-in English catalog.
 *
 * It never reads the compatibility catalog, so a consumer resolving a handful of messages for its
 * own component never needs it: pass a small `defaults` object of just the keys used, built from
 * imported per-key constants (mirroring how a generated Lyra component's own `defaultStrings` slice
 * is built) or authored by hand. `localization.js` is side-effect-free, so a bundler drops the
 * unused catalog; an unbundled graph that imports `localization.js` still loads it.
 *
 * Import it from `@aceshooting/lyra-ui/localization.js`.
 *
 * ```ts
 * import { resolveLyraScopedString } from '@aceshooting/lyra-ui/localization.js';
 *
 * const label = resolveLyraScopedString(host, 'save', { save: 'Save' });
 * ```
 */
export function resolveLyraScopedString(
  host: Element,
  key: string,
  defaults: Readonly<LyraLocaleStrings>,
  overrides?: LyraLocaleStrings,
  fallback?: string,
  values?: Record<string, string | number>
): string {
  return resolveRuntimeLyraString(host, key, overrides, fallback, values, defaults);
}

/**
 * Options for {@linkcode bridgeLyraLocale}. Import it from `@aceshooting/lyra-ui/localization.js`.
 */
export interface LyraLocaleBridgeOptions {
  /** Element whose `lang`/`dir` mirror the active locale. Defaults to `document.documentElement`.
   *  Pass an application root when the bridge should scope to a subtree instead of the page. */
  target?: Element;
  /** Also mirror the locale's writing direction onto `dir`, resolved through
   *  `getLyraLocaleDirection()`. Default `true`; set `false` when the application owns `dir`
   *  itself (a bidi editor, a preview pane rendering the opposite direction on purpose). */
  direction?: boolean;
}

/**
 * Idempotent disposer returned by {@linkcode bridgeLyraLocale}. Import it from
 * `@aceshooting/lyra-ui/localization.js`.
 */
export type LyraLocaleBridgeCleanup = () => void;

interface LocaleBridgeRegistration {
  readonly id: symbol;
  readonly mirrorDirection: boolean;
}

interface LocaleBridgeState {
  readonly target: Element;
  readonly previousLang: string | null;
  readonly previousDir: string | null;
  readonly registrations: Map<symbol, LocaleBridgeRegistration>;
  unsubscribe: () => void;
}

// One active-locale subscription and one authored-state snapshot per target. A WeakMap keeps the
// ownership bookkeeping from extending a detached target's lifetime after every handle releases.
const localeBridgeStates = new WeakMap<Element, LocaleBridgeState>();

function restoreAttribute(target: Element, name: string, value: string | null): void {
  if (value === null) target.removeAttribute(name);
  else target.setAttribute(name, value);
}

function bridgeMirrorsDirection(state: LocaleBridgeState): boolean {
  for (const registration of state.registrations.values()) {
    if (registration.mirrorDirection) return true;
  }
  return false;
}

function applyLocaleBridge(state: LocaleBridgeState): void {
  const locale = getLyraLocale();
  if (!locale) {
    restoreAttribute(state.target, 'lang', state.previousLang);
    restoreAttribute(state.target, 'dir', state.previousDir);
    return;
  }
  state.target.setAttribute('lang', locale);
  if (bridgeMirrorsDirection(state)) {
    state.target.setAttribute('dir', getLyraLocaleDirection(locale));
  } else {
    restoreAttribute(state.target, 'dir', state.previousDir);
  }
}

/**
 * Mirrors the active Lyra locale onto an element's `lang` (and, by default, `dir`), keeping them in
 * sync for as long as the returned disposer has not been called. `lang` receives the runtime's
 * canonical public spelling (`PT_BR` supplied to `setLyraLocale()` is mirrored as `pt-BR`).
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
 * them, and it restores them again if the active locale is later cleared. Multiple bridges for the
 * same target share one subscription and one authored-state snapshot. Their cleanup handles are
 * independent and order-insensitive; the authored state is restored only after the final handle
 * releases. Direction is mirrored while at least one active handle requests it.
 *
 * Import it from `@aceshooting/lyra-ui/localization.js`.
 *
 * ```ts
 * import { bridgeLyraLocale, setLyraLocale } from '@aceshooting/lyra-ui/localization.js';
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
  if (
    !target ||
    typeof target.getAttribute !== 'function' ||
    typeof target.setAttribute !== 'function' ||
    typeof target.removeAttribute !== 'function'
  ) {
    throw new TypeError('bridgeLyraLocale() requires a target element when there is no document.');
  }
  const registration: LocaleBridgeRegistration = {
    id: Symbol('Lyra locale bridge registration'),
    mirrorDirection: options.direction !== false,
  };
  let state = localeBridgeStates.get(target);
  if (!state) {
    let nextState: LocaleBridgeState;
    const unsubscribe = subscribeLyraLocale(() => applyLocaleBridge(nextState));
    nextState = {
      target,
      previousLang: target.getAttribute('lang'),
      previousDir: target.getAttribute('dir'),
      registrations: new Map(),
      unsubscribe,
    };
    state = nextState;
    localeBridgeStates.set(target, state);
    // A registration reachable from the active locale also notifies: a declared `dir` arrives
    // with its catalog, so direction can only resolve correctly once that import has landed.
    // Unrelated registrations are filtered, and every handle shares this one subscription.
  }
  state.registrations.set(registration.id, registration);
  applyLocaleBridge(state);
  let disposed = false;

  return () => {
    if (disposed) return;
    disposed = true;
    const activeState = localeBridgeStates.get(target);
    if (!activeState || !activeState.registrations.delete(registration.id)) return;
    if (activeState.registrations.size > 0) {
      applyLocaleBridge(activeState);
      return;
    }
    activeState.unsubscribe();
    restoreAttribute(target, 'lang', activeState.previousLang);
    restoreAttribute(target, 'dir', activeState.previousDir);
    localeBridgeStates.delete(target);
  };
}
