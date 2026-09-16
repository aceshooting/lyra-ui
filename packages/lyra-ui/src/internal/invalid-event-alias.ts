/**
 * Relays a form-associated host's native `invalid` notification through the library's
 * bubbling/composed alias. The target guard matters for controls that contain other form controls:
 * a descendant's synthetic/composed `invalid` event must not be mistaken for this host failing its
 * own validity check.
 *
 * The alias is a real veto point, so it is emitted `cancelable` and its cancellation is forwarded
 * to the native event: `event.preventDefault()` on `lr-invalid` suppresses the platform's default
 * for `invalid`, i.e. the browser's own validation bubble and `reportValidity()`'s focus/scroll.
 * Without that forwarding an app wiring `lr-invalid` to its own error banner had no way to stop the
 * native UI from appearing alongside it — the native event is dispatched by the platform, so
 * cancelling a copy of it can only mean cancelling the original.
 *
 * @param host The element whose own `invalid` events are relayed.
 * @param emitAlias Dispatches the alias and returns the dispatched event, so its `defaultPrevented`
 *   can be read back. Callers pass the `init` through to `emit()` — `(init) => this.emit('lr-invalid',
 *   undefined, init)` — since only an event dispatched `cancelable` can be cancelled at all.
 */
export function installInvalidEventAlias(
  host: EventTarget,
  emitAlias: (init: { cancelable: true }) => Event | void,
): void {
  host.addEventListener('invalid', (event) => {
    if (!targetsHost(event, host)) return;
    const alias = emitAlias({ cancelable: true });
    if (alias?.defaultPrevented) event.preventDefault();
  });
}

function targetsHost(event: Event, host: EventTarget): boolean {
  return event.composedPath()[0] === host;
}

// Depth per host rather than a single module-level flag or a plain `Set`: `checkValidity()` is a
// public method a consumer can call reentrantly (from inside its own `invalid`/`lr-invalid`
// listener, say), and a `WeakMap` counter keeps that safe without leaking a reference once the
// host is otherwise unreachable.
const staticValidityCheckDepth = new WeakMap<EventTarget, number>();

/**
 * Runs `run` (a control's own `internals.checkValidity()` call) in a scope where a synchronously
 * dispatched `invalid` event on `host` is known to come from a **silent, static** validity query,
 * not from interactive validation. Pair with `installInteractionOnInvalid()`, which reads this
 * scope to decide whether that same `invalid` event should mark the control as user-interacted.
 *
 * @param host The control whose `internals.checkValidity()` is about to run.
 * @param run Performs the static check (typically `() => this.internals.checkValidity()`) and
 *   returns its result.
 */
export function withStaticValidityCheck<T>(host: EventTarget, run: () => T): T {
  staticValidityCheckDepth.set(host, (staticValidityCheckDepth.get(host) ?? 0) + 1);
  try {
    return run();
  } finally {
    const depth = (staticValidityCheckDepth.get(host) ?? 1) - 1;
    if (depth <= 0) staticValidityCheckDepth.delete(host);
    else staticValidityCheckDepth.set(host, depth);
  }
}

/**
 * Reads the scope `withStaticValidityCheck()` sets: true while `host`'s own `internals.checkValidity()`
 * call is synchronously on the stack. For a control whose `invalid` targeting is more than "did this
 * fire on the host itself" (a group that also owns other form-associated children and listens for
 * their `invalid` events in the capture phase, say), this is the lower-level primitive to gate a
 * bespoke listener with directly; `installInteractionOnInvalid()` is the convenience wrapper for the
 * common host-only case.
 */
export function isStaticValidityCheckInProgress(host: EventTarget): boolean {
  return (staticValidityCheckDepth.get(host) ?? 0) > 0;
}

/**
 * Marks `host` as user-interacted whenever a native `invalid` event targets it directly, unless
 * that event was raised synchronously inside a `withStaticValidityCheck()` scope.
 *
 * The platform dispatches the exact same `ElementInternals`-sourced `invalid` event, with no
 * discriminator on it at all, for every path that revalidates a form-associated element:
 * `checkValidity()` (silent — must never touch a pristine control's interaction state, however
 * invalid the control already is), `reportValidity()`, and — the path nothing in this library
 * previously observed — a submission attempt (`requestSubmit()`, a submit button, or implicit
 * Enter submission), which is exactly when native `:user-invalid` starts matching. Listening for
 * `invalid` itself, rather than wrapping `reportValidity()`, is what makes the submission path
 * observable at all: a submission attempt never calls the control's own `reportValidity()` method,
 * it drives `ElementInternals` directly.
 *
 * LIMITATION: a form's own **static** `form.checkValidity()` fires this identical event, from this
 * identical `ElementInternals`, for every invalid participant — nothing distinguishes "the form is
 * quietly asking every control whether it's valid" from "the form is attempting to submit and this
 * control is one of the blockers" once the event reaches an individual control. This function
 * resolves that ambiguity by marking interaction, the same as it would for a real submission
 * attempt, since a form-level static check cannot be told apart from one on the receiving end.
 *
 * @param host The element whose own `invalid` events count toward interaction.
 * @param markInteracted Records that `host` has now been "touched" for `:state(user-valid)`/
 *   `:state(user-invalid)` purposes and re-syncs whatever reflects those states.
 */
export function installInteractionOnInvalid(
  host: EventTarget,
  markInteracted: () => void,
): void {
  host.addEventListener('invalid', (event) => {
    if (!targetsHost(event, host)) return;
    if (isStaticValidityCheckInProgress(host)) return;
    markInteracted();
  });
}
