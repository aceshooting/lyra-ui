---
"@aceshooting/lyra-ui": minor
---

`<lr-alert>` gains an opt-in `size` on the library's one six-step size ladder
(`2xs`/`xs`/`s`/`m`/`l`/`xl`, plus the `small`/`medium`/`large` spellings, which are accepted as
authored rather than rewritten to the short form). A tier scales the panel's padding and text
together and takes `<lr-callout>`'s values for both, so a tiered alert and a tiered callout of the
same size line up in one column.

The close action keeps the shared tappable-target floor at every tier — it is a WCAG 2.5.8
minimum, not a density knob — and its optical pull-out toward the panel edge is now clamped to the
tier's own gutter, so the two smallest tiers cannot push it through the panel's clipped border.

Two things deliberately do not vary by tier, again matching `<lr-callout>`: the gap between the
icon, the message and the close action — it separates three adjacent boxes rather than setting the
panel's density, and tightening it at the small tiers only crowds the close control — and the
leading icon glyph, a status affordance whose size is bounded by the shared tappable-target token.
The tier also uses the ladder's inline gutter on all four sides, because the ladder's block gutter
belongs to a single-row control and collapses to zero at the two smallest tiers, which would leave
an alert's text touching its own border.

This is the one Lyra addition on top of the pinned Shoelace alert surface, and it is opt-in for
exactly that reason: with no `size`, the panel keeps the padding it always had and the text size it
inherits, so migrated markup renders unchanged. The untiered states of the two panels are therefore
not interchangeable even though every tier is: an untiered `<lr-callout>` reads the ambient
form-control slots and falls back to the shared `m` padding and text size, while an untiered
`<lr-alert>` keeps its fixed gutter and inherits. Pinning a default tier here would have resized
every alert that shipped before this property existed. An unsupported value normalizes to the
omitted state and removes the attribute, matching how `countdown` already behaves on this
component.
