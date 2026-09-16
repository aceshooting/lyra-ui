---
"@aceshooting/lyra-ui": minor
---

`<lr-gauge>`'s value/label captions are now sized in `em` (`--lr-size-1em` for the value, and
`calc(var(--lr-size-1em) * 0.625)` for the label — the same 0.625 multiplier `--lr-font-size-2xs`
carries, kept as `em` math because the value-named token catalog's growth is frozen) instead of the
previous `rem`-anchored tokens (`--lr-font-size-m`, `--lr-font-size-2xs`, and, for the `linear`
shape specifically, a flat `--lr-size-0-5rem`). Every box in this component was already `em`-based
(`--lr-size-8em` for `radial`/`ring`, `--lr-size-12em` by `--lr-size-1-5em` for `linear`), so a
smaller `size` tier or a caller's own `font-size` on the host previously shrank the frame while the
caption stayed pinned to the document root — at the smallest tiers, or below them, the fixed
caption nearly filled or overflowed the box. The caption now scales with the same font-size that
sets the frame, so `<lr-gauge shape="linear" size="xs">` (or smaller) is usable as a compact
dashboard meter. At the default (unset `size`, unmodified ambient font) tier the resolved caption
size is unchanged.

New `showValue` property (default `true`, matching today's rendering) lets the decorative
`part="value"` caption be omitted — `<lr-gauge show-value="false">` — the same way an empty
`label` already omits the `part="label"` caption. Mirrors `<lr-progress-bar>`'s and
`<lr-progress-ring>`'s own `showValue` name and meaning; the default differs because a gauge's
purpose is showing the reading it announces, so hiding it is the opt-out. The accessible value
(`aria-valuenow`/`aria-valuetext`, the host's computed accessible name) is unaffected either way,
since the caption was always `aria-hidden`.
