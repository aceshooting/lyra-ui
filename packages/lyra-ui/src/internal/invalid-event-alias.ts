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
    if (event.composedPath()[0] !== host) return;
    const alias = emitAlias({ cancelable: true });
    if (alias?.defaultPrevented) event.preventDefault();
  });
}
