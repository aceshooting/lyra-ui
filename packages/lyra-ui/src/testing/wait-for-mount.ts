import { tag } from '../internal/prefix.js';
import type { LyraToastItem } from '../components/overlays/toast/toast-item.class.js';

/**
 * An awaitable for "a matching library element is connected and upgraded" -- the gap left by an
 * imperative API that registers its elements lazily, the way `toast()` does
 * (`../components/overlays/toast/toaster.ts`): it dynamically `import()`s `<lr-toast>`/
 * `<lr-toast-item>` on first call so merely importing the package root never pulls the element
 * classes into an eagerly loaded bundle. That is a good bundle-size trade for production code, but
 * it means a fire-and-forget `toast(...)` call -- the normal application pattern, since a component
 * should not block its own flow on a toast -- leaves the document empty for at least one microtask
 * after the call returns. A test asserting on the toast's rendered text right after the triggering
 * action would otherwise need to hand-write a polling loop; {@link waitForLyraElement} and the
 * {@link waitForToast} convenience built on it exist so it doesn't have to.
 *
 * Resolution walks two conditions, matching a real browser's custom-element upgrade contract:
 * `selector` must match an element reachable from `root` (connection), and that element's tag must
 * already be registered with a constructor the element is actually an instance of (upgrade) -- an
 * element present in markup before its class registers (the SSR/hydration case documented in
 * `llms/shared.md`'s hydration section) is not considered a match until it upgrades. Watches for
 * both via `MutationObserver` (new elements arriving) and `customElements.whenDefined()` (an
 * already-connected-but-not-yet-upgraded element finishing registration) instead of polling on a
 * timer, so resolution is driven by the actual DOM/registry events rather than a sampling interval.
 * Every path here -- `MutationObserver`, `customElements.whenDefined()`, `querySelectorAll` -- is a
 * standard DOM/HTML API with no `@web/test-runner`/CDP dependency, so this also runs under a
 * downstream suite's own happy-dom environment (see `happy-dom-shims.ts`'s module doc for what that
 * environment does and doesn't implement), not only a real browser.
 *
 * Scope: awaiting a lazy *mount* reachable from a root you already have a handle to (`document` by
 * default). Not a replacement for `updateComplete` (a mounted element may still have a pending
 * render) or for `interaction-drivers.ts`'s drivers (already-mounted components' own activation
 * paths).
 */

const DEFAULT_TIMEOUT_MS = 2000;

export interface WaitForLyraElementOptions<T extends Element> {
  /**
   * Root to search and observe for connected elements. Defaults to `document`. Pass a component's
   * own `shadowRoot`/`renderRoot` to scope the search to inside an open shadow tree instead of
   * light DOM.
   */
  root?: Node & ParentNode;
  /** Extra filter run against every element `selector` matches, e.g. by rendered text or a data attribute. */
  match?: (element: T) => boolean;
  /** Bounded wait, in milliseconds, before rejecting. Default 2000. */
  timeoutMs?: number;
}

function isUpgraded(element: Element): boolean {
  const ctor = customElements.get(element.localName);
  return ctor !== undefined && element instanceof ctor;
}

/**
 * Resolves once an element matching `selector` (and, if given, `options.match`) is connected under
 * `options.root` and upgraded; rejects with a descriptive `Error` after `options.timeoutMs`
 * (default 2000ms). See the module doc above for exactly what "connected and upgraded" requires and
 * how resolution is driven.
 *
 * @example
 * ```ts
 * toast('Saved'); // fire-and-forget; toast.class.js/toast-item.class.js are still importing
 * const item = await waitForLyraElement<LyraToastItem>('lr-toast-item', {
 *   match: (el) => el.textContent?.trim() === 'Saved',
 * });
 * ```
 */
export function waitForLyraElement<T extends Element = HTMLElement>(
  selector: string,
  options: WaitForLyraElementOptions<T> = {},
): Promise<T> {
  const { root = document, match, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const findCandidate = (): T | undefined => {
    for (const element of root.querySelectorAll(selector)) {
      if (isUpgraded(element) && (!match || match(element as T))) return element as T;
    }
    return undefined;
  };

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let observer: MutationObserver | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = (): void => {
      observer?.disconnect();
      if (timer !== undefined) clearTimeout(timer);
    };

    const settle = (element: T): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(element);
    };

    // Runs on every observed mutation (and once up front): resolve immediately if a fully
    // connected-and-upgraded match already exists, otherwise give any connected-but-not-yet-defined
    // candidate a chance to finish upgrading via `whenDefined()` rather than waiting for the next
    // mutation to notice it.
    const scan = (): void => {
      if (settled) return;
      const found = findCandidate();
      if (found) {
        settle(found);
        return;
      }
      for (const element of root.querySelectorAll(selector)) {
        if (customElements.get(element.localName) !== undefined) continue;
        void customElements.whenDefined(element.localName).then(() => {
          if (settled) return;
          const upgraded = findCandidate();
          if (upgraded) settle(upgraded);
        });
      }
    };

    scan();
    if (settled) return;

    observer = new MutationObserver(scan);
    observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });

    timer = setTimeout(() => {
      if (settled) return;
      cleanup();
      const candidateCount = root.querySelectorAll(selector).length;
      const detail =
        candidateCount > 0
          ? `found ${candidateCount} element(s) matching ${JSON.stringify(selector)}, but none ` +
            (match ? 'both finished upgrading and passed match()' : 'finished upgrading')
          : `no element ever matched ${JSON.stringify(selector)}`;
      reject(
        new Error(
          `waitForLyraElement(): timed out after ${timeoutMs}ms waiting for a connected, upgraded ` +
            `element (${detail}).`,
        ),
      );
    }, timeoutMs);
  });
}

/** A toast item's rendered text (exact, trimmed), or a predicate over the item itself. */
export type ToastMatch = string | ((item: LyraToastItem) => boolean);

/**
 * Resolves once a `<lr-toast-item>` matching `match` is connected and upgraded -- the named
 * convenience for the exact gap described in the module doc above: `toast()` mounts its element
 * through a dynamic `import()`, so a fire-and-forget call needs an awaitable rather than an
 * immediate DOM query. A string `match` compares against the item's trimmed `textContent`
 * (`toast('Saved')` sets it verbatim, so `waitForToast('Saved')` is the common case); pass a
 * predicate for anything else (a substring, an icon/action check, or matching a specific variant).
 * Omitting `match` resolves the first toast item to mount. Rejects with a descriptive `Error` after
 * `options.timeoutMs` (default 2000ms) -- the same bounded contract as {@link waitForLyraElement}.
 *
 * @example
 * ```ts
 * toast('Saved');
 * const item = await waitForToast('Saved');
 * expect(item.textContent?.trim()).to.equal('Saved');
 * ```
 */
export function waitForToast(
  match?: ToastMatch,
  options: Omit<WaitForLyraElementOptions<LyraToastItem>, 'match'> = {},
): Promise<LyraToastItem> {
  const predicate: ((item: LyraToastItem) => boolean) | undefined =
    typeof match === 'string' ? (item) => (item.textContent ?? '').trim() === match : match;
  return waitForLyraElement<LyraToastItem>(tag('toast-item'), { ...options, match: predicate });
}
