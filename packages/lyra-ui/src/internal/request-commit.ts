import { devWarnOnce } from './dev-mode-attribute-warning.js';
import type { VetoWriteGuard } from './veto-write-guard.js';

/** The caller-supplied half of one request/commit pair. */
export interface RequestCommitOptions<D, E extends Event> {
  /** The proposed value, handed to {@link RequestCommitOptions.emitRequest} as the event detail. */
  requestDetail: D;
  /**
   * Dispatches the cancelable request event and returns it. Write the adapter in exactly this
   * shape, `init` annotation included:
   *
   * ```ts
   * emitRequest: (detail, init: { cancelable: true }) =>
   *   this.emit('lr-toggle-request', detail, init),
   * ```
   *
   * The helper takes an adapter rather than a host plus an event-name string so the literal
   * `this.emit('<name>', ...)` call stays in the component. That keeps the event name and the
   * detail shape checked against that component's own event map (`emit()` is keyed by it), and
   * keeps `emit()`'s `protected` visibility intact with no cast.
   *
   * ### The `init` annotation is load-bearing, not decoration
   *
   * TypeScript already infers that parameter contextually, so the annotation reads as redundant.
   * It is not. `check:event-contracts` derives every event's runtime cancelability by re-parsing
   * the component's *source* and resolving the third argument of each `this.emit()` call, and it
   * resolves that argument only from an object literal or from an **inline** object type written
   * on the parameter the value came from. Contextual inference is invisible to it, and so is a
   * named alias (`init: RequestEventInit`). Either of those leaves the event unresolved and fails
   * `pnpm lint` with `runtime-event-cancelability-unresolved` naming that event -- loudly, in the
   * component that dropped the annotation, not silently. Annotating only `init` is enough;
   * `detail` may stay contextually typed. Every `installInvalidEventAlias()` call site in this
   * package carries the same annotation for the same reason.
   *
   * ### What passing `{ cancelable: true }` here does and does not guarantee
   *
   * An event nobody can cancel is not a veto point, so this helper always *passes* cancelable
   * options rather than trusting each call site to remember them. Only the adapter can *apply*
   * them: an adapter that shortens its arity and drops `init` still type-checks, dispatches a
   * non-cancelable event, and turns every listener's `preventDefault()` into a silent no-op. So
   * the helper reads `cancelable` back off the dispatched event and warns in dev mode when it is
   * false. That read-back, not the argument, is the actual enforcement.
   */
  emitRequest: (detail: D, init: { cancelable: true }) => E;
  /**
   * Runs only when the request event was not defaultPrevented (and, when a `guard` is supplied,
   * only when no listener wrote the guarded property during the dispatch). This is where the
   * component applies its own write AND emits its own non-cancelable settled event -- the helper
   * cannot emit that event itself, because every pair names and shapes its settled event
   * differently from its request event.
   */
  commit: () => void;
  /**
   * Opt-in composition with {@link VetoWriteGuard}: when supplied, the guard is opened
   * immediately before the dispatch and read immediately after it, and a listener that wrote the
   * guarded property during the dispatch suppresses `commit` exactly as a `preventDefault()`
   * would. Omit it to keep the plain veto-or-commit behaviour, which is all a pair whose
   * listeners cannot write the proposed property back needs.
   */
  guard?: VetoWriteGuard;
}

/**
 * Emits one cancelable request event carrying a proposed value and, unless a listener objected,
 * runs the caller's commit action. This is the library's recurring controlled/uncontrolled shape:
 * a consumer that wants to own the property fully calls `preventDefault()` on the request and
 * assigns the property itself; a consumer that wants the built-in behaviour does nothing, and the
 * component writes the proposed value and then announces it.
 *
 * Returns the request event so the caller can branch on its `defaultPrevented` afterwards -- to
 * skip a second live-region announcement for a change that never happened, or to roll a draft
 * input back to the accepted value, say. It deliberately does not emit the settled event: `commit`
 * owns that, since the settled event's name and detail differ from the request's in every existing
 * pair.
 *
 * ## The contract, stated as what is actually enforced
 *
 * - **The call shape is the adapter, not a host plus an event name.** `requestThenCommit` takes no
 *   host and no event-name string; a `LyraElement` subclass supplies no inference candidate for
 *   its own `Events` parameter, so a `host: LyraElement<Events>` signature collapses
 *   `keyof Events & string` to `never` and rejects every literal event name. The adapter form is
 *   the one that compiles, and it is the form `installInvalidEventAlias()` already uses.
 * - **`emitRequest`'s `init` parameter must carry an inline `{ cancelable: true }` annotation.**
 *   Enforced by `check:event-contracts`, per {@link RequestCommitOptions.emitRequest}. Nothing
 *   about the annotation is enforced by the type system; the contract check is the gate.
 * - **The dispatched event really being cancelable is checked at runtime, in dev mode only.** The
 *   helper cannot make an adapter forward `init`, so it verifies the outcome instead and warns
 *   once per event type when the dispatch was not cancelable. In production the warning is a
 *   no-op, exactly like every other diagnostic behind `devWarnOnce()`.
 * - **Nothing here emits the settled event, and nothing here writes the proposed value.** Both
 *   belong to `commit`.
 *
 * ## Composition with {@link VetoWriteGuard}
 *
 * `emit()` dispatches synchronously, so a listener's write lands *before* this function reads
 * anything back. That makes "did a listener resolve this itself?" unanswerable by comparing the
 * property before and after the dispatch: a listener that writes back the value the property
 * already held produces an identical snapshot, and the default commit then overwrites the
 * listener's decision with the proposal. {@link VetoWriteGuard} answers the question the compare
 * cannot -- it records that a write *happened*, not that a value differs -- provided it is opened
 * immediately before the dispatch and read immediately after it. Passing `guard` hands both of
 * those steps to this function:
 *
 * - `guard.open()` runs immediately before the dispatch, so a write from earlier in the same
 *   interaction (or from a previous request/commit pair) can never suppress this commit.
 * - `guard.touched` is read immediately after the dispatch and before `commit` runs, so a write
 *   that `commit` itself performs through the same guarded setter is never mistaken for a
 *   listener's, and a nested request/commit pair started from inside `commit` cannot change the
 *   decision already taken here.
 *
 * The guarded property's setter must still call `markVetoGuardWrite()` unconditionally on every
 * write, including one that assigns the value the property already held; that call is what the
 * guard observes.
 */
export function requestThenCommit<D, E extends Event>(
  opts: RequestCommitOptions<D, E>,
): E {
  const { commit, emitRequest, guard, requestDetail } = opts;
  guard?.open();
  const request = emitRequest(requestDetail, { cancelable: true });
  const listenerResolvedItself = guard?.touched ?? false;
  if (!request.cancelable) {
    devWarnOnce(
      `lyra-request-commit-not-cancelable:${request.type}`,
      `requestThenCommit(): '${request.type}' was dispatched non-cancelable, so preventDefault() ` +
        'cannot veto it and the commit always runs. Forward the init argument this helper ' +
        `supplies: (detail, init: { cancelable: true }) => this.emit('${request.type}', detail, init).`,
    );
  }
  if (request.defaultPrevented || listenerResolvedItself) return request;
  commit();
  return request;
}
