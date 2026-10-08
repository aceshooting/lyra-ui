import { focusFirstAvailable } from './focus-navigation.js';
import { composedContains } from './composed-tree.js';
import { deepActiveElementIn } from './active-element.js';

const deepActiveElement = (doc: Document): Element | null => deepActiveElementIn(doc);

type FocusReturnCandidate = HTMLElement | null | undefined;

/** The element that held focus outside `host` when it opened -- the component's return target --
 *  or `null` when focus was on nothing focusable or already inside `host`. */
export function captureFocusReturnOpener(host: HTMLElement): HTMLElement | null {
  const active = deepActiveElement(host.ownerDocument);
  return active && typeof (active as HTMLElement).focus === 'function' && !composedContains(host, active)
    ? (active as HTMLElement)
    : null;
}

/** One close's deferred focus return -- see `DeferredFocusReturn.schedule()`. */
export interface DeferredFocusReturnRequest {
  /** The closing component. Its update must complete before the pass runs, and a disconnected host
   *  abandons it. */
  host: HTMLElement & { readonly updateComplete: Promise<unknown> };
  /** Return targets in priority order, resolved when the pass runs rather than when it is
   *  scheduled, so a target the host re-shows or re-creates in the meantime is seen. The first one
   *  that can actually hold focus receives it. `<body>` and `<html>` are skipped: a component that
   *  recorded one as its opener (nothing held focus when it opened) has no opener candidate. */
  candidates: () => readonly FocusReturnCandidate[];
  /** Whether focus sitting on `active` is stranded by the close (typically: inside the component or
   *  its now-closed panel). Defaults to composed containment in `host`. Focus that has fallen to
   *  `<body>`, and focus still on the element the close's own synchronous return left it on, always
   *  count as stranded. */
  stranded?: (active: Element) => boolean;
  /** Additional settle point awaited after the host's update, such as an exit animation whose end
   *  the host may be waiting on before it re-shows its trigger. */
  settled?: Promise<unknown>;
  /** Extra validity check evaluated before the pass acts (for example "still closed"). */
  isCurrent?: () => boolean;
  /** Final component-owned target step, invoked once every ordinary return candidate is
   *  unavailable. */
  fallback?: () => void;
}

/**
 * Completes an overlay's focus return after the close has been published and the host has had a
 * chance to react to it.
 *
 * Overlay focus return runs synchronously inside the closing component's own update, which is
 * before a host that learns of the close through an event can re-render. A host commonly hides its
 * own trigger (`visibility: hidden`, `hidden`, `inert`) while the overlay is open and re-shows it in
 * response to the close event; the synchronous return then finds a target that cannot take focus,
 * and focus falls to `<body>` or to a component-specific fallback. Keep that synchronous attempt --
 * it preserves the established timing whenever the target can already take focus -- and call
 * `schedule()` right after it.
 *
 * The pass waits for the host's update to complete, then any `settled` promise, then one animation
 * frame, so a host render scheduled from the close event -- a microtask, a task, or a frame callback
 * registered during that event -- has already landed. It acts only while focus is still stranded:
 * lost to `<body>`, still on whatever the synchronous return landed on, or inside the region
 * `stranded` names. Focus the user or host deliberately moved elsewhere in the meantime is never
 * taken back. It then focuses the first candidate that can hold focus -- never `<body>` or the
 * document element, where lost focus already sits -- or invokes the optional component-owned
 * fallback when none can. One bounded pass, not a poll.
 *
 * `cancel()` -- and a later `schedule()` -- abandons a pending pass. Call it when the overlay
 * reopens, closes again, or the component disconnects.
 */
class DeferredFocusReturn {
  private generation = 0;

  /** Abandons any pending pass. */
  cancel(): void {
    this.generation++;
  }

  /** Schedules the deferred pass for one close, replacing any pass still pending. */
  schedule(request: DeferredFocusReturnRequest): void {
    const generation = ++this.generation;
    const { host } = request;
    const doc = host.ownerDocument;
    const view = doc.defaultView;
    const landed = deepActiveElement(doc);
    const current = (): boolean =>
      generation === this.generation && host.isConnected && (request.isCurrent?.() ?? true);
    const run = (): void => {
      if (!current()) return;
      const active = deepActiveElement(doc);
      const stranded =
        !active ||
        active === doc.body ||
        active === doc.documentElement ||
        active === landed ||
        (request.stranded ? request.stranded(active) : composedContains(host, active));
      if (!stranded) return;
      let candidates: readonly FocusReturnCandidate[];
      try {
        candidates = request.candidates();
      } catch {
        // A resolver must not throw out of a deferred frame callback.
        return;
      }
      // `<body>` and the document element are where lost focus already sits, never a place to return
      // it to -- and focusing either reads back as success, since every focused element is inside it.
      const returnable = candidates.filter((c) => c !== doc.body && c !== doc.documentElement);
      if (!focusFirstAvailable(returnable)) request.fallback?.();
    };
    void (async () => {
      await host.updateComplete;
      if (request.settled) await request.settled.catch(() => undefined);
      if (!current()) return;
      if (view?.requestAnimationFrame) view.requestAnimationFrame(run);
      else run();
    })();
  }
}

/** A deferred pass minus its host, as an overlay supplies it through `deferredReturn`. */
export type DeferredFocusReturnPass = Omit<DeferredFocusReturnRequest, 'host'>;

const passes = new WeakMap<HTMLElement, DeferredFocusReturn>();

/** Schedules the host's deferred pass, replacing the one still pending for that host. */
export function scheduleDeferredFocusReturn(request: DeferredFocusReturnRequest): void {
  let pass = passes.get(request.host);
  if (!pass) passes.set(request.host, (pass = new DeferredFocusReturn()));
  pass.schedule(request);
}

/** Abandons the host's pending deferred pass: call on reopen and disconnect. */
export function cancelDeferredFocusReturn(host: HTMLElement): void {
  passes.get(host)?.cancel();
}
