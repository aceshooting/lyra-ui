import { focusFirstAvailable } from './focus-navigation.js';
import { composedContains, deepActiveElement } from './overlay-manager.js';

type FocusReturnCandidate = HTMLElement | null | undefined;

/** One close's deferred focus return -- see `DeferredFocusReturn.schedule()`. */
export interface DeferredFocusReturnRequest {
  /** The closing component. Its update must complete before the pass runs, and a disconnected host
   *  abandons it. */
  host: HTMLElement & { readonly updateComplete: Promise<unknown> };
  /** Return targets in priority order, resolved when the pass runs rather than when it is
   *  scheduled, so a target the host re-shows or re-creates in the meantime is seen. The first one
   *  that can actually hold focus receives it. */
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
 * taken back. It then focuses the first candidate that can hold focus; when none can, focus is left
 * where it is. One bounded pass, not a poll.
 *
 * `cancel()` -- and a later `schedule()` -- abandons a pending pass. Call it when the overlay
 * reopens, closes again, or the component disconnects.
 */
export class DeferredFocusReturn {
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
      focusFirstAvailable([...candidates]);
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
