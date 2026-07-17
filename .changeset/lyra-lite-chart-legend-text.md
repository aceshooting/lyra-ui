---
"@aceshooting/lyra-ui": minor
---

`lyra-lite-chart` gains a `legendText?: (label: string, datasetIndex: number) => string` hook,
appending formatter-supplied text (e.g. a value or percentage share) after each series' label in the
built-in legend row — mirrors the existing `pointText`/`tickFormat` opt-in-hook convention. Previously
a consumer needing per-series legend text beyond the bare label had to hand-roll an entire replacement
legend instead of using the built-in `legend` prop.
