---
"@aceshooting/lyra-ui": minor
---

`<lr-dialog>` and `<lr-progress-bar>` gain an opt-in `size` property on the library's shared
six-step size ladder (`2xs`/`xs`/`s`/`m`/`l`/`xl`, plus the `small`/`medium`/`large` aliases). Both
default to `m`, rendering byte-identically to before this property existed.

- `<lr-dialog>`: `size` steps the panel's width cap, from a compact `20rem` at `2xs` up to a roomy
  `48rem` at `xl` (`32rem` unchanged at the `m` default). An explicit `--lr-dialog-width` or
  `--lr-dialog-max-width` override still wins over every tier.
- `<lr-progress-bar>`: `size` steps the track/indicator thickness, from a slender `0.25rem` at
  `2xs` up to a bold `1.5rem` at `xl` (`1rem` unchanged at the `m` default). An explicit
  `--lr-progress-track-height` (or the upstream `--track-height`/`--height` aliases) still wins
  over every tier.
