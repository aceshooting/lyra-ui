/**
 * Tracks whether a veto-capable property was written to during a synchronous `emit()` call.
 *
 * `emit()` dispatches its listeners synchronously, so a listener that both vetoes an operation
 * (`preventDefault()`) and resolves it itself -- by writing to the same property the dispatching
 * code is about to touch -- runs to completion before the dispatching code's own bookkeeping does.
 * Comparing a before/after snapshot of the property's *value* cannot detect this: when the listener
 * writes back the exact value the property already held, the snapshot compare sees no change, and
 * the dispatching code clobbers the listener's decision. This guard tracks that a write happened,
 * not whether a value differs.
 *
 * Deliberately not a decorator or mixin: components differ in how many properties share one guard
 * (one guard covering two properties, or one guard per list entry rather than per instance), so the
 * primitive is the guard object itself -- opened immediately before `emit()` and read immediately
 * after it, from hand-written accessors that call `markVetoGuardWrite()` on every write regardless
 * of whether the new value actually differs from the old one.
 */
export class VetoWriteGuard {
  /** Opens the guard: clears the touched flag. Call immediately before `emit()`. */
  open(): void {
    writesByGuard.set(this, false);
  }

  /** True if any tracked setter wrote since the last `open()`. Call immediately after `emit()`. */
  get touched(): boolean {
    return writesByGuard.get(this) ?? false;
  }
}

// Keyed by instance, rather than a private class field, so `markVetoGuardWrite()` -- a plain
// function, not a method -- can record a write without the class needing to expose a public
// "write" method that anything outside a property setter could call directly.
const writesByGuard = new WeakMap<VetoWriteGuard, boolean>();

/**
 * Call once per veto-capable property, from inside its own setter, immediately after the
 * underlying write -- unconditionally, even when the new value equals the old one. Marks "a write
 * happened" for whichever guard is currently open.
 */
export function markVetoGuardWrite(guard: VetoWriteGuard): void {
  writesByGuard.set(guard, true);
}
