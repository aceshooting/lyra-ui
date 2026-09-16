---
"@aceshooting/lyra-ui": patch
---

Fixed `<lr-input>`'s required-field description, `<lr-task-list>`'s per-item status label,
`<lr-transcript-feed>`'s interim "Transcribing…" marker, and `<lr-filter-bar>`'s touched-required
inline error and hidden filter-control label: all four rendered `class="sr-only"` without
composing the shared `srOnly` style block from `internal/a11y.ts` into their own
`static override styles`, so the class name did nothing and the assistive-only text rendered as
ordinary visible content instead of being clipped to a 1px box. Each component now composes the
shared `srOnly` export, matching the reference shape in `time-input.class.ts`.

Added `scripts/check-visually-hidden.mjs` (with its own `scripts/check-visually-hidden.test.mjs`
unit tests), a new static gate wired into `contract-policy`/`pnpm lint` as
`check:visually-hidden`/`test:visually-hidden`. It flags any `*.class.ts` file whose render
template applies the `sr-only` class without either composing the shared `srOnly` export or
declaring a matching scoped `.sr-only { ... }` rule in its own sibling `*.styles.ts`, so this
class of defect fails CI instead of shipping silently. Added browser regression tests for all four
components asserting the rendered `getComputedStyle()` result (clipped, absolute-positioned, with
the accessible text still present in the DOM), plus explicit `<lr-input>` coverage of the pristine
(no visible required text, error part hidden) and failed-submission (error becomes visible) states.
