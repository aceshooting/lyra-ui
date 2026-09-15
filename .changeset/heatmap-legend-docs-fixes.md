---
"@aceshooting/lyra-ui": patch
---

Fix two `<lr-heatmap>` documentation defects, none of which change runtime behavior:

- The reference claimed "Slots: none." The `legend` slot — custom content rendered inside the
  built-in legend row — has actually been available since 13.0.0; the doc simply never disclosed
  it.
- The capped-grid ("Known gotchas") advice to "position it with ordinary CSS on the host" when
  `fit-to-width` clamps the canvas below the host's own width was itself broken: `fit-to-width`
  derives the canvas size from the host's own measured width, so making the host shrink-to-fit
  (`inline-block`, `fit-content`, floating it) to chase the capped canvas creates a circular sizing
  dependency that settles at the wrong size. The doc now recommends the recipe that actually works —
  `::part(canvas) { margin-inline: auto }` to center it, `margin-inline-start: auto` to end-align it
  — and now also calls out that `::part(base) { align-items: center }` is a tempting but different
  fix: it centers the canvas too, but shrink-wraps every other child of the base flex column along
  with it, collapsing the legend row's width in the process.
