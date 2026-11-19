import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { createWaitUntil, type ApprovalWaitUntil } from './approval-wait-until.js';
import { VetoWriteGuard, markVetoGuardWrite } from './veto-write-guard.js';

/** What a host supplies to {@link ApprovalRequestController}. */
export interface ApprovalRequestOptions<A extends string> {
  /** Tag name without the prefix, for the `waitUntil()` misuse warning (for example `confirm-bar`). */
  tag: string;
  /** The host's current pending action. */
  pending: () => A | null;
  /** Writes the host's pending action through its guarded accessor. */
  setPending: (action: A | null) => void;
  /** Extra precondition (not disabled, not already decided). Pending is checked by the controller. */
  canRequest?: () => boolean;
  /** Whether the host is still in the state a settlement may finalize (still open / undecided). */
  stillOpen?: () => boolean;
  /** Applies a decision: `sync` on the plain path, otherwise after every `waitUntil()` fulfilled. */
  onDecide: (action: A, sync: boolean) => void;
  /** A veto (`preventDefault()` or `waitUntil()`) is about to put the host into its pending state. */
  onVeto?: (action: A) => void;
  /** A deferred promise rejected and the host is back in the undecided state. */
  onBounce?: (action: A) => void;
}

/**
 * The re-entrancy and veto protocol of an approve/deny request pair: a cancelable request event
 * dispatched with a `waitUntil()` resolver, a write guard that notices a listener resolving the
 * state itself, a pending state while the host works, and a generation-checked settlement.
 *
 * Hosts keep their own accessors; each write to a guarded property calls {@link markWrite}, and a
 * `pendingAction` write calls {@link pendingChanged} so a stale settlement never resolves a newer
 * pending decision.
 */
export class ApprovalRequestController<A extends string> implements ReactiveController {
  /** True while a request event is being dispatched; nested requests are ignored. */
  decisionDispatching = false;
  private readonly guard = new VetoWriteGuard();
  private generation = 0;

  constructor(host: ReactiveControllerHost, private readonly options: ApprovalRequestOptions<A>) {
    host.addController(this);
  }

  /** A disconnect releases the dispatch flag; in-flight settlements stay valid across a move. */
  hostDisconnected(): void {
    this.decisionDispatching = false;
  }

  /** Call from every guarded setter (`decision`, `open`, `pendingAction`), unconditionally. */
  markWrite(): void {
    markVetoGuardWrite(this.guard);
  }

  /** Call from the `pendingAction` setter with the previous and new value. */
  pendingChanged(previous: A | null, next: A | null): void {
    if (previous !== next) this.generation++;
    this.markWrite();
  }

  /**
   * Dispatches one request. `emit` receives `waitUntil` and returns the dispatched event. Returns
   * true when the decision was committed synchronously; false when it was ignored, vetoed, deferred
   * or resolved by a listener.
   */
  request(action: A, emit: (waitUntil: ApprovalWaitUntil) => Event, precheck: () => boolean = () => true): boolean {
    const { options } = this;
    if (this.decisionDispatching) return false;
    this.decisionDispatching = true;
    try {
      if (options.pending() != null || options.canRequest?.() === false || !precheck()) return false;
      const { waitUntil, deferrals, seal } = createWaitUntil(options.tag);
      this.guard.open();
      const event = emit(waitUntil);
      seal();
      const listenerResolvedItself = this.guard.touched;
      if (deferrals.length > 0 || event.defaultPrevented) {
        options.onVeto?.(action);
        if (listenerResolvedItself) {
          // Accepted promises must not surface as unhandled rejections; their outcome is not ours.
          for (const deferral of deferrals) void deferral.catch(() => undefined);
          return false;
        }
        options.setPending(action);
        if (deferrals.length > 0) this.settle(action, Promise.all(deferrals));
        return false;
      }
      if (listenerResolvedItself) return false;
      options.onDecide(action, true);
      return true;
    } finally {
      this.decisionDispatching = false;
    }
  }

  private settle(action: A, promise: Promise<unknown>): void {
    const { options } = this;
    const generation = this.generation;
    const stillOurs = (): boolean =>
      generation === this.generation && options.pending() === action && (options.stillOpen?.() ?? true);
    void promise.then(
      () => { if (stillOurs()) options.onDecide(action, false); },
      () => {
        if (!stillOurs()) return;
        options.setPending(null);
        options.onBounce?.(action);
      },
    );
  }
}
