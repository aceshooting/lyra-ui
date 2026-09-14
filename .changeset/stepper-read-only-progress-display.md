---
"@aceshooting/lyra-ui": minor
---

`<lr-stepper>` gains a `readonly` boolean that renders the same `steps` data as a passive progress
display instead of a navigable control.

While `readonly` is set, every step renders as a non-interactive item inside its existing
`role="listitem"` wrapper rather than as a `<button>`: no `tabindex` on any step, no
`aria-disabled`, no click or Enter/Space activation, and therefore no
`lr-step-select` — including from a synthetic click dispatched at `::part(step)`. Arrow/Home/End
keys are a no-op and no longer call `preventDefault()`, so Space keeps scrolling the page the way
it does anywhere else in static content.

Everything that describes *progress* is untouched: the numbered index chip, the completed
checkmark, the optional topic icon, the per-step `title`, `aria-current="step"` on the current
step, and every `--lr-stepper-*` custom property still apply exactly as before.

This is deliberately not a disabled treatment. `disabled` says "you may not do this"; read-only
says "there is nothing to do here" — so a read-only step keeps normal opacity and simply loses its
pointer cursor, matching what `<lr-slider>` and `<lr-rating>` already do for their own `readonly`.
Dimming a progress display reads as broken rather than as informational. A per-step `disabled`
flag is inert while read-only for the same reason: there is no activation left for it to gate, so
it contributes no dimming either, and the step's progress state still renders.

Because no step is tabbable while `readonly`, a horizontal strip that genuinely overflows moves
the single tab stop onto its own scroll container: `[part="base"]` takes `tabindex="0"` (and a
`::part(base):focus-visible` ring) while, and only while, both conditions hold. Without it an
overflowing read-only strip would be a scrollable region with no keyboard access at all — the
off-screen steps unreachable, and an axe `scrollable-region-focusable` violation. A read-only
strip that fits, a vertical one, and every interactive stepper still leave that container out of
the tab order, so a stepper never costs more than one tab.

`readonly` defaults to `false`, and unset behavior — button semantics, roving tabindex, hover and
pressed treatments, and `lr-step-select` — is byte-for-byte unchanged. The internal hover and
pressed rules now name the `button` element inside their existing `:where()` wrapper, which costs
no specificity and leaves a consumer's `::part(step):hover` override winning exactly as it did
before.
