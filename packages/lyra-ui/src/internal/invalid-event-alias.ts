/**
 * Relays a form-associated host's native `invalid` notification through the library's
 * bubbling/composed alias. The target guard matters for controls that contain other form controls:
 * a descendant's synthetic/composed `invalid` event must not be mistaken for this host failing its
 * own validity check.
 */
export function installInvalidEventAlias(host: EventTarget, emitAlias: () => void): void {
  host.addEventListener('invalid', (event) => {
    if (event.composedPath()[0] === host) emitAlias();
  });
}
