---
"@aceshooting/lyra-ui": minor
---

`<lr-progress-ring>` gains an opt-in `size` on the library's one six-step size ladder
(`2xs`/`xs`/`s`/`m`/`l`/`xl`, plus the `small`/`medium`/`large` spellings, which are accepted as
authored rather than rewritten to the short form). It defaults to `m`, rendering byte-identically
to before this property existed.

`size` steps the ring's outer diameter, from a compact `1.25rem` at `2xs` up to a roomy `3.5rem`
at `xl` (`2.5rem` unchanged at the `m` default), matching sibling `<lr-progress-bar>`'s own `size`
in scope: it scales exactly one dimension. An explicit `--lr-progress-ring-size` (or the upstream
`--size` alias) still wins over every tier. The track/indicator stroke width and the center
label's font size are unaffected by the tier, also matching `<lr-progress-bar>` (which likewise
leaves its label font size untouched by its own thickness ladder).

Sibling sweep: `<lr-progress-ring>` shares its stylesheet module and its test file with
`<lr-progress-bar>` and sits in the same component directory, but had no `size` property when
`<lr-progress-bar>` gained its own thickness ladder — this closes that gap with the ring's own
diameter ladder and a matching regression test suite (unset-default, the default's host-attribute
reflection, both attribute spellings across the six-step ladder, and
explicit-override-wins-over-every-tier — four new tests). Checked every other `*.styles.ts`
module in the library exporting more than one component's stylesheet: `overlay.styles.ts`
(shared by `popover`/`tooltip`) has no `size` on either sibling, so there is no counterpart gap
there. `radio-button.styles.ts` (shared by `radio-button`/`radio`) is a different case, not a
counterpart gap either, but for a different reason than "neither has it": `<lr-radio>` already
declares a working, reflected `size: LyraSize = 'm'` (`radio.class.ts`), and `<lr-radio-button>`
extends `LyraRadio` and additionally imports the same shared `sizes` design-token stylesheet in
its own `static override styles` (`radio-button.class.ts`), so it inherits that property outright
— `radio-button.test.ts`'s `describe('size and pill', ...)` already proves the tier changes
rendered geometry across all six tiers and both spellings. That pair is excluded because both
siblings already have `size`, not because neither does. Several other component families have a
mixed `size` picture for unrelated, pre-existing reasons (for example `lr-badge` has `size` while
sibling `lr-tag` does not); those do not share a stylesheet module with the sized sibling and are
a separate, larger scoping question outside this task.
