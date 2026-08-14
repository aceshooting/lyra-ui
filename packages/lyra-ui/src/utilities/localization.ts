/**
 * Locale-change subscription and the opt-in locale bridge.
 *
 * Part of the curated `@aceshooting/lyra-ui/utilities/*` surface: supported and semver-covered,
 * unlike the `internal/` modules it forwards to.
 *
 * `subscribeLyraLocale()` is the application-facing *active locale* subscription. It fires for an
 * active selection change and for a catalog registration that can alter that active locale's
 * messages or direction; unrelated registrations are filtered out. It is distinct from
 * `subscribeLyraLocaleRegistry()` on the `@aceshooting/lyra-ui/localization.js` entry, which fires
 * only when registry membership grows. Components use a host-scoped internal subscription so a
 * document, ancestor or per-host locale can still react without globally re-rendering every host.
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
    state = {
      target,
      previousLang: target.getAttribute('lang'),
      previousDir: target.getAttribute('dir'),
      registrations: new Map(),
      unsubscribe: () => {},
    };
    localeBridgeStates.set(target, state);
    // A registration reachable from the active locale also notifies: a declared `dir` arrives
    // with its catalog, so direction can only resolve correctly once that import has landed.
    // Unrelated registrations are filtered, and every handle shares this one subscription.
    state.unsubscribe = subscribeLyraLocale(() => applyLocaleBridge(state!));
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
