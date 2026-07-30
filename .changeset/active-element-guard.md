---
"@aceshooting/lyra-ui": patch
---

Stop letting a throwing `ShadowRoot.activeElement` getter escape a component. `ShadowRoot.activeElement`
is not universally safe to read: under happy-dom 20.11.1 — the DOM a large share of consumers get by
default from Vitest — that getter *itself* throws `TypeError: Cannot read properties of undefined
(reading 'getRootNode')` whenever the document has no active element. Optional chaining was no
defence, because `root?.activeElement` only guards `root` being nullish and the throw happens
*inside* the getter, after `?.` has already decided to proceed.

Because these reads live in `willUpdate()` and in keydown handlers, the symptom was not a failed
assertion but an *unhandled rejection*: one downstream suite reported 120 in a single run, all the
same stack, from an `<lr-segmented>` re-rendering after its items changed. The suite still passed
while the runner exited non-zero, and the stack pointed at library internals rather than anything
the consumer wrote.

Reported against `<lr-segmented>`, but a sweep found the same read at **every** focus-rehoming,
roving-tabindex and focus-restoration site in the library — 30 modules across 11 families, including
`<lr-tabs>`, `<lr-stepper>`, `<lr-table>`, `<lr-tree>`, `<lr-graph>`, `<lr-combobox>`'s siblings and
the shared overlay manager. All of them now read through a new internal helper that returns `null`
instead of throwing; `<lr-tree>`'s nested-shadow-root walk was the worst case, reading the raw
getter in its *loop condition* where a guard on the assignment alone would not have helped.

Returning `null` is the honest answer: a DOM that cannot say what is focused is indistinguishable,
for these call sites, from one where nothing is — and every one of them already handles that as the
ordinary state, so the guard degrades to skipping focus restoration. Real browsers never take the
catch, so behavior there is unchanged.
