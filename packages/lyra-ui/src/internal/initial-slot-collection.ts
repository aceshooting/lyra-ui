/**
 * Runs a component's own slot-assignment collector once against a slot's CURRENT assignment, for
 * a call from `firstUpdated()` alongside the component's ordinary `@slotchange` listener.
 *
 * happy-dom (verified through 20.14.5) never fires `slotchange` for a slot's INITIAL assignment --
 * only for a later mutation to an already-connected slot. So a component that derives state (an
 * options list, a selection default, an item collection, ...) exclusively from a `slotchange`
 * handler collects nothing under it when the slotted children already exist before the component
 * first renders -- the ordinary Lit "render only once data is ready" pattern, which slots every
 * child in the same commit as the host itself. A real browser DOES fire the initial event, so
 * calling the same collector from both `firstUpdated()` and `slotchange` keeps the component
 * correct in both environments, provided the collector is idempotent against being run twice with
 * the same assigned elements -- which a real browser firing both does on every connect. This
 * helper only supplies the timing; the caller owns idempotency. `select.class.ts`'s
 * `collectOptionsFromSlot` is the reference: identity-diffing the previous element set against the
 * newly-read one makes a second call over an unchanged set contribute no duplicate
 * selection-seeding side effect.
 *
 * A caller whose one-shot seeding logic must not fire on a legitimately empty result (nothing
 * assigned yet, real content arriving later through its own ordinary `slotchange`) filters that
 * case out of `collect` itself, or checks `slot.assignedElements(...)` before calling this helper
 * at all -- this helper does not special-case emptiness.
 *
 * @param slot The slot to read (e.g. an `@query`-bound field, or
 *   `renderRoot.querySelector('slot:not([name])')`). `null`/`undefined` is a no-op -- a component
 *   whose relevant slot didn't render for the current props has nothing to collect yet.
 * @param collect The component's own collection logic, given the slot directly rather than an
 *   `Event` (`slotchange`'s `e.target`), so it has one calling convention from either origin.
 */
export function collectInitialSlotAssignment<T extends HTMLSlotElement>(
  slot: T | null | undefined,
  collect: (slot: T) => void
): void {
  if (slot) collect(slot);
}
