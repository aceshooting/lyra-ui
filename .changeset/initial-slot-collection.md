---
"@aceshooting/lyra-ui": patch
---

Twenty components derived state from their slotted children only through a `slotchange` listener, so
they depended on the environment firing that event for a slot's INITIAL assignment. A DOM
implementation that does not — happy-dom, through 20.14.5 — leaves that state empty forever when the
children already exist at connect, which is what the ordinary conditional-render pattern produces.
Most visibly, an `<lr-select>`/`<lr-combobox>` whose `<lr-option>` children are rendered in the same
commit had zero options there, so the shipped `chooseOption()` testing driver threw, contradicting
the testing entry's own cross-environment promise.

Each affected component now also collects once on first update, from the slot's assigned elements,
through a shared helper. The collection is idempotent, so a real browser firing the initial event as
well changes nothing. Also fixed along the way: `lr-menu`'s collection was not idempotent (a second
pass misread the settled active item as having moved and stole focus), and `lr-chart` could have an
already-collected slotted config clobbered back to undefined by a phantom `slotchange` fired at the
slot element discarded during its loading-to-loaded render swap.

About eighty other components were checked and already seed their slot-derived state eagerly; they
are unchanged.
